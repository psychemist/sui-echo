/**
 * Production zkLogin Utilities
 * Full proof generation and signature assembly for Sui zkLogin
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import {
    generateRandomness,
    generateNonce,
    getExtendedEphemeralPublicKey,
    genAddressSeed,
    getZkLoginSignature,
    jwtToAddress,
} from "@mysten/sui/zklogin";
import { jwtDecode } from "jwt-decode";
import { SUI_RPC_URL, ZK_PROVER_URL, ZKLOGIN_CONFIG } from "@/config";

// Types
export interface ZkLoginSession {
    ephemeralKeyPair: Ed25519Keypair;
    randomness: string;
    nonce: string;
    maxEpoch: number;
    jwt?: string;
    userSalt?: string;
    zkProof?: ZkProof;
    zkLoginAddress?: string;
}

export interface ZkProof {
    proofPoints: {
        a: string[];
        b: string[][];
        c: string[];
    };
    issBase64Details: {
        value: string;
        indexMod4: number;
    };
    headerBase64: string;
}

export interface DecodedJwt {
    iss: string;
    sub: string;
    aud: string;
    exp: number;
    iat: number;
    nonce: string;
    email?: string;
    name?: string;
    given_name?: string;
}

// Sui Client singleton
let suiClient: SuiClient | null = null;

export function getSuiClient(): SuiClient {
    if (!suiClient) {
        suiClient = new SuiClient({ url: SUI_RPC_URL });
    }
    return suiClient;
}

/**
 * Get the current epoch from the Sui network
 */
export async function getCurrentEpoch(): Promise<number> {
    const client = getSuiClient();
    const { epoch } = await client.getLatestSuiSystemState();
    return Number(epoch);
}

/**
 * Get salt and address from Enoki API
 * This ensures consistent, production-grade salt management
 */
export async function getEnokiSaltAndAddress(jwt: string): Promise<{ salt: string; address: string }> {
    const ENOKI_API_KEY = process.env.NEXT_PUBLIC_ENOKI_API_KEY;

    if (!ENOKI_API_KEY) {
        console.warn("[zkLogin] ENOKI_API_KEY not set, falling back to local salt");
        // Fallback to local deterministic salt
        const decodedJwt = jwtDecode<{ sub: string }>(jwt);
        const salt = generateLocalSalt(decodedJwt.sub);
        const address = jwtToAddress(jwt, salt);
        return { salt, address };
    }

    const response = await fetch("https://api.enoki.mystenlabs.com/v1/zklogin", {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${ENOKI_API_KEY}`,
            "zklogin-jwt": jwt,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[zkLogin] Enoki salt API error:", errorText);
        throw new Error(`Enoki salt API failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("[zkLogin] Got salt and address from Enoki");
    return {
        salt: result.data.salt,
        address: result.data.address,
    };
}

/**
 * Fallback local salt generation (used when Enoki API key not available)
 */
function generateLocalSalt(sub: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(sub + "_sui_echo_salt_v1_stable");

    let hash = 5381;
    for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) + hash) ^ data[i];
    }

    const positiveHash = Math.abs(hash) >>> 0;
    let salt = BigInt(positiveHash);
    for (let i = 0; i < 3; i++) {
        let iterHash = 5381;
        const iterData = encoder.encode(sub + `_iteration_${i}`);
        for (let j = 0; j < iterData.length; j++) {
            iterHash = ((iterHash << 5) + iterHash) ^ iterData[j];
        }
        salt = salt * BigInt(1000000) + BigInt(Math.abs(iterHash) >>> 0);
    }

    return salt.toString();
}

/**
 * Generate user salt - wrapper for backwards compatibility
 */
export function generateUserSalt(sub: string): string {
    return generateLocalSalt(sub);
}

/**
 * Prepare zkLogin session - Called before OAuth redirect
 */
export async function prepareZkLoginSession(): Promise<{ loginUrl: string; maxEpoch: number }> {
    const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
    if (!GOOGLE_CLIENT_ID) {
        throw new Error("NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID is not defined");
    }

    // 1. Get current epoch
    const currentEpoch = await getCurrentEpoch();
    const maxEpoch = currentEpoch + ZKLOGIN_CONFIG.MAX_EPOCH_OFFSET;

    // 2. Generate ephemeral key pair
    const ephemeralKeyPair = new Ed25519Keypair();

    // 3. Generate randomness and nonce
    const randomness = generateRandomness();
    const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), maxEpoch, randomness);

    // 4. Store session data
    if (typeof window !== "undefined") {
        const sessionData = {
            ephemeralSecretKey: ephemeralKeyPair.getSecretKey(),
            randomness,
            nonce,
            maxEpoch,
        };
        window.sessionStorage.setItem("sui_zklogin_session", JSON.stringify(sessionData));
    }

    // 5. Construct OAuth URL
    const redirectUri = typeof window !== "undefined"
        ? `${window.location.origin}/callback`
        : "http://localhost:3000/callback";

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "id_token",
        scope: "openid email profile",
        nonce: nonce,
        prompt: "select_account",
    });

    const loginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return { loginUrl, maxEpoch };
}

/**
 * Retrieve stored session data
 */
export function getStoredSession(): {
    ephemeralSecretKey: string;
    randomness: string;
    nonce: string;
    maxEpoch: number;
} | null {
    if (typeof window === "undefined") return null;

    const data = window.sessionStorage.getItem("sui_zklogin_session");
    if (!data) return null;

    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

/**
 * Generate ZK proof from the proving service
 */
export async function generateZkProof(
    jwt: string,
    ephemeralPublicKey: string,
    maxEpoch: number,
    randomness: string,
    userSalt: string
): Promise<ZkProof> {
    const response = await fetch(ZK_PROVER_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            jwt,
            extendedEphemeralPublicKey: ephemeralPublicKey,
            maxEpoch: maxEpoch.toString(),
            jwtRandomness: randomness,
            salt: userSalt,
            keyClaimName: ZKLOGIN_CONFIG.KEY_CLAIM_NAME,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ZK proof generation failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

/**
 * Complete zkLogin callback - Called after OAuth redirect
 * Uses Enoki API for salt and ZK proof generation
 */
export async function completeZkLoginCallback(jwt: string): Promise<{
    zkLoginAddress: string;
    zkProof: ZkProof;
    userSalt: string;
}> {
    // 1. Retrieve session data
    const session = getStoredSession();
    if (!session) {
        throw new Error("Missing zkLogin session data. Please restart login.");
    }

    // 2. Decode JWT
    const decodedJwt = jwtDecode<DecodedJwt>(jwt);

    // 3. Validate JWT
    if (decodedJwt.nonce !== session.nonce) {
        throw new Error("JWT nonce mismatch. Possible replay attack.");
    }

    if (decodedJwt.exp * 1000 < Date.now()) {
        throw new Error("JWT has expired. Please login again.");
    }

    // 4. Get salt and address from Enoki (or fallback)
    console.log("[zkLogin] Getting salt from Enoki...");
    const { salt: userSalt, address: enokiAddress } = await getEnokiSaltAndAddress(jwt);
    console.log("[zkLogin] Got salt, address:", enokiAddress);

    // 5. Reconstruct ephemeral key pair
    const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(session.ephemeralSecretKey);
    const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(ephemeralKeyPair.getPublicKey());

    // 6. Try Enoki ZKP API first, fall back to prover service
    let zkProof: ZkProof;
    const ENOKI_API_KEY = process.env.NEXT_PUBLIC_ENOKI_API_KEY;

    if (ENOKI_API_KEY) {
        console.log("[zkLogin] Generating ZK proof via Enoki...");
        try {
            const response = await fetch("https://api.enoki.mystenlabs.com/v1/zklogin/zkp", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${ENOKI_API_KEY}`,
                    "zklogin-jwt": jwt,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    network: "testnet",
                    ephemeralPublicKey: extendedEphemeralPublicKey,
                    maxEpoch: session.maxEpoch,
                    randomness: session.randomness,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[zkLogin] Enoki ZKP error:", errorText);
                throw new Error(`Enoki ZKP failed: ${response.status}`);
            }

            const result = await response.json();
            zkProof = result.data;
            console.log("[zkLogin] ZK proof generated via Enoki");
        } catch (enokiError) {
            console.warn("[zkLogin] Enoki ZKP failed, falling back to prover:", enokiError);
            zkProof = await generateZkProof(jwt, extendedEphemeralPublicKey, session.maxEpoch, session.randomness, userSalt);
        }
    } else {
        console.log("[zkLogin] Generating ZK proof via prover service...");
        zkProof = await generateZkProof(jwt, extendedEphemeralPublicKey, session.maxEpoch, session.randomness, userSalt);
    }
    console.log("[zkLogin] ZK proof generated successfully");

    // 7. Use Enoki address if available, otherwise derive locally
    const zkLoginAddress = enokiAddress || jwtToAddress(jwt, userSalt);
    console.log("[zkLogin] Derived address:", zkLoginAddress);

    // 8. Store proof and address for later use
    window.sessionStorage.setItem("sui_zklogin_jwt", jwt);
    window.sessionStorage.setItem("sui_zklogin_proof", JSON.stringify(zkProof));
    window.sessionStorage.setItem("sui_zklogin_address", zkLoginAddress);
    window.sessionStorage.setItem("sui_zklogin_user_salt", userSalt);

    return { zkLoginAddress, zkProof, userSalt };
}

/**
 * Sign and execute a transaction with zkLogin
 */
export async function executeZkLoginTransaction(
    transaction: Transaction
): Promise<{ digest: string; effects: any; objectChanges?: any; events?: any }> {
    // 1. Retrieve all required data
    const session = getStoredSession();
    const jwt = window.sessionStorage.getItem("sui_zklogin_jwt");
    const proofStr = window.sessionStorage.getItem("sui_zklogin_proof");
    const userSalt = window.sessionStorage.getItem("sui_zklogin_user_salt");
    const zkLoginAddress = window.sessionStorage.getItem("sui_zklogin_address");

    if (!session || !jwt || !proofStr || !userSalt || !zkLoginAddress) {
        throw new Error("Incomplete zkLogin session. Please login again.");
    }

    const zkProof: ZkProof = JSON.parse(proofStr);
    const decodedJwt = jwtDecode<DecodedJwt>(jwt);

    // 2. Reconstruct ephemeral key pair
    const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(session.ephemeralSecretKey);

    // 3. Set transaction sender
    transaction.setSender(zkLoginAddress);

    // 4. Sign the transaction with ephemeral key
    const client = getSuiClient();
    const { bytes, signature: userSignature } = await transaction.sign({
        client,
        signer: ephemeralKeyPair,
    });

    // 5. Generate address seed
    const addressSeed = genAddressSeed(
        BigInt(userSalt),
        ZKLOGIN_CONFIG.KEY_CLAIM_NAME,
        decodedJwt.sub,
        decodedJwt.aud as string
    ).toString();

    // 6. Assemble the zkLogin signature
    const zkLoginSignature = getZkLoginSignature({
        inputs: {
            ...zkProof,
            addressSeed,
        },
        maxEpoch: session.maxEpoch,
        userSignature,
    });

    // 7. Execute the transaction
    const result = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature: zkLoginSignature,
        options: {
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
        },
    });

    return {
        digest: result.digest,
        effects: result.effects,
        objectChanges: result.objectChanges,
        events: result.events,
    };
}

/**
 * Check if user is logged in with zkLogin
 */
export function isZkLoginSessionValid(): boolean {
    if (typeof window === "undefined") return false;

    const session = getStoredSession();
    const zkLoginAddress = window.sessionStorage.getItem("sui_zklogin_address");
    const proof = window.sessionStorage.getItem("sui_zklogin_proof");

    if (!session || !zkLoginAddress || !proof) return false;

    // Check if session has expired
    // We'd need to compare maxEpoch with current epoch, but for now just check if data exists
    return true;
}

/**
 * Get the current zkLogin address
 */
export function getZkLoginAddress(): string | null {
    if (typeof window === "undefined") return null;
    return window.sessionStorage.getItem("sui_zklogin_address");
}

/**
 * Clear zkLogin session
 */
export function clearZkLoginSession(): void {
    if (typeof window === "undefined") return;

    window.sessionStorage.removeItem("sui_zklogin_session");
    window.sessionStorage.removeItem("sui_zklogin_jwt");
    window.sessionStorage.removeItem("sui_zklogin_proof");
    window.sessionStorage.removeItem("sui_zklogin_user_salt");
    window.sessionStorage.removeItem("sui_zklogin_address");
}

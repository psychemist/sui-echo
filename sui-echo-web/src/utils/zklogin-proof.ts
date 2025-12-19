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
 * Generate a user salt from email/sub
 * IMPORTANT: Salt must be DETERMINISTIC - same sub = same salt = same address
 * In production, use a backend service like Mysten's salt server (Enoki)
 */
export function generateUserSalt(sub: string): string {
    // Production recommendation: Use Mysten Labs salt server via Enoki
    // For this implementation, we use a deterministic derivation
    // WARNING: This is simplified - production should use HKDF with a master seed

    const encoder = new TextEncoder();
    const data = encoder.encode(sub + "_sui_echo_salt_v1_stable");

    // Create a deterministic hash
    let hash = 5381; // djb2 hash
    for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) + hash) ^ data[i];
    }

    // Ensure positive and large enough value
    const positiveHash = Math.abs(hash) >>> 0; // Convert to unsigned 32-bit

    // Create a larger salt by combining multiple hash iterations
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
 * Generates the ZK proof and derives the zkLogin address
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

    // 4. Generate or retrieve user salt
    // In production, you'd want to store this persistently per user
    let userSalt = window.sessionStorage.getItem("sui_zklogin_user_salt");
    if (!userSalt) {
        userSalt = generateUserSalt(decodedJwt.sub);
        window.sessionStorage.setItem("sui_zklogin_user_salt", userSalt);
    }

    // 5. Reconstruct ephemeral key pair
    const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(session.ephemeralSecretKey);
    const extendedEphemeralPublicKey = getExtendedEphemeralPublicKey(ephemeralKeyPair.getPublicKey());

    // 6. Generate ZK proof
    console.log("[zkLogin] Generating ZK proof...");
    const zkProof = await generateZkProof(
        jwt,
        extendedEphemeralPublicKey,
        session.maxEpoch,
        session.randomness,
        userSalt
    );
    console.log("[zkLogin] ZK proof generated successfully");

    // 7. Derive zkLogin address
    const zkLoginAddress = jwtToAddress(jwt, userSalt);
    console.log("[zkLogin] Derived address:", zkLoginAddress);

    // 8. Store proof and address for later use
    window.sessionStorage.setItem("sui_zklogin_jwt", jwt);
    window.sessionStorage.setItem("sui_zklogin_proof", JSON.stringify(zkProof));
    window.sessionStorage.setItem("sui_zklogin_address", zkLoginAddress);

    return { zkLoginAddress, zkProof, userSalt };
}

/**
 * Sign and execute a transaction with zkLogin
 */
export async function executeZkLoginTransaction(
    transaction: Transaction
): Promise<{ digest: string; effects: any }> {
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

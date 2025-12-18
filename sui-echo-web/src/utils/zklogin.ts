import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { generateRandomness, getExtendedEphemeralPublicKey, generateNonce } from "@mysten/zklogin";

export const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"; // Placeholder
export const REDIRECT_URI = typeof window !== "undefined"
    ? `${window.location.origin}/callback`
    : "http://localhost:3000/callback";

export const prepareZkLogin = async () => {
    // 1. Generate ephemeral key pair
    const ephemeralKeyPair = new Ed25519Keypair();

    // 2. Wrap it for zkLogin
    const randomness = generateRandomness();
    // We use a safe epoch (e.g., current + 2)
    const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), 100000, randomness);

    // 3. Serialize and save to session storage for retrieval after redirect
    if (typeof window !== "undefined") {
        window.sessionStorage.setItem("sui_zklogin_ephemeral_key", ephemeralKeyPair.getSecretKey());
        window.sessionStorage.setItem("sui_zklogin_randomness", randomness);
        // Also save for future reference
        window.sessionStorage.setItem("sui_zklogin_nonce", nonce);
    }

    // 4. Construct the OIDC URL
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "id_token",
        scope: "openid email",
        nonce: nonce,
        prompt: "select_account"
    });

    const loginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return loginUrl;
};

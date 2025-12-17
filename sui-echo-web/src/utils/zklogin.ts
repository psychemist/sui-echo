import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { generateRandomness, getExtendedEphemeralPublicKey, generateNonce } from "@mysten/zklogin";

export const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID"; // Placeholder - needs replacement
export const REDIRECT_URI = "http://localhost:3000/"; // Localhost for dev

export const prepareZkLogin = async () => {
    // 1. Generate ephemeral key pair
    const ephemeralKeyPair = new Ed25519Keypair();

    // 2. Wrap it for zkLogin
    const randomness = generateRandomness();
    const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), 100000, randomness); // Large epoch for demo safety

    // 3. Serialize and save to session storage for retrieval after redirect
    if (typeof window !== "undefined") {
        window.sessionStorage.setItem("sui_zklogin_ephemeral_key", ephemeralKeyPair.getSecretKey());
        window.sessionStorage.setItem("sui_zklogin_randomness", randomness);
    }

    // 4. Construct the OIDC URL
    const params = new URLSearchParams({
        client_id: "25769832374-famecqrhe2gkebt5fvqms2263046lj96.apps.googleusercontent.com", // Using a public test ID or placeholder
        redirect_uri: REDIRECT_URI,
        response_type: "id_token",
        scope: "openid email",
        nonce: nonce,
        prompt: "select_account"
    });

    const loginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return loginUrl;
};

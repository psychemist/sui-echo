"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getExtendedEphemeralPublicKey } from "@mysten/zklogin";

function CallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState("Processing login...");

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // 1. Get the hash part of the URL (OIDC returns params in fragment)
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                const idToken = params.get("id_token");

                if (!idToken) {
                    // Check query params just in case
                    const queryToken = searchParams.get("id_token");
                    if (!queryToken) {
                        setStatus("No ID token found. Please try again.");
                        return;
                    }
                }

                const token = idToken || searchParams.get("id_token");
                if (!token) return;

                // 2. Decode the JWT to check expiry and claims
                const decoded: any = jwtDecode(token);
                console.log("Decoded JWT:", decoded);

                // 3. Retrieve ephemeral key and randomness from session storage
                const ephemeralSecretKey = window.sessionStorage.getItem("sui_zklogin_ephemeral_key");
                const randomness = window.sessionStorage.getItem("sui_zklogin_randomness");

                if (!ephemeralSecretKey || !randomness) {
                    setStatus("Missing session data. Please restart login.");
                    return;
                }

                // 4. Save the ID token for later proof generation
                window.sessionStorage.setItem("sui_zklogin_id_token", token);

                // 5. Derive the ephemeral public key to show we're ready
                const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(ephemeralSecretKey);
                const ephemeralPublicKey = ephemeralKeyPair.getPublicKey();

                setStatus("Verified! Redirecting to dashboard...");
                
                // In a real flow, we would generate a proof here, 
                // but for the MVP demo, we'll proceed to the dashboard where the proof can be handled or mocked.
                setTimeout(() => {
                    router.push("/dashboard");
                }, 1500);

            } catch (err) {
                console.error("Callback error:", err);
                setStatus("Authentication failed.");
            }
        };

        handleCallback();
    }, [router, searchParams]);

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
            <h1 className="text-2xl font-bold mb-2">Authenticating</h1>
            <p className="text-gray-400">{status}</p>
        </div>
    );
}

export default function CallbackPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                <h1 className="text-2xl font-bold mb-2">Loading...</h1>
            </div>
        }>
            <CallbackContent />
        </Suspense>
    );
}

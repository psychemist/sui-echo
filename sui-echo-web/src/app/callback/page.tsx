"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeZkLoginCallback } from "@/utils/zklogin-proof";
import { CheckCircle, XCircle, Loader2, ShieldCheck, User } from "lucide-react";

type AuthStatus = "loading" | "generating_proof" | "success" | "error";

function CallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [status, setStatus] = useState<AuthStatus>("loading");
    const [message, setMessage] = useState("Initializing secure login...");
    const [zkLoginAddress, setZkLoginAddress] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // 1. Extract ID token from URL hash (OIDC implicit flow)
                const hash = window.location.hash.substring(1);
                const params = new URLSearchParams(hash);
                let idToken = params.get("id_token");

                // Also check query params as fallback
                if (!idToken) {
                    idToken = searchParams.get("id_token");
                }

                if (!idToken) {
                    setStatus("error");
                    setError("No authentication token received. Please try again.");
                    return;
                }

                // 2. Generate ZK proof
                setStatus("generating_proof");
                setMessage("Generating zero-knowledge proof...");

                const result = await completeZkLoginCallback(idToken);

                // 3. Success!
                setZkLoginAddress(result.zkLoginAddress);
                setStatus("success");
                setMessage("Authentication successful!");

                // 4. Redirect after short delay
                setTimeout(() => {
                    router.push("/dashboard");
                }, 2000);

            } catch (err: any) {
                console.error("[zkLogin] Callback error:", err);
                setStatus("error");
                setError(err.message || "Authentication failed. Please try again.");
            }
        };

        handleCallback();
    }, [router, searchParams]);

    return (
        <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-6">
            {/* Background effects */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full opacity-40" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 blur-[120px] rounded-full opacity-30" />
            </div>

            <div className="relative z-10 max-w-md w-full">
                {/* Status Card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center">
                    {/* Icon */}
                    <div className="mb-6">
                        {status === "loading" && (
                            <div className="w-20 h-20 mx-auto rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                            </div>
                        )}
                        {status === "generating_proof" && (
                            <div className="w-20 h-20 mx-auto rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center relative">
                                <ShieldCheck className="w-10 h-10 text-indigo-400" />
                                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/50 border-t-transparent animate-spin" />
                            </div>
                        )}
                        {status === "success" && (
                            <div className="w-20 h-20 mx-auto rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center animate-in zoom-in duration-300">
                                <CheckCircle className="w-10 h-10 text-green-400" />
                            </div>
                        )}
                        {status === "error" && (
                            <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <XCircle className="w-10 h-10 text-red-400" />
                            </div>
                        )}
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl font-bold mb-2">
                        {status === "loading" && "Processing Login"}
                        {status === "generating_proof" && "Generating Proof"}
                        {status === "success" && "Welcome!"}
                        {status === "error" && "Authentication Failed"}
                    </h1>

                    {/* Message */}
                    <p className="text-gray-400 mb-6">{error || message}</p>

                    {/* zkLogin Address (on success) */}
                    {status === "success" && zkLoginAddress && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 mb-6">
                            <div className="flex items-center justify-center gap-2 mb-2">
                                <User size={14} className="text-green-400" />
                                <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Your zkLogin Address</span>
                            </div>
                            <p className="font-mono text-xs text-green-300 break-all">{zkLoginAddress}</p>
                        </div>
                    )}

                    {/* Progress Steps */}
                    {(status === "loading" || status === "generating_proof") && (
                        <div className="space-y-3 text-left">
                            <div className={`flex items-center gap-3 p-3 rounded-xl transition-all ${status !== "loading" ? "bg-green-500/10 border border-green-500/20" : "bg-blue-500/10 border border-blue-500/20"}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${status !== "loading" ? "bg-green-500 text-white" : "bg-blue-500/50 text-blue-200"}`}>
                                    {status !== "loading" ? "✓" : "1"}
                                </div>
                                <span className={`text-sm font-medium ${status !== "loading" ? "text-green-300" : "text-blue-300"}`}>
                                    Validating OAuth Token
                                </span>
                            </div>
                            <div className={`flex items-center gap-3 p-3 rounded-xl transition-all ${status === "generating_proof" ? "bg-indigo-500/10 border border-indigo-500/20" : "bg-white/5 border border-white/5"}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${status === "generating_proof" ? "bg-indigo-500/50 text-indigo-200" : "bg-white/10 text-gray-500"}`}>
                                    2
                                </div>
                                <span className={`text-sm font-medium ${status === "generating_proof" ? "text-indigo-300" : "text-gray-500"}`}>
                                    Generating Zero-Knowledge Proof
                                </span>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-white/10 text-gray-500">3</div>
                                <span className="text-sm font-medium text-gray-500">Deriving Sui Address</span>
                            </div>
                        </div>
                    )}

                    {/* Retry button (on error) */}
                    {status === "error" && (
                        <button
                            onClick={() => router.push("/")}
                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg shadow-blue-500/20"
                        >
                            Try Again
                        </button>
                    )}
                </div>

                {/* Security Note */}
                <div className="mt-6 text-center text-xs text-gray-500">
                    <ShieldCheck size={12} className="inline mr-1" />
                    Secured by zkLogin on Sui
                </div>
            </div>
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

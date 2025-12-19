"use client";

import { useState, useEffect } from "react";
import Scanner from "@/components/Scanner";
import { uploadToWalrus } from "@/lib/walrus";
import { TARGETS, isContractConfigured, TEE_CONFIG_ID, ALUMNI_AJO_ID } from "@/lib/contract";
import { TEE_WORKER_URL } from "@/config";
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Volume2, FileText, ArrowRight, X, Loader2, CheckCircle2, User, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { isZkLoginSessionValid, getZkLoginAddress, executeSponsoredZkLoginTransaction } from "@/utils/zklogin-proof";

// Attestation data from TEE
interface Attestation {
    signature: number[];
    publicKey: number[];
    message: number[];
    handoutId: string;
    blobId: string;
}

export default function ScanPage() {
    // dapp-kit wallet state
    const dappKitAccount = useCurrentAccount();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();

    // zkLogin state
    const [zkLoginAddress, setZkLoginAddress] = useState<string | null>(null);
    const [isZkLogin, setIsZkLogin] = useState(false);

    // UI state
    const [text, setText] = useState<string>("");
    const [blobId, setBlobId] = useState<string>("");
    const [handoutId, setHandoutId] = useState<string>("");
    const [uploading, setUploading] = useState(false);
    const [txDigest, setTxDigest] = useState<string>("");
    const [teeStatus, setTeeStatus] = useState<"idle" | "verifying" | "attestation_ready" | "submitting" | "verified" | "failed">("idle");
    const [attestation, setAttestation] = useState<Attestation | null>(null);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

    // Check for zkLogin session on mount
    useEffect(() => {
        if (isZkLoginSessionValid()) {
            const addr = getZkLoginAddress();
            setZkLoginAddress(addr);
            setIsZkLogin(true);
        }
    }, []);

    useEffect(() => {
        const loadVoices = () => {
            const vs = window.speechSynthesis.getVoices();
            setVoices(vs);
            const naija = vs.find(v => v.lang === 'en-NG') || vs.find(v => v.lang.includes('en-GB'));
            if (naija) setSelectedVoice(naija);
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }, []);

    // Determine which wallet to use
    const activeAddress = isZkLogin ? zkLoginAddress : dappKitAccount?.address;
    const isConnected = !!activeAddress;

    const handleSpeak = () => {
        if (!text) return;
        const utterance = new SpeechSynthesisUtterance(text);
        if (selectedVoice) utterance.voice = selectedVoice;
        window.speechSynthesis.speak(utterance);
    };

    // Get attestation from TEE
    const getAttestation = async (blobIdParam: string, handoutObjectId: string) => {
        setTeeStatus("verifying");
        try {
            const teeResponse = await fetch(`${TEE_WORKER_URL}/api/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    blobId: blobIdParam,
                    handoutId: handoutObjectId
                })
            });

            const teeResult = await teeResponse.json();

            if (teeResponse.ok && teeResult.status === 'attestation_ready') {
                console.log("[Scan] TEE attestation received:", teeResult);
                setAttestation(teeResult.attestation);
                setTeeStatus("attestation_ready");
            } else {
                console.error("[Scan] TEE verification failed:", teeResult);
                setTeeStatus("failed");
            }
        } catch (err) {
            console.error("[Scan] TEE Error:", err);
            setTeeStatus("failed");
        }
    };

    // Submit attestation to contract
    const submitAttestation = async () => {
        if (!attestation || !handoutId) return;
        setTeeStatus("submitting");

        try {
            const tx = new Transaction();
            tx.moveCall({
                target: TARGETS.verify_with_attestation,
                arguments: [
                    tx.object(TEE_CONFIG_ID),
                    tx.object(handoutId),
                    tx.object(ALUMNI_AJO_ID),
                    tx.pure.vector("u8", attestation.signature),
                    tx.pure.vector("u8", attestation.message),
                ],
            });

            if (isZkLogin) {
                console.log("[Scan] Submitting attestation with zkLogin (sponsored)...");
                const result = await executeSponsoredZkLoginTransaction(tx);
                console.log("[Scan] Verification complete:", result.digest);
                setTeeStatus("verified");
            } else {
                console.log("[Scan] Submitting attestation with dapp-kit...");
                signAndExecute(
                    { transaction: tx },
                    {
                        onSuccess: (result) => {
                            console.log("[Scan] Verification complete:", result.digest);
                            setTeeStatus("verified");
                        },
                        onError: (err) => {
                            console.error("[Scan] Attestation submission error:", err);
                            setTeeStatus("failed");
                        }
                    }
                );
            }
        } catch (e: any) {
            console.error("[Scan] Submit error:", e);
            setTeeStatus("failed");
        }
    };

    // Parse handout object ID from transaction result
    const parseHandoutObjectId = (result: any): string | null => {
        if (result.objectChanges) {
            const createdObjects = result.objectChanges.filter(
                (change: any) => change.type === 'created'
            );
            if (createdObjects.length > 0) {
                console.log("[Scan] Created handout object:", createdObjects[0].objectId);
                return createdObjects[0].objectId;
            }
        }
        if (result.events) {
            const mintEvent = result.events.find(
                (e: any) => e.type?.includes('HandoutMinted')
            );
            if (mintEvent?.parsedJson?.id) {
                console.log("[Scan] Parsed handout ID from event:", mintEvent.parsedJson.id);
                return mintEvent.parsedJson.id;
            }
        }
        return null;
    };

    const handleUploadAndMint = async () => {
        if (!text || !isConnected) return;
        setUploading(true);
        setTeeStatus("idle");
        setAttestation(null);

        try {
            // 1. Upload to Walrus
            const blob = new Blob([text], { type: "text/plain" });
            const id = await uploadToWalrus(blob);
            setBlobId(id);
            console.log("[Scan] Uploaded to Walrus:", id);

            // 2. Build mint transaction
            const tx = new Transaction();
            tx.moveCall({
                target: TARGETS.mint_handout,
                arguments: [
                    tx.pure.vector("u8", Array.from(new TextEncoder().encode(id))),
                    tx.pure.vector("u8", Array.from(new TextEncoder().encode(`Scanned: ${text.slice(0, 20)}...`))),
                ],
            });

            // 3. Execute based on auth method
            if (isZkLogin) {
                console.log("[Scan] Executing with zkLogin (sponsored)...");
                const result = await executeSponsoredZkLoginTransaction(tx);
                setTxDigest(result.digest);
                console.log("[Scan] Minted on-chain (zkLogin):", result.digest);

                const objectId = parseHandoutObjectId(result);
                if (objectId) {
                    setHandoutId(objectId);
                    await getAttestation(id, objectId);
                } else {
                    console.warn("[Scan] Could not find handout object ID");
                }
                setUploading(false);
            } else {
                console.log("[Scan] Executing with dapp-kit wallet...");
                signAndExecute(
                    { transaction: tx },
                    {
                        onSuccess: async (result) => {
                            setTxDigest(result.digest);
                            console.log("[Scan] Minted on-chain (dapp-kit):", result.digest);

                            const objectId = parseHandoutObjectId(result);
                            if (objectId) {
                                setHandoutId(objectId);
                                await getAttestation(id, objectId);
                            } else {
                                console.warn("[Scan] Could not find handout object ID");
                            }
                            setUploading(false);
                        },
                        onError: (err) => {
                            console.error("[Scan] Mint error:", err);
                            setUploading(false);
                            alert("On-chain minting failed.");
                        }
                    }
                );
            }
        } catch (e: any) {
            console.error("[Scan] Error:", e);
            alert(`Error: ${e.message || "Unknown error"}`);
            setUploading(false);
        }
    };

    const resetState = () => {
        setTxDigest("");
        setBlobId("");
        setHandoutId("");
        setTeeStatus("idle");
        setAttestation(null);
    };

    return (
        <div className="min-h-screen bg-[#0A0F1D] text-white p-6 md:p-10 font-sans">
            <header className="max-w-[1600px] mx-auto flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                    <Link href="/dashboard" className="px-4 py-2 bg-blue-500/10 rounded-xl flex items-center gap-2 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all font-bold text-sm">
                        ← Dashboard
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Scan Handouts</h1>
                        <p className="text-sm text-gray-400">Align document within frame</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {isZkLogin && zkLoginAddress && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                            <User size={16} className="text-blue-400" />
                            <span className="text-xs text-blue-400 font-mono">
                                {zkLoginAddress.slice(0, 6)}...{zkLoginAddress.slice(-4)}
                            </span>
                            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded uppercase font-bold">zkLogin</span>
                        </div>
                    )}
                    {!isZkLogin && (
                        <ConnectButton className="!bg-gray-800 !text-white !font-bold !rounded-xl" />
                    )}
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto grid lg:grid-cols-12 gap-8 items-start">

                {/* Left: Scanner */}
                <div className="lg:col-span-8">
                    <Scanner onScan={setText} />
                </div>

                {/* Right: Status & Output */}
                <div className="lg:col-span-4 space-y-6">

                    {/* Status Card */}
                    <div className="glass-card p-6 rounded-3xl relative overflow-hidden">
                        {/* Success overlay */}
                        {teeStatus === "verified" && (
                            <div className="absolute inset-0 bg-green-500/10 backdrop-blur flex flex-col items-center justify-center z-10 p-6 text-center animate-in fade-in duration-500">
                                <ShieldCheck size={48} className="text-green-400 mb-4" />
                                <h3 className="text-xl font-bold mb-2">Verified by TEE!</h3>
                                <p className="text-xs text-green-300 font-mono mb-6 break-all">{txDigest}</p>
                                <Link href={`/reader?blobId=${blobId}`} className="w-full py-3 bg-green-500 text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-green-400 transition-colors">
                                    Open in Reader <ArrowRight size={16} />
                                </Link>
                                <button onClick={resetState} className="mt-4 text-xs text-gray-400 underline uppercase tracking-widest font-bold">Scan Another</button>
                            </div>
                        )}

                        {/* Attestation ready overlay */}
                        {teeStatus === "attestation_ready" && attestation && (
                            <div className="absolute inset-0 bg-blue-500/10 backdrop-blur flex flex-col items-center justify-center z-10 p-6 text-center animate-in fade-in duration-500">
                                <CheckCircle2 size={48} className="text-blue-400 mb-4" />
                                <h3 className="text-xl font-bold mb-2">Content Verified!</h3>
                                <p className="text-sm text-blue-300 mb-6">TEE has verified your handout. Click below to complete verification on-chain.</p>
                                <button
                                    onClick={submitAttestation}
                                    className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-400 transition-colors"
                                >
                                    <ShieldCheck size={18} /> Complete Verification
                                </button>
                                <Link href={`/reader?blobId=${blobId}`} className="mt-3 text-xs text-gray-400 underline">View without verifying</Link>
                            </div>
                        )}

                        {/* Submitting overlay */}
                        {teeStatus === "submitting" && (
                            <div className="absolute inset-0 bg-blue-500/10 backdrop-blur flex flex-col items-center justify-center z-10 p-6 text-center">
                                <Loader2 size={48} className="text-blue-400 mb-4 animate-spin" />
                                <h3 className="text-xl font-bold mb-2">Submitting to Chain...</h3>
                                <p className="text-sm text-gray-400">Please confirm the transaction in your wallet.</p>
                            </div>
                        )}

                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-300">OCR Hub</h3>
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-[10px] font-bold rounded uppercase border border-green-500/20 tracking-widest">Active</span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-6">
                            <div className="bg-black/40 rounded-2xl p-4 text-center border border-white/5">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Confidence</p>
                                <p className="text-2xl font-bold">98%</p>
                            </div>
                            <div className="bg-black/40 rounded-2xl p-4 text-center border border-white/5">
                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Est. Earn</p>
                                <p className="text-2xl font-bold text-green-400">+0.5 SUI</p>
                            </div>
                        </div>
                    </div>

                    {/* Preview Card */}
                    <div className="glass-card p-6 rounded-3xl min-h-[300px] flex flex-col border border-white/5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-300">Live Preview</h3>
                            <Volume2 size={16}
                                className={`cursor-pointer hover:text-white transition-colors ${!text ? 'text-gray-600' : 'text-green-400'}`}
                                onClick={handleSpeak}
                            />
                        </div>

                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Scanned text will appear here..."
                            className="flex-1 w-full bg-transparent border-none text-green-300 font-mono text-sm resize-none focus:outline-none placeholder:text-gray-700/50 p-0 leading-relaxed scrollbar-hide"
                        />

                        <div className="mt-4 pt-4 border-t border-white/5 flex gap-3">
                            <button
                                onClick={handleUploadAndMint}
                                disabled={!text || !isConnected || uploading || !isContractConfigured()}
                                className="flex-1 py-4 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-green-500/20"
                            >
                                {uploading ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : teeStatus === "verifying" ? (
                                    <>Verifying... <Loader2 className="animate-spin" size={16} /></>
                                ) : (
                                    <>Confirm & Mint <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
                                )}
                            </button>
                            <button onClick={() => setText("")} className="px-5 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-sm transition-colors border border-white/5">
                                <X size={16} />
                            </button>
                        </div>

                        {!isConnected && (
                            <p className="text-xs text-yellow-500 text-center mt-3">
                                Connect a wallet to mint handouts.
                            </p>
                        )}

                        {!isContractConfigured() && (
                            <p className="text-xs text-yellow-500 text-center mt-3">
                                ⚠️ Package ID not configured.
                            </p>
                        )}

                        {teeStatus === "failed" && (
                            <p className="text-xs text-red-400 text-center mt-3">
                                ❌ TEE verification failed. Try again.
                            </p>
                        )}

                        {blobId && teeStatus === "idle" && (
                            <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between">
                                <span className="text-[10px] text-gray-500 font-mono truncate mr-4">ID: {blobId}</span>
                                <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full uppercase font-bold border border-blue-500/20">Saved to Walrus</span>
                            </div>
                        )}
                    </div>

                </div>
            </main>
        </div>
    );
}

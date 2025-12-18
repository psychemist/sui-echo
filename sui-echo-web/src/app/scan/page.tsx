"use client";

import { useState, useEffect } from "react";
import Scanner from "@/components/Scanner";
import { uploadToWalrus } from "@/lib/walrus";
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Volume2, Upload, FileText, ArrowRight, X, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

// Package ID should be updated after deployment
const PACKAGE_ID = "0x...";
const TEE_WORKER_URL = "http://localhost:3001";

export default function ScanPage() {
    const account = useCurrentAccount();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();

    const [text, setText] = useState<string>("");
    const [blobId, setBlobId] = useState<string>("");
    const [uploading, setUploading] = useState(false);
    const [txDigest, setTxDigest] = useState<string>("");
    const [teeStatus, setTeeStatus] = useState<"idle" | "verifying" | "done" | "failed">("idle");
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

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

    const handleSpeak = () => {
        if (!text) return;
        const utterance = new SpeechSynthesisUtterance(text);
        if (selectedVoice) utterance.voice = selectedVoice;
        window.speechSynthesis.speak(utterance);
    };

    const handleUploadAndMint = async () => {
        if (!text || !account) return;
        setUploading(true);
        try {
            // 1. Upload to Walrus
            const blob = new Blob([text], { type: "text/plain" });
            const id = await uploadToWalrus(blob);
            setBlobId(id);

            // 2. Mint Handout on Sui
            const tx = new Transaction();
            tx.moveCall({
                target: `${PACKAGE_ID}::echo::mint_handout`,
                arguments: [
                    tx.pure.vector("u8", Array.from(new TextEncoder().encode(id))),
                    tx.pure.vector("u8", Array.from(new TextEncoder().encode(`Scanned: ${text.slice(0, 20)}...`))),
                ],
            });

            signAndExecute(
                { transaction: tx },
                {
                    onSuccess: async (result) => {
                        setTxDigest(result.digest);

                        // Notify user of minting success
                        console.log("Minted on-chain:", result.digest);

                        // Trigger Nautilus TEE Verification (Phase 3)
                        setTeeStatus("verifying");
                        try {
                            // In a real TEE, the handoutId would comes from the tx result events
                            // For MVP, we pass the digest or look up the object. 
                            // Here we assume the TEE can find the handout.
                            await fetch(`${TEE_WORKER_URL}/verify`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ blobId: id, handoutId: result.digest }) // ID placeholder
                            });
                            setTeeStatus("done");
                        } catch (err) {
                            console.error("TEE Error:", err);
                            setTeeStatus("failed");
                        }

                        setUploading(false);
                    },
                    onError: (err) => {
                        console.error("Mint error:", err);
                        setUploading(false);
                        alert("On-chain minting failed, but saved to Walrus.");
                    }
                }
            );

        } catch (e) {
            console.error(e);
            alert("Upload failed. See console.");
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0F1D] text-white p-6 md:p-10 font-sans">
            <header className="max-w-[1600px] mx-auto flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                    <Link href="/" className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20 text-green-400 hover:scale-105 transition-transform">
                        <FileText />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Scan Handouts</h1>
                        <p className="text-sm text-gray-400">Align document within frame</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <ConnectButton className="!bg-gray-800 !text-white !font-bold !rounded-xl" />
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
                        {txDigest && (
                            <div className="absolute inset-0 bg-green-500/10 backdrop-blur flex flex-col items-center justify-center z-10 p-6 text-center animate-in fade-in duration-500">
                                <CheckCircle2 size={48} className="text-green-400 mb-4" />
                                <h3 className="text-xl font-bold mb-2">Minted Successfully!</h3>
                                <p className="text-xs text-green-300 font-mono mb-6 break-all">{txDigest}</p>
                                <Link href={`/reader?blobId=${blobId}`} className="w-full py-3 bg-green-500 text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-green-400 transition-colors">
                                    Open in Reader <ArrowRight size={16} />
                                </Link>
                                <button onClick={() => setTxDigest("")} className="mt-4 text-xs text-gray-400 underline uppercase tracking-widest font-bold">Scan Another</button>
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
                                disabled={!text || !account || uploading}
                                className="flex-1 py-4 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-green-500/20"
                            >
                                {uploading ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <>Confirm & Mint <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>
                                )}
                            </button>
                            <button onClick={() => setText("")} className="px-5 py-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-sm transition-colors border border-white/5">
                                <X size={16} />
                            </button>
                        </div>

                        {blobId && !txDigest && (
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

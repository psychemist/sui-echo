"use client";

import { useState, useEffect } from "react";
import Scanner from "@/components/Scanner";
import { uploadToWalrus } from "@/lib/walrus";
import { ConnectButton, useCurrentAccount } from "@mysten/dapp-kit";
import { Volume2, Upload, FileText, ArrowRight, X } from "lucide-react";

export default function ScanPage() {
    const account = useCurrentAccount();
    const [text, setText] = useState<string>("");
    const [blobId, setBlobId] = useState<string>("");
    const [uploading, setUploading] = useState(false);
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

    const handleUpload = async () => {
        if (!text) return;
        setUploading(true);
        try {
            const blob = new Blob([text], { type: "text/plain" });
            const id = await uploadToWalrus(blob);
            setBlobId(id);
            alert(`Saved to Walrus! Blob ID: ${id}`);
        } catch (e) {
            console.error(e);
            alert("Upload failed. See console.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0F1D] text-white p-6 md:p-10 font-sans">
            <header className="max-w-[1600px] mx-auto flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20 text-green-400">
                        <FileText />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold">Scan Handouts</h1>
                        <p className="text-sm text-gray-400">Align document within frame</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="px-4 py-2 bg-green-900/20 text-green-400 text-xs font-bold rounded-full border border-green-500/20 flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Ensure even lighting
                    </div>
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
                    <div className="glass-card p-6 rounded-3xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold">OCR Status</h3>
                            <span className="px-2 py-1 bg-green-500 text-black text-[10px] font-bold rounded uppercase">Active</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-1.5 mb-2 overflow-hidden">
                            <div className="bg-green-500 w-[84%] h-full rounded-full"></div>
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
                    <div className="glass-card p-6 rounded-3xl min-h-[300px] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold">Live Text Preview</h3>
                            <Volume2 size={16}
                                className={`cursor-pointer hover:text-white transition-colors ${!text ? 'text-gray-600' : 'text-green-400'}`}
                                onClick={handleSpeak}
                            />
                        </div>

                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Scanned text will appear here..."
                            className="flex-1 w-full bg-transparent border-none text-green-300 font-mono text-sm resize-none focus:outline-none placeholder:text-gray-700/50 p-0 leading-relaxed"
                        />

                        <div className="mt-4 pt-4 border-t border-white/5 flex gap-3">
                            <button
                                onClick={handleUpload}
                                disabled={!text || !account || uploading}
                                className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-400 text-black font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {uploading ? "Uploading..." : "Confirm & Upload"} <ArrowRight size={16} />
                            </button>
                            <button onClick={() => setText("")} className="px-4 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-sm transition-colors border border-white/5">
                                <X size={16} />
                            </button>
                        </div>

                        {blobId && (
                            <div className="mt-2 text-[10px] text-gray-500 break-all">
                                ID: {blobId}
                            </div>
                        )}
                    </div>

                </div>
            </main>
        </div>
    );
}

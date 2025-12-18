"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Play, Pause, SkipBack, SkipForward, Users, Volume2, Mic, FileText, Loader2 } from "lucide-react";
import { getWalrusUrl } from "@/lib/walrus";

function ReaderContent() {
    const searchParams = useSearchParams();
    const [playing, setPlaying] = useState(false);
    const [text, setText] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [speed, setSpeed] = useState(1);

    const blobId = searchParams.get("blobId");
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Initial load from Walrus
    useEffect(() => {
        if (!blobId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const url = getWalrusUrl(blobId);
                const response = await fetch(url);
                if (response.ok) {
                    const content = await response.text();
                    setText(content);
                }
            } catch (err) {
                console.error("Failed to fetch from Walrus:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [blobId]);

    // TTS Control
    useEffect(() => {
        if (!text) return;

        // Cleanup previous utterance
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = speed;
        utterance.onend = () => setPlaying(false);
        utterance.onboundary = (event) => {
            // Estimate progress based on character index
            const prog = (event.charIndex / text.length) * 100;
            setProgress(prog);
            setCurrentTime(event.charIndex); // Rough approximation of time in chars
        };

        utteranceRef.current = utterance;
        setDuration(text.length);

        return () => {
            window.speechSynthesis.cancel();
        };
    }, [text, speed]);

    const togglePlay = () => {
        if (playing) {
            window.speechSynthesis.pause();
        } else {
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            } else if (utteranceRef.current) {
                window.speechSynthesis.speak(utteranceRef.current);
            }
        }
        setPlaying(!playing);
    };

    const adjustSpeed = () => {
        const speeds = [1, 1.25, 1.5, 2];
        const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
        setSpeed(next);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0A0F1D] text-white flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-green-500 animate-spin mb-4" />
                <p className="text-gray-400 font-bold tracking-widest uppercase">Fetching from Walrus...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0A0F1D] text-white flex items-center justify-center p-6">
            <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-16 items-center">

                {/* Left: Album/Book Art */}
                <div className="aspect-square rounded-[3rem] bg-gradient-to-br from-green-800 to-emerald-900 border border-white/5 shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-emerald-700/50 rounded-full blur-3xl animate-pulse"></div>

                    <div className="absolute top-6 right-6 px-3 py-1 bg-black/40 backdrop-blur rounded-full text-[10px] font-bold tracking-widest uppercase border border-white/10">Verifying...</div>

                    <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-24 h-32 bg-white/10 backdrop-blur rounded-xl border border-white/20 mb-6 flex items-center justify-center">
                            <FileText size={48} className="text-green-400" />
                        </div>
                        <h3 className="text-xl font-bold text-green-100">{blobId ? `Handout: ${blobId.slice(0, 8)}...` : "No Handout Selected"}</h3>
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="space-y-10">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-2">Sui-Echo Reader</h1>
                        <p className="text-gray-400 text-xl">Listen to your study materials verifiably.</p>
                        <div className="flex items-center gap-2 mt-4 text-green-400 font-medium">
                            <Mic size={16} /> Mode: AI Voice Optimization
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="group">
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-green-500 rounded-full relative transition-all duration-300" style={{ width: `${progress}%` }}>
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 font-mono font-bold">
                            <span>{Math.round(progress)}% done</span>
                            <span>{text.length} chars</span>
                        </div>
                    </div>

                    {/* Main Controls */}
                    <div className="flex items-center justify-between">
                        <button className="text-gray-500 hover:text-white transition-colors flex flex-col items-center gap-1 text-[10px] font-bold">
                            <SkipBack size={24} />
                            Restart
                        </button>

                        <button
                            onClick={togglePlay}
                            disabled={!text}
                            className="w-24 h-24 rounded-full bg-green-500 hover:bg-green-400 text-black flex items-center justify-center shadow-[0_0_50px_-10px_rgba(34,197,94,0.4)] transition-all hover:scale-105 disabled:opacity-50"
                        >
                            {playing ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-1" />}
                        </button>

                        <button className="text-gray-500 hover:text-white transition-colors flex flex-col items-center gap-1 text-[10px] font-bold">
                            <SkipForward size={24} />
                            Skip
                        </button>
                    </div>

                    {/* Settings Row */}
                    <div className="flex gap-4">
                        <button onClick={adjustSpeed} className="flex-1 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-bold flex items-center justify-center gap-2">
                            {speed}x <span className="text-gray-500 font-normal">Speed</span>
                        </button>
                        <button className="flex-1 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-bold flex items-center justify-center gap-2 text-green-400">
                            <Users size={16} /> Accent: en-NG
                        </button>
                    </div>

                    {/* Transcript Peek */}
                    <div className="p-6 bg-black/40 rounded-3xl border border-white/5 max-h-40 overflow-y-auto">
                        <p className="text-sm text-gray-500 leading-relaxed font-mono">
                            {text || "Waiting for content..."}
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}

export default function ReaderPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#0A0F1D] text-white flex flex-col items-center justify-center">
                <Loader2 className="w-12 h-12 text-green-500 animate-spin mb-4" />
                <p className="text-gray-400 font-bold tracking-widest uppercase">Initializing Reader...</p>
            </div>
        }>
            <ReaderContent />
        </Suspense>
    );
}

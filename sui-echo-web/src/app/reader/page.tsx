"use client";

import { useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Users, Settings, Mic } from "lucide-react";

export default function ReaderPage() {
    const [playing, setPlaying] = useState(false);

    return (
        <div className="min-h-screen bg-[#0A0F1D] text-white flex items-center justify-center p-6">
            <div className="max-w-6xl w-full grid lg:grid-cols-2 gap-16 items-center">

                {/* Left: Album/Book Art */}
                <div className="aspect-square rounded-[3rem] bg-gradient-to-br from-green-800 to-emerald-900 border border-white/5 shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                    {/* Abstract Geometric Shapes */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-emerald-700/50 rounded-full blur-3xl animate-pulse"></div>

                    <div className="absolute top-6 right-6 px-3 py-1 bg-black/40 backdrop-blur rounded-full text-[10px] font-bold tracking-widest uppercase border border-white/10">Handout</div>

                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-1/2 h-full bg-emerald-950/30 transform skew-x-12"></div>
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="space-y-10">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-2">GST 101: Philosophy & Logic</h1>
                        <p className="text-gray-400 text-xl">Handout 1: Introduction to Fallacies</p>
                        <div className="flex items-center gap-2 mt-4 text-green-400 font-medium">
                            <Mic size={16} /> Read by: Chinedu O.
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="group">
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                            <div className="h-full w-1/3 bg-green-500 rounded-full relative">
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            </div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 font-mono font-bold">
                            <span>04:20</span>
                            <span>15:00</span>
                        </div>
                    </div>

                    {/* Main Controls */}
                    <div className="flex items-center justify-between">
                        <button className="text-gray-500 hover:text-white transition-colors flex flex-col items-center gap-1 text-[10px] font-bold">
                            <SkipBack size={24} />
                            -15s
                        </button>

                        <button
                            onClick={() => setPlaying(!playing)}
                            className="w-24 h-24 rounded-full bg-green-500 hover:bg-green-400 text-black flex items-center justify-center shadow-[0_0_50px_-10px_rgba(34,197,94,0.4)] transition-all hover:scale-105"
                        >
                            {playing ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-1" />}
                        </button>

                        <button className="text-gray-500 hover:text-white transition-colors flex flex-col items-center gap-1 text-[10px] font-bold">
                            <SkipForward size={24} />
                            +15s
                        </button>
                    </div>

                    {/* Settings Row */}
                    <div className="flex gap-4">
                        <button className="flex-1 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-bold flex items-center justify-center gap-2">
                            1.0x <span className="text-gray-500 font-normal">Speed</span>
                        </button>
                        <button className="flex-1 py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-bold flex items-center justify-center gap-2 text-green-400">
                            <Users size={16} /> Accent: en-NG
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

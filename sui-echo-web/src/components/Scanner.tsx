"use client";
import React, { useRef, useState, useCallback, useEffect } from "react";
// import Tesseract from "tesseract.js";
import { Camera, Zap, FileText } from "lucide-react";

export default function Scanner({ onScan }: { onScan: (text: string) => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [stream, setStream] = useState<MediaStream | null>(null);

    useEffect(() => {
        let currentStream: MediaStream | null = null;
        const startCamera = async () => {
            try {
                const s = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" },
                    audio: false
                });
                setStream(s);
                currentStream = s;
                if (videoRef.current) {
                    videoRef.current.srcObject = s;
                }
            } catch (err) {
                console.error("Camera error:", err);
            }
        };

        startCamera();

        return () => {
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const capture = useCallback(() => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageSrc = canvas.toDataURL("image/jpeg");

                setScanning(true);
                setProgress(0);

                /*
                Tesseract.recognize(
                    imageSrc,
                    'eng',
                    {
                        logger: m => {
                            if (m.status === 'recognizing text') {
                                setProgress(m.progress);
                            }
                        }
                    }
                ).then(({ data: { text } }) => {
                    setScanning(false);
                    onScan(text);
                }).catch(err => {
                    console.error(err);
                    setScanning(false);
                });
                */
                setTimeout(() => {
                    setScanning(false);
                    onScan("Mock Scanned Text to debug build.");
                }, 1000);
            }
        }
    }, [onScan]);

    return (
        <div className="relative w-full h-[600px] bg-black rounded-[3rem] overflow-hidden border-8 border-gray-800 shadow-2xl group">
            {/* Native Video Element */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            />
            {/* Hidden Canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Overlay UI */}
            <div className="absolute inset-0 pointer-events-none">
                {/* Corners */}
                <div className="absolute top-12 left-12 w-16 h-16 border-t-4 border-l-4 border-blue-500 rounded-tl-3xl"></div>
                <div className="absolute top-12 right-12 w-16 h-16 border-t-4 border-r-4 border-blue-500 rounded-tr-3xl"></div>
                <div className="absolute bottom-12 left-12 w-16 h-16 border-b-4 border-l-4 border-blue-500 rounded-bl-3xl"></div>
                <div className="absolute bottom-12 right-12 w-16 h-16 border-b-4 border-r-4 border-blue-500 rounded-br-3xl"></div>

                {/* Scan Line */}
                {scanning && <div className="absolute top-0 left-0 w-full h-1 bg-blue-400 shadow-[0_0_20px_rgba(59,130,246,1)] animate-scan"></div>}

                {/* Center Crosshair */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 opacity-50">
                    <div className="absolute top-1/2 w-full h-0.5 bg-white"></div>
                    <div className="absolute left-1/2 h-full w-0.5 bg-white"></div>
                </div>
            </div>

            {/* Controls */}
            <div className="absolute bottom-8 left-0 w-full flex justify-center items-center gap-8 z-20">
                <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gray-900/50 backdrop-blur border border-white/10 flex items-center justify-center">
                        <Zap size={16} />
                    </div>
                    <span className="text-[0.6rem] font-bold tracking-widest uppercase">Switch</span>
                </button>

                <button
                    onClick={capture}
                    disabled={scanning}
                    className="w-20 h-20 rounded-full border-4 border-white/20 bg-blue-600 hover:bg-blue-500 hover:scale-105 transition-all flex items-center justify-center shadow-[0_0_40px_-5px_rgba(37,99,235,0.6)]"
                >
                    <Camera size={32} strokeWidth={2} className="text-white" />
                </button>

                <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gray-900/50 backdrop-blur border border-white/10 flex items-center justify-center">
                        <FileText size={16} />
                    </div>
                    <span className="text-[0.6rem] font-bold tracking-widest uppercase">Upload</span>
                </button>
            </div>

            {/* Progress Overlay */}
            {scanning && (
                <div className="absolute top-8 right-8 bg-gray-900/80 backdrop-blur px-4 py-2 rounded-full border border-green-500/30 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-bold text-green-400">Processing... {Math.round(progress * 100)}%</span>
                </div>
            )}
        </div>
    );
}

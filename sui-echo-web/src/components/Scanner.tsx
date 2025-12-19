"use client";
import React, { useRef, useState, useCallback, useEffect, ChangeEvent } from "react";
import { Camera, Zap, FileText, Loader2, RefreshCcw } from "lucide-react";

interface ScannerProps {
    onScan: (text: string) => void;
}

export default function Scanner({ onScan }: ScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [scanning, setScanning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
    const [cameraError, setCameraError] = useState<string | null>(null);

    useEffect(() => {
        let currentStream: MediaStream | null = null;
        const startCamera = async () => {
            // Stop existing stream first
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }

            try {
                setCameraError(null);
                const s = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode },
                    audio: false
                });
                setStream(s);
                currentStream = s;
                if (videoRef.current) {
                    videoRef.current.srcObject = s;
                }
            } catch (err: any) {
                console.error("Camera error:", err);
                setCameraError(err.message || "Could not access camera. Try uploading an image instead.");
            }
        };

        startCamera();

        return () => {
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
            }
        };
    }, [facingMode]);

    const handleSwitchCamera = () => {
        setFacingMode(prev => prev === "environment" ? "user" : "environment");
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert("Please upload an image file (PNG, JPG, etc.)");
            return;
        }

        setScanning(true);
        setProgress(0);

        try {
            // Create an image from the file
            const imageSrc = await fileToDataURL(file);

            // Perform OCR
            const Tesseract = (await import("tesseract.js")).default;
            const { data: { text } } = await Tesseract.recognize(
                imageSrc,
                'eng',
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            setProgress(m.progress);
                        }
                    }
                }
            );

            setScanning(false);
            onScan(text);
        } catch (err) {
            console.error("OCR Error:", err);
            setScanning(false);
            onScan("Error recognizing text. Please try again.");
        }

        // Reset input
        if (e.target) e.target.value = '';
    };

    const fileToDataURL = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const capture = useCallback(async () => {
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

                try {
                    const Tesseract = (await import("tesseract.js")).default;

                    const { data: { text } } = await Tesseract.recognize(
                        imageSrc,
                        'eng',
                        {
                            logger: m => {
                                if (m.status === 'recognizing text') {
                                    setProgress(m.progress);
                                }
                            }
                        }
                    );

                    setScanning(false);
                    onScan(text);
                } catch (err) {
                    console.error("OCR Error:", err);
                    setScanning(false);
                    onScan("Error recognizing text. Please try again.");
                }
            }
        }
    }, [onScan]);

    return (
        <div className="relative w-full h-[600px] bg-black rounded-[3rem] overflow-hidden border-8 border-gray-800 shadow-2xl group">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
            />

            {/* Camera View or Error */}
            {cameraError ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 p-8 text-center">
                    <Camera size={48} className="text-gray-600 mb-4" />
                    <p className="text-gray-400 mb-4">{cameraError}</p>
                    <button
                        onClick={handleUploadClick}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors"
                    >
                        Upload Image Instead
                    </button>
                </div>
            ) : (
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
            )}

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
                <button
                    onClick={handleSwitchCamera}
                    disabled={scanning || !!cameraError}
                    className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors text-center disabled:opacity-50"
                >
                    <div className="w-10 h-10 rounded-full bg-gray-900/50 backdrop-blur border border-white/10 flex items-center justify-center">
                        <RefreshCcw size={16} />
                    </div>
                    <span className="text-[0.6rem] font-bold tracking-widest uppercase">Switch</span>
                </button>

                <button
                    onClick={capture}
                    disabled={scanning || !!cameraError}
                    className="w-20 h-20 rounded-full border-4 border-white/20 bg-blue-600 hover:bg-blue-500 hover:scale-105 transition-all flex items-center justify-center shadow-[0_0_40px_-5px_rgba(37,99,235,0.6)] disabled:opacity-50 disabled:hover:scale-100"
                >
                    {scanning ? (
                        <Loader2 size={32} className="text-white animate-spin" />
                    ) : (
                        <Camera size={32} strokeWidth={2} className="text-white" />
                    )}
                </button>

                <button
                    onClick={handleUploadClick}
                    disabled={scanning}
                    className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition-colors text-center disabled:opacity-50"
                >
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

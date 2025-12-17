"use client";
import React, { useState, useRef } from "react";
import { Mic, Square, Play, RotateCcw } from "lucide-react";

export default function VoiceRecorder({ onRecordingComplete }: { onRecordingComplete: (blob: Blob) => void }) {
    const [isRecording, setIsRecording] = useState(false);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: "audio/webm" });
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                onRecordingComplete(blob);
                chunksRef.current = [];
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            // Stop all tracks
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    return (
        <div className="flex flex-col items-center gap-4 p-4 border rounded-xl bg-gray-50">
            <div className="flex gap-4">
                {!isRecording ? (
                    <button
                        onClick={startRecording}
                        className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 font-bold shadow-lg transition-transform hover:scale-105"
                    >
                        <Mic /> Record
                    </button>
                ) : (
                    <button
                        onClick={stopRecording}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-full hover:bg-gray-800 font-bold animate-pulse"
                    >
                        <Square fill="white" size={16} /> Stop
                    </button>
                )}
            </div>

            {audioUrl && (
                <div className="flex items-center gap-3 mt-2 w-full">
                    <audio controls src={audioUrl} className="w-full" />
                    <button
                        onClick={() => { setAudioUrl(null); }}
                        className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"
                        title="Reset"
                    >
                        <RotateCcw size={18} />
                    </button>
                </div>
            )}
        </div>
    );
}

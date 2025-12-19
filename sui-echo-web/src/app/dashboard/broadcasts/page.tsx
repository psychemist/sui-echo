"use client";

import { useState, useEffect } from "react";
import VoiceRecorder from "@/components/VoiceRecorder";
import { Radio, ShieldCheck, Users, Link as IconLink, Upload, Loader2, RefreshCw, Play } from "lucide-react";
import { getSuiClient, getZkLoginAddress, isZkLoginSessionValid, executeSponsoredZkLoginTransaction } from "@/utils/zklogin-proof";
import { uploadToWalrus, getWalrusUrl } from "@/lib/walrus";
import { TARGETS, isContractConfigured } from "@/lib/contract";
import { SUI_NETWORK } from "@/config";
import { useRouter } from "next/navigation";
import { Transaction } from "@mysten/sui/transactions";

interface Broadcast {
    id: string;
    courseCode: string;
    audioBlobId: string;
    message: string;
    broadcaster: string;
    objectId: string;
}

interface BroadcastStats {
    totalBroadcasts: number;
    tokensEarned: string;
}

export default function BroadcastsPage() {
    const router = useRouter();
    const [courseCode, setCourseCode] = useState("");
    const [message, setMessage] = useState("");
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(true);
    const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
    const [stats, setStats] = useState<BroadcastStats>({
        totalBroadcasts: 0,
        tokensEarned: "0 SUI",
    });
    const [zkAddress, setZkAddress] = useState<string | null>(null);

    useEffect(() => {
        if (!isZkLoginSessionValid()) {
            router.push("/");
            return;
        }
        const address = getZkLoginAddress();
        setZkAddress(address);
        fetchBroadcasts(address);
    }, [router]);

    async function fetchBroadcasts(address: string | null) {
        if (!address) {
            setLoading(false);
            return;
        }

        try {
            const client = getSuiClient();

            const ownedObjects = await client.getOwnedObjects({
                owner: address,
                options: { showType: true, showContent: true },
            });

            const broadcastList: Broadcast[] = [];

            for (const obj of ownedObjects.data) {
                const type = obj.data?.type;
                if (!type?.includes("CourseRepBroadcast")) continue;

                const content = obj.data?.content;
                if (content?.dataType !== "moveObject") continue;

                const fields = content.fields as any;

                broadcastList.push({
                    id: obj.data?.objectId || "",
                    courseCode: fields?.course_code || "Unknown",
                    audioBlobId: fields?.audio_blob_id || "",
                    message: fields?.message || "",
                    broadcaster: fields?.broadcaster || address,
                    objectId: obj.data?.objectId || "",
                });
            }

            setBroadcasts(broadcastList);
            setStats({
                totalBroadcasts: broadcastList.length,
                tokensEarned: `${(broadcastList.length * 0.05).toFixed(2)} SUI`,
            });

        } catch (error) {
            console.error("[Broadcasts] Error fetching:", error);
        } finally {
            setLoading(false);
        }
    }

    const handlePublish = async () => {
        if (!audioBlob || !courseCode || !message || !isContractConfigured()) return;
        setUploading(true);

        try {
            // 1. Upload audio to Walrus
            const audioBlobId = await uploadToWalrus(audioBlob);
            console.log("[Broadcasts] Audio uploaded:", audioBlobId);

            // 2. Create broadcast on-chain using zkLogin
            const tx = new Transaction();
            tx.moveCall({
                target: TARGETS.broadcast,
                arguments: [
                    tx.pure.vector("u8", Array.from(new TextEncoder().encode(courseCode))),
                    tx.pure.vector("u8", Array.from(new TextEncoder().encode(audioBlobId))),
                    tx.pure.vector("u8", Array.from(new TextEncoder().encode(message))),
                ],
            });

            const result = await executeSponsoredZkLoginTransaction(tx);
            console.log("[Broadcasts] Transaction result (sponsored):", result);

            // Success!
            alert(`Broadcast Created Successfully!\n\nCourse: ${courseCode}\nTx: ${result.digest}`);

            // Reset form
            setCourseCode("");
            setMessage("");
            setAudioBlob(null);

            // Refresh list
            fetchBroadcasts(zkAddress);

        } catch (e: any) {
            console.error("[Broadcasts] Error:", e);
            alert(`Failed to create broadcast: ${e.message || "Unknown error"}`);
        } finally {
            setUploading(false);
        }
    };

    const getWalrusAudioUrl = (blobId: string) => {
        return `https://aggregator.walrus-testnet.walrus.space/v1/${blobId}`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-bold mb-2">Broadcast Center</h1>
                    <p className="text-gray-400">Create announcements and track engagement.</p>
                </div>
                <span className="px-3 py-1 rounded-full bg-green-900/30 text-green-400 text-xs font-bold border border-green-500/30 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> NETWORK: {SUI_NETWORK.toUpperCase()}
                </span>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Stats Row */}
                    <div className="grid grid-cols-2 gap-4 lg:gap-6">
                        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group bg-white/5 border border-white/10">
                            <div className="absolute top-0 right-0 p-6 opacity-30 group-hover:opacity-100 transition-opacity text-blue-400"><Radio /></div>
                            <p className="text-gray-400 text-sm font-medium mb-1">Your Broadcasts</p>
                            <h2 className="text-4xl font-bold">{stats.totalBroadcasts}</h2>
                            <p className="text-gray-500 text-xs mt-2 font-medium">On Sui {SUI_NETWORK}</p>
                        </div>
                        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden group bg-white/5 border border-white/10">
                            <div className="absolute top-0 right-0 p-6 opacity-30 group-hover:opacity-100 transition-opacity text-yellow-400"><ShieldCheck /></div>
                            <p className="text-gray-400 text-sm font-medium mb-1">Est. Rewards</p>
                            <h2 className="text-4xl font-bold">{stats.tokensEarned}</h2>
                            <p className="text-gray-500 text-xs mt-2 font-medium">From broadcasts</p>
                        </div>
                    </div>

                    {/* Create Post Section */}
                    <div className="glass-panel p-6 lg:p-8 rounded-[2.5rem] border border-white/10 bg-white/5">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20"><IconLink size={20} /></div>
                            <h2 className="text-xl font-bold">New Broadcast</h2>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Course Code</label>
                                <input
                                    className="w-full bg-[#0F172A]/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 transition-colors"
                                    placeholder="e.g. SOC 101"
                                    value={courseCode}
                                    onChange={e => setCourseCode(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Sender Address</label>
                                <input
                                    className="w-full bg-[#0F172A]/50 border border-white/10 rounded-xl px-4 py-3 outline-none text-gray-500 font-mono text-sm"
                                    value={zkAddress ? `${zkAddress.slice(0, 10)}...${zkAddress.slice(-8)}` : "Not connected"}
                                    disabled
                                />
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Message</label>
                            <textarea
                                className="w-full bg-[#0F172A]/50 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 transition-colors h-32 resize-none"
                                placeholder="Enter your announcement message..."
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                            />
                        </div>

                        <div className="p-6 border-2 border-dashed border-white/5 hover:border-blue-500/30 rounded-2xl transition-colors bg-white/[0.02] text-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-gray-400 border border-white/10">
                                    <Upload size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm">Record Audio Announcement</h4>
                                    <p className="text-xs text-gray-500">Supports voice recordings up to 5 minutes</p>
                                </div>

                                <div className="mt-2 w-full max-w-sm mx-auto">
                                    <VoiceRecorder onRecordingComplete={setAudioBlob} />
                                    {audioBlob && <p className="text-xs text-green-400 mt-2 font-bold animate-pulse">✓ Audio Captured ({(audioBlob.size / 1024).toFixed(1)} KB)</p>}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handlePublish}
                            disabled={!audioBlob || !courseCode || !message || uploading || !isContractConfigured()}
                            className="w-full mt-6 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="animate-spin" size={18} />
                                    Publishing to Walrus & Sui...
                                </>
                            ) : (
                                "Publish Broadcast"
                            )}
                        </button>

                        {!isContractConfigured() && (
                            <p className="text-xs text-yellow-500 text-center mt-3">
                                ⚠️ Package ID not configured. Deploy the smart contract first.
                            </p>
                        )}
                    </div>
                </div>

                {/* Right Activity Feed */}
                <div className="space-y-6">
                    <div className="glass-panel p-6 rounded-3xl bg-white/5 border border-white/10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold">Your Broadcasts</h3>
                            <button
                                onClick={() => fetchBroadcasts(zkAddress)}
                                className="text-xs text-blue-400 font-bold hover:text-blue-300 transition-colors flex items-center gap-1"
                            >
                                <RefreshCw size={12} /> Refresh
                            </button>
                        </div>

                        {broadcasts.length > 0 ? (
                            <div className="space-y-4">
                                {broadcasts.slice(0, 5).map((b) => (
                                    <div key={b.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all cursor-pointer group hover:border-white/10">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded uppercase tracking-wider">{b.courseCode}</span>
                                            {b.audioBlobId && (
                                                <button
                                                    onClick={() => window.open(getWalrusAudioUrl(b.audioBlobId), '_blank')}
                                                    className="p-1 rounded-lg hover:bg-blue-500/20 text-gray-400 hover:text-blue-400"
                                                >
                                                    <Play size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-300 line-clamp-2 mb-3">{b.message}</p>
                                        <div className="flex items-center justify-between text-[10px] text-gray-500 border-t border-white/5 pt-3">
                                            <span className="font-mono opacity-60">{b.objectId.slice(0, 10)}...</span>
                                            <span className="flex items-center gap-1 text-green-400 font-bold">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> On-Chain
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Radio size={32} className="text-gray-700 mx-auto mb-3" />
                                <p className="text-gray-500 text-sm">No broadcasts yet.</p>
                                <p className="text-gray-600 text-xs">Create your first one above!</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

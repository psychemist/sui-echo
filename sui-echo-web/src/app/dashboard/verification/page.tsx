"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, FileText, ExternalLink, Search, Filter, Loader2, RefreshCw, Clock } from "lucide-react";
import { getSuiClient, getZkLoginAddress, isZkLoginSessionValid } from "@/utils/zklogin-proof";
import { PACKAGE_ID, SUI_NETWORK } from "@/config";
import { useRouter } from "next/navigation";

interface Handout {
    id: string;
    file: string;
    blobId: string;
    user: string;
    status: "pending" | "verified";
    date: string;
    objectId: string;
}

export default function VerificationPage() {
    const router = useRouter();
    const [filter, setFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [handouts, setHandouts] = useState<Handout[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [stats, setStats] = useState({
        pending: 0,
        verified: 0,
        total: 0,
    });

    useEffect(() => {
        if (!isZkLoginSessionValid()) {
            router.push("/");
            return;
        }
        fetchHandouts();
    }, [router]);

    async function fetchHandouts() {
        const address = getZkLoginAddress();
        if (!address) {
            setLoading(false);
            return;
        }

        try {
            const client = getSuiClient();

            // Fetch user's owned Handout objects
            const ownedObjects = await client.getOwnedObjects({
                owner: address,
                options: { showType: true, showContent: true },
            });

            const handoutList: Handout[] = [];
            let pending = 0;
            let verified = 0;

            for (const obj of ownedObjects.data) {
                const type = obj.data?.type;
                if (!type?.includes("Handout")) continue;

                const content = obj.data?.content;
                if (content?.dataType !== "moveObject") continue;

                const fields = content.fields as any;
                const isVerified = fields?.verified === true;

                if (isVerified) {
                    verified++;
                } else {
                    pending++;
                }

                handoutList.push({
                    id: obj.data?.objectId || "",
                    file: fields?.description ? String(fields.description).slice(0, 30) : "Handout",
                    blobId: fields?.blob_id || "",
                    user: address.slice(0, 6) + "..." + address.slice(-4),
                    status: isVerified ? "verified" : "pending",
                    date: "Recently uploaded",
                    objectId: obj.data?.objectId || "",
                });
            }

            setHandouts(handoutList);
            setStats({
                pending,
                verified,
                total: pending + verified,
            });

        } catch (error) {
            console.error("[Verification] Error fetching handouts:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchHandouts();
    };

    const filteredHandouts = handouts.filter(h => {
        const matchesFilter = filter === "all" || h.status === filter;
        const matchesSearch = !searchQuery ||
            h.file.toLowerCase().includes(searchQuery.toLowerCase()) ||
            h.blobId.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const openOnExplorer = (objectId: string) => {
        const explorerUrl = SUI_NETWORK === 'mainnet'
            ? `https://suiexplorer.com/object/${objectId}`
            : `https://suiexplorer.com/object/${objectId}?network=${SUI_NETWORK}`;
        window.open(explorerUrl, '_blank');
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
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black mb-2 tracking-tight">Handout Verification</h1>
                    <p className="text-gray-400 font-medium text-lg">Validate scanned handouts and track verification status.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
                    </button>
                    <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 shrink-0">
                        {["all", "pending", "verified"].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${filter === f ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-gray-500 hover:text-white"}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Stats */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-6 rounded-3xl bg-blue-600/10 border border-blue-500/20">
                        <h3 className="text-blue-400 text-xs font-black uppercase tracking-widest mb-4">Your Handouts</h3>
                        <div className="flex items-end gap-2 mb-2">
                            <span className="text-4xl font-black">{stats.total}</span>
                            <span className="text-gray-500 text-xs font-bold mb-1">total</span>
                        </div>
                        <p className="text-sm text-blue-200/50 font-medium">
                            {stats.verified} verified, {stats.pending} pending
                        </p>
                    </div>

                    <div className="glass-panel p-6 rounded-3xl bg-white/5 border border-white/10">
                        <h3 className="text-gray-500 text-xs font-black uppercase tracking-widest mb-6">Status Breakdown</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-300">Pending</span>
                                <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-black rounded-lg">{stats.pending}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-bold text-gray-300">Verified</span>
                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-black rounded-lg">{stats.verified}</span>
                            </div>
                        </div>
                    </div>

                    {stats.pending > 0 && (
                        <div className="glass-panel p-6 rounded-3xl bg-yellow-500/10 border border-yellow-500/20">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock size={16} className="text-yellow-400" />
                                <h3 className="text-yellow-400 text-xs font-black uppercase">TEE Processing</h3>
                            </div>
                            <p className="text-sm text-yellow-200/60">
                                Pending handouts will be verified by the TEE automatically once the service is ready.
                            </p>
                        </div>
                    )}
                </div>

                {/* Handout List */}
                <div className="lg:col-span-3">
                    <div className="glass-panel rounded-[2.5rem] bg-white/5 border border-white/10 overflow-hidden">
                        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row gap-4 justify-between items-center">
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[#0F172A]/50 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm focus:border-blue-500/50 outline-none transition-all"
                                    placeholder="Search by description or blob ID..."
                                />
                            </div>
                            <span className="text-xs text-gray-500 font-medium">
                                Showing {filteredHandouts.length} of {handouts.length} handouts
                            </span>
                        </div>

                        {filteredHandouts.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left border-b border-white/5">
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Document</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Blob ID</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Status</th>
                                            <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {filteredHandouts.map((h) => (
                                            <tr key={h.id} className="group hover:bg-white/[0.02] transition-colors">
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                                            <FileText size={20} />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-bold text-white mb-0.5">{h.file}</h4>
                                                            <p className="text-[10px] text-gray-500 font-medium">{h.date}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <span className="text-xs font-mono text-gray-400 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                                                        {h.blobId ? h.blobId.slice(0, 12) + "..." : "N/A"}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="flex items-center gap-2">
                                                        {h.status === "pending" && <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
                                                        {h.status === "verified" && <ShieldCheck size={14} className="text-green-500" />}
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${h.status === "verified" ? "text-green-400" : "text-yellow-400"}`}>
                                                            {h.status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-6">
                                                    <button
                                                        onClick={() => openOnExplorer(h.objectId)}
                                                        className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-blue-600 hover:border-blue-500 hover:text-white transition-all text-gray-400"
                                                        title="View on Explorer"
                                                    >
                                                        <ExternalLink size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-16 text-center">
                                <FileText size={48} className="text-gray-700 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-gray-400 mb-2">No Handouts Found</h3>
                                <p className="text-sm text-gray-600 mb-6">
                                    {searchQuery ? "Try a different search term." : "Start scanning handouts to see them here."}
                                </p>
                                <a href="/scan" className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm transition-colors">
                                    Scan Your First Handout
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

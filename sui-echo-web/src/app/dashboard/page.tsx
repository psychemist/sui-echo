"use client";

import { Activity, BookOpen, Clock, Radio, ShieldCheck, TrendingUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { getZkLoginAddress, isZkLoginSessionValid, getSuiClient } from "@/utils/zklogin-proof";
import { PACKAGE_ID } from "@/config";
import { useRouter } from "next/navigation";

interface DashboardStats {
    totalBroadcasts: number;
    handoutsVerified: number;
    pendingHandouts: number;
    tokensEarned: string;
}

interface RecentActivity {
    file: string;
    user: string;
    time: string;
    status: "success" | "pending";
}

export default function OverviewPage() {
    const router = useRouter();
    const [userName, setUserName] = useState<string | null>(null);
    const [zkAddress, setZkAddress] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats>({
        totalBroadcasts: 0,
        handoutsVerified: 0,
        pendingHandouts: 0,
        tokensEarned: "0",
    });
    const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

    useEffect(() => {
        if (!isZkLoginSessionValid()) {
            router.push("/");
            return;
        }

        const address = getZkLoginAddress();
        setZkAddress(address);

        const token = window.sessionStorage.getItem("sui_zklogin_jwt");
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                setUserName(decoded.given_name || decoded.name || decoded.email?.split('@')[0]);
            } catch (e) {
                console.error("Failed to decode token", e);
            }
        }

        fetchDashboardData(address);
    }, [router]);

    async function fetchDashboardData(address: string | null) {
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

            let broadcasts = 0;
            let verifiedHandouts = 0;
            let pendingHandouts = 0;
            const activities: RecentActivity[] = [];

            for (const obj of ownedObjects.data) {
                const type = obj.data?.type;
                if (!type) continue;

                if (type.includes("CourseRepBroadcast")) {
                    broadcasts++;
                } else if (type.includes("Handout")) {
                    const content = obj.data?.content;
                    if (content?.dataType === "moveObject") {
                        const fields = content.fields as any;
                        if (fields?.verified) {
                            verifiedHandouts++;
                            activities.push({
                                file: fields.description || "Handout",
                                user: address.slice(0, 6) + "..." + address.slice(-4),
                                time: "Recently",
                                status: "success",
                            });
                        } else {
                            pendingHandouts++;
                            activities.push({
                                file: fields.description || "Handout",
                                user: address.slice(0, 6) + "..." + address.slice(-4),
                                time: "Recently",
                                status: "pending",
                            });
                        }
                    }
                }
            }

            setStats({
                totalBroadcasts: broadcasts,
                handoutsVerified: verifiedHandouts,
                pendingHandouts,
                tokensEarned: `${(verifiedHandouts * 0.1).toFixed(1)} SUI`,
            });

            setRecentActivity(activities.slice(0, 5));
        } catch (error) {
            console.error("[Dashboard] Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-6 h-6 text-[#4F9EF8] animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <header>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-1">
                    Welcome back, <span className="text-[#4F9EF8]">{userName || "User"}</span>
                </h1>
                <p className="text-[#8A919E] text-sm">Here's what's happening in your Sui-Echo network.</p>
                {zkAddress && (
                    <p className="text-xs text-[#565B67] font-mono mt-2">
                        {zkAddress.slice(0, 10)}...{zkAddress.slice(-8)}
                    </p>
                )}
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: "Broadcasts", value: stats.totalBroadcasts.toString(), icon: Radio, color: "#4F9EF8" },
                    { label: "Verified", value: stats.handoutsVerified.toString(), icon: ShieldCheck, color: "#22C55E" },
                    { label: "Pending", value: stats.pendingHandouts.toString(), icon: Clock, color: "#EAB308" },
                    { label: "Earned", value: stats.tokensEarned, icon: TrendingUp, color: "#22C55E" },
                ].map((stat, i) => (
                    <div key={i} className="bg-[#12151C] border border-[#1E232E] rounded-xl p-4 hover:border-[#2A3140] transition-colors">
                        <div className="flex items-center gap-2 mb-3">
                            <stat.icon size={16} style={{ color: stat.color }} />
                            <span className="text-xs text-[#8A919E] font-medium">{stat.label}</span>
                        </div>
                        <p className="text-2xl font-semibold">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Quick Actions + Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Quick Actions */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-sm font-semibold text-[#8A919E]">Quick Actions</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Link
                            href="/scan"
                            className="bg-[#12151C] border border-[#1E232E] rounded-xl p-5 hover:border-[#22C55E]/50 transition-colors group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-[#22C55E] flex items-center justify-center mb-4">
                                <BookOpen size={20} className="text-white" />
                            </div>
                            <h3 className="font-medium mb-1">Scan Handouts</h3>
                            <p className="text-xs text-[#8A919E]">Upload and OCR scan course materials</p>
                        </Link>

                        <Link
                            href="/dashboard/broadcasts"
                            className="bg-[#12151C] border border-[#1E232E] rounded-xl p-5 hover:border-[#4F9EF8]/50 transition-colors group"
                        >
                            <div className="w-10 h-10 rounded-lg bg-[#4F9EF8] flex items-center justify-center mb-4">
                                <Radio size={20} className="text-white" />
                            </div>
                            <h3 className="font-medium mb-1">Create Broadcast</h3>
                            <p className="text-xs text-[#8A919E]">Record announcements for students</p>
                        </Link>
                    </div>

                    <Link
                        href="/dashboard/handouts"
                        className="block bg-[#12151C] border border-[#1E232E] rounded-xl p-5 hover:border-[#22C55E]/50 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-[#22C55E]/20 flex items-center justify-center">
                                    <ShieldCheck size={20} className="text-[#22C55E]" />
                                </div>
                                <div>
                                    <h3 className="font-medium mb-0.5">View Handouts</h3>
                                    <p className="text-xs text-[#8A919E]">Check verification status and claim rewards</p>
                                </div>
                            </div>
                            {stats.pendingHandouts > 0 && (
                                <span className="px-2 py-1 bg-[#EAB308]/20 text-[#EAB308] text-xs font-medium rounded">
                                    {stats.pendingHandouts} pending
                                </span>
                            )}
                        </div>
                    </Link>
                </div>

                {/* Recent Activity */}
                <div className="bg-[#12151C] border border-[#1E232E] rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Clock size={14} className="text-[#4F9EF8]" />
                        <h2 className="text-sm font-semibold">Recent Activity</h2>
                    </div>

                    {recentActivity.length > 0 ? (
                        <div className="space-y-4">
                            {recentActivity.map((item, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${item.status === 'success'
                                            ? 'bg-[#22C55E]/10 text-[#22C55E]'
                                            : 'bg-[#EAB308]/10 text-[#EAB308]'
                                        }`}>
                                        <BookOpen size={14} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.file}</p>
                                        <p className="text-[10px] text-[#565B67]">
                                            {item.status === 'success' ? 'Verified' : 'Pending'} • {item.time}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[#565B67] text-xs text-center py-6">
                            No recent activity yet
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

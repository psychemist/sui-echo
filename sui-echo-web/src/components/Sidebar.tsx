"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Radio, ShieldCheck, LogOut, User, Copy, Check, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { clearZkLoginSession, getZkLoginAddress, isZkLoginSessionValid } from "@/utils/zklogin-proof";

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [zkAddress, setZkAddress] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isVerifiedRep, setIsVerifiedRep] = useState(false);

    useEffect(() => {
        // Get zkLogin address
        const address = getZkLoginAddress();
        setZkAddress(address);

        // Get email from JWT
        const token = window.sessionStorage.getItem("sui_zklogin_jwt");
        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                setUserEmail(decoded.email);
            } catch (e) {
                console.error("Failed to decode token", e);
            }
        }

        // TODO: Check on-chain if user has CourseRepCap
        // For now, this would require querying the chain
        // setIsVerifiedRep(checkIfVerifiedRep(address));

        // Redirect if not logged in
        if (!isZkLoginSessionValid()) {
            router.push("/");
        }
    }, [router]);

    const handleLogout = () => {
        clearZkLoginSession();
        router.push("/");
    };

    const handleCopyAddress = () => {
        if (zkAddress) {
            navigator.clipboard.writeText(zkAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const navItems = [
        { name: "Dashboard", href: "/dashboard", icon: Activity },
        { name: "Broadcasts", href: "/dashboard/broadcasts", icon: Radio },
        { name: "Verification", href: "/dashboard/verification", icon: ShieldCheck },
    ];

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 hidden lg:flex flex-col bg-[#0A0F1D] border-r border-white/5 p-6 z-50">
            <div className="flex items-center gap-3 px-2 mb-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Activity className="text-white w-6 h-6" />
                </div>
                <div>
                    <h3 className="font-bold text-white tracking-tight">Sui-Echo</h3>
                    {isVerifiedRep ? (
                        <div className="flex items-center gap-1 text-[10px] text-green-400 font-bold uppercase tracking-wider">
                            <ShieldCheck size={8} /> Verified Rep
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                            Course Rep Portal
                        </div>
                    )}
                </div>
            </div>

            <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            <item.icon size={20} className={isActive ? "text-white" : "text-gray-400 group-hover:text-blue-400"} />
                            <span className="font-semibold text-sm">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Not verified banner */}
            {!isVerifiedRep && (
                <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                    <div className="flex items-start gap-2">
                        <AlertCircle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs text-yellow-500 font-bold">Not Verified</p>
                            <p className="text-[10px] text-yellow-500/70">Apply to become a verified course rep to unlock all features.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-auto pt-6 border-t border-white/5">
                <div className="flex items-center gap-3 px-2 mb-4">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-blue-400 border border-white/10">
                        <User size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{userEmail || "Anonymous"}</p>
                        <p className="text-[10px] text-gray-500 font-medium">zkLogin User</p>
                    </div>
                </div>

                {/* Address with copy */}
                {zkAddress && (
                    <button
                        onClick={handleCopyAddress}
                        className="w-full mb-4 px-3 py-2 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between hover:bg-white/10 transition-colors"
                    >
                        <span className="text-[10px] text-gray-400 font-mono truncate">
                            {zkAddress.slice(0, 8)}...{zkAddress.slice(-6)}
                        </span>
                        {copied ? (
                            <Check size={12} className="text-green-400" />
                        ) : (
                            <Copy size={12} className="text-gray-500" />
                        )}
                    </button>
                )}

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-all font-bold text-xs uppercase tracking-widest"
                >
                    <LogOut size={16} /> Logout
                </button>
            </div>
        </aside>
    );
}

"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { getZkLoginAddress } from "@/utils/zklogin-proof";

export default function ApplyPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        courseCode: "",
        fullName: "",
        studentId: "",
        department: "",
        reason: "",
    });

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const zkAddress = getZkLoginAddress();
            if (!zkAddress) {
                throw new Error("Please login with zkLogin first");
            }

            // For now, just simulate submission since contract isn't deployed yet
            // In production, this would call the apply_for_course_rep Move function
            console.log("[Apply] Submitting application:", formData);
            console.log("[Apply] User address:", zkAddress);

            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            // TODO: Call smart contract function apply_for_course_rep
            // const tx = new Transaction();
            // tx.moveCall({
            //     target: `${PACKAGE_ID}::echo::apply_for_course_rep`,
            //     arguments: [
            //         tx.object(COURSE_REP_REGISTRY_ID),
            //         tx.pure.vector("u8", Array.from(new TextEncoder().encode(formData.courseCode))),
            //         tx.pure.vector("u8", Array.from(new TextEncoder().encode(formData.fullName))),
            //         tx.pure.vector("u8", Array.from(new TextEncoder().encode(formData.studentId))),
            //         tx.pure.vector("u8", Array.from(new TextEncoder().encode(formData.department))),
            //         tx.pure.vector("u8", Array.from(new TextEncoder().encode(formData.reason))),
            //     ],
            // });

            setIsSubmitted(true);
        } catch (err: any) {
            console.error("[Apply] Error:", err);
            setError(err.message || "Failed to submit application");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-[#0A0F1D] text-white flex">
                <Sidebar />
                <main className="flex-1 lg:ml-64 p-8 flex items-center justify-center">
                    <div className="max-w-md w-full text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle2 size={40} className="text-green-400" />
                        </div>
                        <h1 className="text-2xl font-bold mb-4">Application Submitted!</h1>
                        <p className="text-gray-400 mb-8">
                            Your course rep application has been submitted for admin review.
                            You'll receive a CourseRepCap once approved.
                        </p>
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors"
                        >
                            Return to Dashboard
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0A0F1D] text-white flex">
            <Sidebar />
            <main className="flex-1 lg:ml-64 p-8">
                <div className="max-w-2xl mx-auto">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
                    >
                        <ArrowLeft size={16} /> Back to Dashboard
                    </Link>

                    <div className="bg-[#0F172A] border border-white/10 rounded-3xl p-8">
                        <h1 className="text-2xl font-bold mb-2">Apply to be a Course Rep</h1>
                        <p className="text-gray-400 mb-8">
                            Fill out this form to apply for verified course rep status.
                            An admin will review your application.
                        </p>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">
                                        Course Code *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g., CSC301"
                                        value={formData.courseCode}
                                        onChange={(e) => setFormData(prev => ({ ...prev, courseCode: e.target.value }))}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Your full name"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">
                                        Student ID *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Your matriculation number"
                                        value={formData.studentId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, studentId: e.target.value }))}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-2">
                                        Department *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g., Computer Science"
                                        value={formData.department}
                                        onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-2">
                                    Why do you want to be a course rep? *
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    placeholder="Explain your motivation..."
                                    value={formData.reason}
                                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                                    className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                                />
                            </div>

                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} />
                                        Submit Application
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}

"use client";

import { ConnectButton } from "@mysten/dapp-kit";
import Link from "next/link";
import { ArrowRight, BookOpen, ShieldCheck, PlayCircle, Radio, Mic, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { prepareZkLoginSession } from "@/utils/zklogin-proof";

export default function Home() {
  const router = useRouter();
  const [role, setRole] = useState<'student' | 'rep'>('student');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsRedirecting(true);
    setLoginError(null);
    try {
      // Save the selected role before redirecting
      window.sessionStorage.setItem("sui_echo_user_role", role);

      const { loginUrl } = await prepareZkLoginSession();
      window.location.href = loginUrl;
    } catch (e: any) {
      console.error("[zkLogin] Error:", e);
      setIsRedirecting(false);
      setLoginError(e.message || "Failed to initialize zkLogin. Please try again.");
    }
  };


  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-blue-500/30 overflow-x-hidden relative flex flex-col">

      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full opacity-40 mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 blur-[120px] rounded-full opacity-30 mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-50 w-full max-w-7xl mx-auto p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/10">
            <BookOpen className="text-white w-6 h-6" />
          </div>
          <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-200">Sui-Echo</span>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="hidden sm:flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <span>Course Reps</span>
            <Radio size={14} />
          </Link>
          <ConnectButton className="!w-auto !rounded-full !px-6 !py-2 !bg-white/5 !text-white !text-sm !font-bold hover:!bg-white/10 !border !border-white/10 transition-all backdrop-blur-md" />
        </div>
      </nav>

      {/* Hero Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center max-w-5xl mx-auto w-full pt-12 pb-24">

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_-10px_theme(colors.blue.500)] mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
          <ShieldCheck size={14} /> Decentralized Accessibility on Sui
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[1.1] mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
          Connecting Voices, <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-white">Empowering Minds.</span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 max-w-2xl leading-relaxed mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
          Bridging the gap between physical handouts and accessible audio.
          Scan notes, convert seamlessly, and earn rewards securely with zkLogin.
        </p>

        {/* Action Dock */}
        <div className="w-full max-w-md mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">

          {/* Role Switcher */}
          <div className="bg-white/5 backdrop-blur-xl p-1.5 rounded-2xl flex border border-white/10">
            <button
              onClick={() => setRole('student')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${role === 'student' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'text-gray-400 hover:text-white'}`}
            >
              Student / Reader
            </button>
            <button
              onClick={() => setRole('rep')}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${role === 'rep' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'text-gray-400 hover:text-white'}`}
            >
              Course Rep
            </button>
          </div>

          {/* Login Card */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 bg-[#0F172A]/80 shadow-2xl backdrop-blur-md">
            <button
              onClick={handleGoogleLogin}
              disabled={isRedirecting}
              className="w-full bg-white hover:bg-gray-100 text-gray-900 h-14 rounded-xl font-bold transition-all flex items-center justify-center gap-3 relative overflow-hidden group disabled:opacity-70"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {isRedirecting ? "Connecting..." : `Continue with Google as ${role === 'rep' ? 'Course Rep' : 'Student'}`}
            </button>
            {role === 'rep' && (
              <p className="text-xs text-gray-500 text-center mt-3">
                After login, you can apply to become a verified course rep.
              </p>
            )}
            {loginError && (
              <p className="text-xs text-red-400 text-center mt-3">{loginError}</p>
            )}
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-4 pt-4">
            <Link href="/scan" className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-blue-500/30 transition-all flex flex-col items-center gap-2 group cursor-pointer">
              <BookOpen size={20} className="text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-gray-300">Quick Scan</span>
            </Link>
            <Link href="/reader" className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-teal-500/30 transition-all flex flex-col items-center gap-2 group cursor-pointer">
              <PlayCircle size={20} className="text-teal-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-gray-300">Quick Reader</span>
            </Link>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full p-6 text-center text-xs text-gray-600 font-medium">
        SECURED BY ZKLOGIN • POWERED BY SUI
      </footer>
    </div>
  );
}

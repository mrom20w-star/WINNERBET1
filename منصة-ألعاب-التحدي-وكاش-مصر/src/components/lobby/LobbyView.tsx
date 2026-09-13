import React from 'react';
import { useApp } from '../../context/AppContext';
import { Sparkles, ArrowRight } from 'lucide-react';

export const LobbyView: React.FC = () => {
  const { user, setScreen } = useApp();

  return (
    <div className="w-full min-h-screen bg-[#f3f4f6] text-slate-800 pb-12 select-none flex flex-col items-center">
      {/* 1. TOP HEADER */}
      <div className="w-full bg-white px-4 py-3 border-b border-slate-200/80 flex items-center justify-between shadow-xs sticky top-0 z-30">
        {/* Action Buttons on Left: سحب (top) & إيداع (bottom) stacked vertically */}
        <div className="flex flex-col gap-1.5 items-start">
          <button
            type="button"
            onClick={() => setScreen('withdraw')}
            id="lobby-withdraw-btn"
            className="w-20 sm:w-24 py-1 px-3 rounded-full border border-slate-300/80 bg-slate-50 hover:bg-slate-100 active:scale-95 text-[#1976d2] font-bold text-xs shadow-xs transition cursor-pointer text-center"
          >
            سحب
          </button>
          <button
            type="button"
            onClick={() => setScreen('deposit')}
            id="lobby-deposit-btn"
            className="w-20 sm:w-24 py-1 px-3 rounded-full bg-[#1976d2] hover:bg-[#1565c0] active:scale-95 text-white font-bold text-xs shadow-xs transition cursor-pointer text-center"
          >
            إيداع
          </button>
        </div>

        {/* Current Balance Card on Right */}
        <div className="bg-[#1a3853] text-white rounded-2xl px-6 py-2 flex flex-col items-center justify-center shadow-md min-w-[140px]">
          <span className="text-[11px] text-slate-300 font-medium leading-none mb-1">
            الرصيد الحالي
          </span>
          <div className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-baseline gap-1" dir="rtl">
            <span>{user.balance.toFixed(2)}</span>
            <span className="text-xs font-normal text-slate-300">جنيه</span>
          </div>
        </div>
      </div>

      {/* 2. ONLY 2 GAMES: CRASH (PLANE) & APPLE OF FORTUNE */}
      <div className="w-full max-w-lg px-3.5 pt-4 flex flex-col gap-4">
        
        {/* GAME 1: CRASH (الطيارة) */}
        <div
          onClick={() => setScreen('crash')}
          id="game-card-crash"
          className="w-full rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer relative bg-gradient-to-r from-[#170e30] via-[#26154d] to-[#120824] border border-amber-500/20 group"
        >
          <div className="w-full h-48 sm:h-56 relative flex items-center justify-center overflow-hidden">
            {/* Background Nebula Glows */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(245,158,11,0.25),transparent_60%)]"></div>
            <div className="absolute -top-10 -right-10 w-44 h-44 bg-purple-600/30 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl"></div>

            {/* Flying 3D Yellow Jet Plane & Golden Streak Trail */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 180" preserveAspectRatio="none">
              <path
                d="M 30 160 Q 180 140 330 45"
                fill="none"
                stroke="url(#crashTrailGlow)"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="crashTrailGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#fef08a" stopOpacity="1" />
                </linearGradient>
              </defs>
            </svg>

            {/* Flying Airplane Art */}
            <div className="absolute top-6 right-10 sm:right-16 group-hover:scale-110 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-500 z-20">
              <img
                src="/plane.png"
                alt="Crash Plane"
                className="w-28 sm:w-36 h-auto drop-shadow-[0_8px_20px_rgba(245,158,11,0.9)] transform -rotate-12 select-none"
              />
            </div>

            {/* Big 3D Bold Golden "CRASH" Typography in Center */}
            <div className="relative z-20 flex flex-col items-center justify-center">
              <span className="text-5xl sm:text-6xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-b from-[#fff5a0] via-[#ffb800] to-[#f57c00] drop-shadow-[0_4px_16px_rgba(255,180,0,0.85)] font-sans">
                CRASH
              </span>
              <span className="text-xs text-amber-200/90 font-bold mt-1 bg-black/50 px-3 py-0.5 rounded-full border border-amber-500/30">
                لعبة الطيارة الرسمية
              </span>
            </div>

            {/* Bottom Left Title: "Crash" */}
            <div className="absolute bottom-3 left-4 z-20 flex items-center gap-2">
              <span className="text-white font-bold text-base sm:text-lg drop-shadow-md font-sans tracking-wide">
                Crash
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                نشط الآن
              </span>
            </div>
          </div>
        </div>

        {/* GAME 2: APPLE OF FORTUNE (التفاحة) */}
        <div
          onClick={() => setScreen('apple_of_fortune')}
          id="game-card-apple-fortune"
          className="w-full rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer relative bg-gradient-to-r from-[#0d2a19] via-[#164726] to-[#091e12] border border-emerald-500/30 group"
        >
          <div className="w-full h-48 sm:h-56 relative flex items-center justify-center overflow-hidden">
            {/* Enchanted Forest Background Texture & Atmosphere */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:scale-105 transition-transform duration-700"
              style={{ backgroundImage: `url('/apple-game-bg.jpg')` }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>

            {/* Ambient Bioluminescent Forest Glow */}
            <div className="absolute top-2 right-8 w-36 h-36 bg-emerald-500/25 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute bottom-2 left-8 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none"></div>

            {/* Center Big 3D Ripe Red Apple & Magic Potion Glows */}
            <div className="relative z-10 flex items-center justify-center">
              {/* Left Potion bottle / spark */}
              <div className="w-12 h-16 rounded-full bg-gradient-to-t from-cyan-600/60 to-cyan-300/40 blur-xs border border-cyan-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.6)] transform -rotate-12 mr-3 sm:mr-6 opacity-85">
                <Sparkles className="w-5 h-5 text-cyan-200 animate-pulse" />
              </div>

              {/* Big Delicious Glossy Red Apple in Center */}
              <div className="relative group-hover:scale-110 transition-transform duration-500">
                <img
                  src="/apple-ripe.png"
                  alt="Apple Of Fortune"
                  className="w-28 sm:w-32 h-28 sm:h-32 rounded-full drop-shadow-[0_8px_25px_rgba(239,68,68,0.9)] object-cover select-none"
                />
              </div>

              {/* Right Potion bottle / spark */}
              <div className="w-12 h-16 rounded-full bg-gradient-to-t from-amber-600/60 to-amber-300/40 blur-xs border border-amber-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.6)] transform rotate-12 ml-3 sm:ml-6 opacity-85">
                <Sparkles className="w-5 h-5 text-amber-200 animate-pulse" />
              </div>
            </div>

            {/* Bottom Left Title: "Apple Of Fortune" */}
            <div className="absolute bottom-3 left-4 z-20 flex items-center gap-2">
              <span className="text-white font-bold text-base sm:text-lg drop-shadow-md font-sans tracking-wide">
                Apple Of Fortune
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                تفاحة الحظ
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};


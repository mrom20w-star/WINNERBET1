import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  User,
  ArrowDownToLine,
  ArrowUpFromLine,
  LogOut,
  Gamepad2,
  Headphones,
} from 'lucide-react';
import { InboxDropdown } from '../common/InboxDropdown';
import { SupportModal } from '../common/SupportModal';

export const WebLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, screen, setScreen, logout, toasts, setIsSupportOpen, supportTickets, isDeviceBanned } = useApp();

  // If the user's device or account is banned, show permanent unclosable lockout screen
  if (isDeviceBanned) {
    const savedDeviceId = typeof window !== 'undefined' ? localStorage.getItem('app_device_id') || 'DEV-SECURED' : 'DEV-SECURED';
    return (
      <div className="w-full min-h-screen bg-[#070b14] text-white font-['Tajawal','Cairo',sans-serif] flex flex-col items-center justify-center p-6 text-center select-none" dir="rtl">
        <div className="max-w-md w-full bg-[#0e1628] border border-red-500/40 rounded-3xl p-8 shadow-2xl shadow-red-950/60 flex flex-col items-center gap-5 animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 text-4xl shadow-lg">
            🚫
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-red-400">
              تم حظر هذا الجهاز والحساب نهائياً
            </h1>
            <span className="text-xs text-red-400/80 font-mono bg-red-500/10 py-1 px-3 rounded-full border border-red-500/20 inline-block">
              ACCESS PERMANENTLY REVOKED
            </span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">
            بناءً على تعليمات إدارة المنصة، تم حذف هذا الحساب وحظر هذا الجهاز بالكامل من الوصول إلى المنصة أو تسجيل حساب جديد.
          </p>
          <div className="w-full bg-[#080d1a] border border-slate-800 rounded-2xl p-4 text-xs font-mono text-slate-400 flex flex-col gap-2 text-right">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
              <span className="text-slate-500">معرف الجهاز:</span>
              <span className="text-amber-400 font-bold">{savedDeviceId}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">حالة الوصول:</span>
              <span className="text-red-400 font-bold">محظور نهائياً (BLOCKED)</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 leading-normal">
            إذا كنت تعتقد أن هذا الإجراء تم عن طريق الخطأ، يرجى التواصل مع إدارة المنصة لطلب مراجعة الحظر.
          </p>
        </div>
      </div>
    );
  }

  const isAuthScreen = screen === 'login' || screen === 'register';

  // Check if user has unread replies from admin
  const userTickets = supportTickets.filter((t) => t.userId === user.id);
  const hasAdminResponse = userTickets.some((t) =>
    t.messages?.some((m) => m.sender === 'admin')
  );

  return (
    <div className="w-full min-h-screen bg-[#0d1527] text-slate-100 font-['Tajawal','Cairo',sans-serif] flex flex-col antialiased select-none" dir="rtl">
      {/* Top Navbar */}
      {!isAuthScreen && (
        <header className="w-full bg-[#111c35] border-b border-slate-800/80 sticky top-0 z-40 shadow-lg backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
            {/* Logo & Platform Name */}
            <div
              onClick={() => setScreen('lobby')}
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition group"
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md shadow-amber-500/20 group-hover:scale-105 transition border border-amber-500/40 bg-slate-950 flex items-center justify-center">
                <img
                  src="/winnerbet-logo.png"
                  alt="WINNERBET Logo"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/logo.png';
                  }}
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-base sm:text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-400 font-sans">
                    WINNERBET
                  </span>
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 font-black px-1.5 py-0.2 rounded border border-amber-400/30">
                    VIP
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 hidden sm:block">منصة وينر بيت الرسمية</span>
              </div>
            </div>

            {/* Middle: User Info & Balance (Desktop & Mobile) */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* User ID & Name Badge */}
              <div className="hidden md:flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 py-1.5 px-3 rounded-xl shadow-xs">
                <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-white leading-tight">{user.username}</span>
                  <span className="text-[10px] font-mono text-amber-400 font-extrabold leading-tight">
                    ID: {user.id}
                  </span>
                </div>
              </div>

              {/* Current Balance Badge */}
              <div className="bg-[#0b1324] border border-slate-700/80 rounded-2xl py-1.5 px-3 sm:px-4 flex items-center gap-2 shadow-inner">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] sm:text-[10px] text-slate-400 font-semibold leading-tight">
                    الرصيد المتاح
                  </span>
                  <div className="text-xs sm:text-sm font-black text-emerald-400 tracking-tight flex items-baseline gap-1" dir="rtl">
                    <span>{user.balance.toFixed(2)}</span>
                    <span className="text-[10px] font-normal text-slate-300">ج.م</span>
                  </div>
                </div>
              </div>

              {/* Deposit & Withdraw Action Buttons + Inbox + Support + Admin */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setScreen('deposit')}
                  id="nav-deposit-btn"
                  className="py-1.5 px-3 sm:px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/30 transition cursor-pointer flex items-center gap-1"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>إيداع</span>
                </button>

                <button
                  onClick={() => setScreen('withdraw')}
                  id="nav-withdraw-btn"
                  className="py-1.5 px-3 sm:px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white font-bold text-xs sm:text-sm border border-slate-700 transition cursor-pointer flex items-center gap-1"
                >
                  <ArrowUpFromLine className="w-3.5 h-3.5" />
                  <span>سحب</span>
                </button>

                {/* Live Customer Support Button */}
                <button
                  onClick={() => setIsSupportOpen(true)}
                  id="nav-support-btn"
                  className="py-1.5 px-2.5 sm:px-3 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 active:scale-95 text-white font-bold text-xs sm:text-sm border border-emerald-500/40 transition cursor-pointer flex items-center gap-1 shadow-sm relative"
                  title="الدعم الفني والشكاوى المباشرة"
                >
                  <Headphones className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">الدعم</span>
                  {hasAdminResponse && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>
                  )}
                </button>

                {/* Inbox Messages Dropdown Button */}
                <InboxDropdown />
              </div>

              {/* Logout button */}
              <button
                onClick={logout}
                id="nav-logout-btn"
                className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto flex flex-col justify-start items-center p-2 sm:p-4 md:p-6">
        <div className="w-full bg-white text-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-800/30 overflow-hidden flex flex-col">
          {children}
        </div>
      </main>

      {/* Floating Support Quick Button (Bottom Right) */}
      {!isAuthScreen && (
        <button
          onClick={() => setIsSupportOpen(true)}
          id="floating-support-btn"
          className="fixed bottom-5 right-5 z-40 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-2.5 px-4 rounded-full shadow-2xl border border-blue-400/40 flex items-center gap-2 transition hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Headphones className="w-5 h-5 text-amber-300" />
          <span className="text-xs sm:text-sm">الدعم الفني المباشر</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </button>
      )}

      {/* Customer Support Modal */}
      <SupportModal />

      {/* Clean Modern Website Footer */}
      {!isAuthScreen && (
        <footer className="w-full bg-[#0b1324] border-t border-slate-800 py-6 px-4 text-center text-xs text-slate-400">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200">1X WINNER</span>
              <span>— منصة الألعاب الترفيهية والكاش</span>
            </div>

            <div className="flex items-center gap-4 text-slate-400">
              <button onClick={() => setScreen('lobby')} className="hover:text-white transition cursor-pointer">
                الرئيسية
              </button>
              <button onClick={() => setScreen('deposit')} className="hover:text-white transition cursor-pointer">
                إيداع
              </button>
              <button onClick={() => setScreen('withdraw')} className="hover:text-white transition cursor-pointer">
                سحب
              </button>
              <button onClick={() => setIsSupportOpen(true)} className="hover:text-emerald-400 transition cursor-pointer font-bold">
                الدعم والمساعدة
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Floating Toast Notifications */}
      <div className="fixed bottom-5 left-5 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`py-3 px-4 rounded-2xl shadow-2xl text-xs sm:text-sm font-bold text-white transition-all transform animate-in slide-in-from-bottom flex items-center gap-2.5 pointer-events-auto border ${
              t.type === 'success'
                ? 'bg-emerald-600 border-emerald-400 shadow-emerald-950/50'
                : t.type === 'error'
                ? 'bg-red-600 border-red-400 shadow-red-950/50'
                : 'bg-blue-600 border-blue-400 shadow-blue-950/50'
            }`}
            dir="rtl"
          >
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Mail,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  Sparkles,
  ChevronLeft,
} from 'lucide-react';

export const InboxDropdown: React.FC = () => {
  const { transactions, user, setScreen } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'deposit' | 'withdraw'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter transactions for current user that are deposit or withdraw strictly
  const userTransactions = transactions
    .filter(
      (t) =>
        (t.type === 'deposit' || t.type === 'withdraw') &&
        Boolean(t.userId) &&
        (t.userId === user.id ||
          (Boolean(user.phone) && user.phone.length >= 8 && (t.userPhone === user.phone || t.senderPhone === user.phone)))
    )
    .sort((a, b) => b.timestamp - a.timestamp);

  const filtered = userTransactions.filter((t) => {
    if (filter === 'all') return true;
    return t.type === filter;
  });

  const pendingCount = userTransactions.filter((t) => t.status === 'pending').length;
  const totalCount = userTransactions.length;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'الآن';
    if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} دقيقة`;
    if (diff < 86400000) return `منذ ${Math.floor(diff / 3600000)} ساعة`;
    return new Date(timestamp).toLocaleDateString('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="relative" ref={dropdownRef} dir="rtl">
      {/* Mail Button with Notification Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        id="nav-inbox-btn"
        className={`p-2 rounded-xl border transition-all cursor-pointer relative flex items-center justify-center ${
          isOpen
            ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20'
            : 'bg-slate-800/90 hover:bg-slate-700/90 border-slate-700/90 text-slate-200 hover:text-white shadow-xs'
        }`}
        title="صندوق البريد والإشعارات"
      >
        <Mail className="w-4 h-4 sm:w-4.5 sm:h-4.5" />

        {/* Counter Badge */}
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 bg-gradient-to-r from-red-500 to-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse">
            {totalCount > 9 ? '+9' : totalCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="fixed sm:absolute top-14 left-2 right-2 sm:left-auto sm:right-0 sm:top-12 sm:w-84 md:w-96 bg-[#111c35] border border-slate-700/80 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col text-right animate-in fade-in slide-in-from-top-2 duration-150 backdrop-blur-xl">
          {/* Header */}
          <div className="p-3.5 bg-[#0d162b] border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs sm:text-sm font-bold text-white">صندوق الإشعارات والبريد</span>
                <span className="text-[10px] text-slate-400">
                  {totalCount} رسالة {pendingCount > 0 && `(${pendingCount} قيد التنفيذ)`}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              id="close-inbox-dropdown-btn"
              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 p-2 bg-[#0b1324] border-b border-slate-800/80 text-[11px] font-bold">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-1 px-2 rounded-lg transition cursor-pointer text-center ${
                filter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              الكل ({totalCount})
            </button>
            <button
              onClick={() => setFilter('deposit')}
              className={`flex-1 py-1 px-2 rounded-lg transition cursor-pointer text-center flex items-center justify-center gap-1 ${
                filter === 'deposit'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ArrowDownToLine className="w-3 h-3" />
              <span>إيداعات</span>
            </button>
            <button
              onClick={() => setFilter('withdraw')}
              className={`flex-1 py-1 px-2 rounded-lg transition cursor-pointer text-center flex items-center justify-center gap-1 ${
                filter === 'withdraw'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ArrowUpFromLine className="w-3 h-3" />
              <span>سحوبات</span>
            </button>
          </div>

          {/* Messages List Area */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60 p-1 flex flex-col">
            {filtered.length === 0 ? (
              <div className="py-8 px-4 flex flex-col items-center justify-center text-center gap-2 text-slate-400">
                <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-500">
                  <Mail className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium text-slate-300">لا توجد رسائل سحب أو إيداع حالياً</span>
                <span className="text-[10px] text-slate-500 max-w-xs">
                  عند قيامك بإنشاء طلب إيداع أو سحب ستظهر لك تفاصيل وحالة المعاملات هنا مباشرة
                </span>
              </div>
            ) : (
              filtered.map((tx) => {
                const isDeposit = tx.type === 'deposit';
                return (
                  <div
                    key={tx.id}
                    className="p-2.5 hover:bg-slate-800/40 rounded-xl transition flex items-start gap-2.5"
                  >
                    {/* Icon Badge */}
                    <div
                      className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center mt-0.5 ${
                        isDeposit
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {isDeposit ? <ArrowDownToLine className="w-4 h-4" /> : <ArrowUpFromLine className="w-4 h-4" />}
                    </div>

                    {/* Content Details */}
                    <div className="flex-1 flex flex-col gap-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          {isDeposit ? 'إيداع رصيد' : 'سحب أموال'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{formatTime(tx.timestamp)}</span>
                      </div>

                      {/* Transaction Title / Description */}
                      <p className="text-[11px] text-slate-300 leading-snug">
                        {isDeposit
                          ? `تم طلب إيداع مبلغ ${tx.amount.toFixed(2)} ج.م عبر ${tx.method || 'المحفظة'}`
                          : `تم طلب سحب مبلغ ${tx.amount.toFixed(2)} ج.م إلى ${tx.method || 'المحفظة'}`}
                      </p>

                      {/* Status and Action Details */}
                      <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-800/40">
                        <div className="flex items-center gap-1 text-[10px]">
                          {tx.status === 'completed' ? (
                            <span className="flex items-center gap-1 text-emerald-400 font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{isDeposit ? 'تم شحن الرصيد بنجاح' : 'تم التحويل بنجاح'}</span>
                            </span>
                          ) : tx.status === 'pending' ? (
                            <span className="flex items-center gap-1 text-amber-400 font-bold">
                              <Clock className="w-3 h-3 animate-spin" />
                              <span>قيد المراجعة والمعالجة</span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-400 font-bold">
                              <XCircle className="w-3 h-3" />
                              <span>مرفوض</span>
                            </span>
                          )}
                        </div>

                        <span className="text-xs font-black font-mono text-white" dir="ltr">
                          {isDeposit ? `+${tx.amount.toFixed(2)}` : `-${tx.amount.toFixed(2)}`} EGP
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Quick Links */}
          <div className="p-2 bg-[#0d162b] border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
            <button
              onClick={() => {
                setIsOpen(false);
                setScreen('deposit');
              }}
              className="flex-1 py-1.5 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-center font-bold text-[11px] border border-emerald-500/30 transition cursor-pointer flex items-center justify-center gap-1"
            >
              <span>عمل إيداع</span>
              <ChevronLeft className="w-3 h-3" />
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                setScreen('withdraw');
              }}
              className="flex-1 py-1.5 px-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg text-center font-bold text-[11px] border border-blue-500/30 transition cursor-pointer flex items-center justify-center gap-1"
            >
              <span>طلب سحب</span>
              <ChevronLeft className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

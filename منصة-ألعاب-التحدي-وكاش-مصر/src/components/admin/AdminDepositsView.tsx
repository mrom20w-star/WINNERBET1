import React, { useState } from 'react';
import {
  ArrowDownToLine,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Phone,
  Wallet,
  Eye,
  ImageIcon,
  MessageCircle,
  Copy,
  Check,
  AlertTriangle,
  Filter,
  Sparkles,
  ExternalLink,
  Coins,
  ShieldCheck,
} from 'lucide-react';
import { Transaction, UserAccount } from '../../types';
import { useApp } from '../../context/AppContext';

interface AdminDepositsViewProps {
  onOpenDepositChat: (tx: Transaction) => void;
  onViewReceiptImage: (img: string, tx: Transaction) => void;
  onRequestReject: (txId: string) => void;
  preselectedUserId?: string | null;
}

export const AdminDepositsView: React.FC<AdminDepositsViewProps> = ({
  onOpenDepositChat,
  onViewReceiptImage,
  onRequestReject,
  preselectedUserId,
}) => {
  const {
    transactions,
    allUsers,
    approveDeposit,
    connectedDevices,
    showToast,
  } = useApp();

  const [filter, setFilter] = useState<'pending' | 'completed' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState(preselectedUserId || '');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Check if player is online
  const isPlayerOnline = (userId: string, userPhone?: string): boolean => {
    const now = Date.now();
    const dev = (connectedDevices || []).find(
      (d) =>
        (Boolean(d.userId) && d.userId === userId) ||
        (Boolean(userPhone) && Boolean(d.phone) && d.phone === userPhone)
    );
    if (dev && dev.isOnline && now - (dev.lastSeen || 0) < 45000) return true;

    const u = allUsers.find((x) => x.id === userId || (Boolean(userPhone) && x.phone === userPhone));
    if (u && u.lastActive && now - u.lastActive < 60000) return true;

    return false;
  };

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  // Filter transactions
  const depositTxs = transactions.filter((t) => t.type === 'deposit');
  const pendingCount = depositTxs.filter((t) => t.status === 'pending').length;
  const completedCount = depositTxs.filter((t) => t.status === 'completed').length;
  const rejectedCount = depositTxs.filter((t) => t.status === 'rejected').length;

  const totalPendingAmount = depositTxs
    .filter((t) => t.status === 'pending')
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const displayedDeposits = depositTxs
    .filter((tx) => {
      if (filter !== 'all' && tx.status !== filter) return false;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        tx.id.toLowerCase().includes(q) ||
        tx.userId.toLowerCase().includes(q) ||
        (tx.userName && tx.userName.toLowerCase().includes(q)) ||
        (tx.senderPhone && tx.senderPhone.includes(q)) ||
        (tx.referenceCode && tx.referenceCode.toLowerCase().includes(q)) ||
        (tx.method && tx.method.toLowerCase().includes(q)) ||
        tx.amount.toString().includes(q)
      );
    })
    .sort((a, b) => b.timestamp - a.timestamp);

  // Method color helper
  const getMethodBadge = (method?: string) => {
    const m = (method || 'فودافون كاش').toLowerCase();
    if (m.includes('vodafone') || m.includes('فودافون')) {
      return { bg: 'bg-red-950/60 border-red-700/60 text-red-300', label: '🔴 فودافون كاش' };
    }
    if (m.includes('instapay') || m.includes('انستا') || m.includes('إنستا')) {
      return { bg: 'bg-purple-950/60 border-purple-700/60 text-purple-300', label: '⚡ انستاباي InstaPay' };
    }
    if (m.includes('etisalat') || m.includes('اتصالات')) {
      return { bg: 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300', label: '🟢 اتصالات كاش' };
    }
    if (m.includes('orange') || m.includes('اورانج') || m.includes('أورانج')) {
      return { bg: 'bg-orange-950/60 border-orange-700/60 text-orange-300', label: '🟠 أورانج كاش' };
    }
    if (m.includes('telda') || m.includes('تيلدا')) {
      return { bg: 'bg-indigo-950/60 border-indigo-700/60 text-indigo-300', label: '🟣 كارت تيلدا Telda' };
    }
    if (m.includes('usdt') || m.includes('كريبتو')) {
      return { bg: 'bg-teal-950/60 border-teal-700/60 text-teal-300', label: '💠 USDT TRC20' };
    }
    return { bg: 'bg-amber-950/60 border-amber-700/60 text-amber-300', label: method || 'محفظة إلكترونية' };
  };

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Top Banner & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/80 p-5 rounded-2xl border border-slate-700 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <ArrowDownToLine className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>إدارة ومراجعة طلبات إيداع اللاعبين</span>
              {pendingCount > 0 && (
                <span className="text-xs font-mono font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full animate-pulse">
                  {pendingCount} معلق
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              مراجعة سكرينات التحويل بدقة، ومحادثة كل لاعب في شات مخصص بالـ ID، وشحن الرصيد فورياً
            </p>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-xl px-3.5 py-2 flex flex-col">
            <span className="text-[10px] text-slate-400">إجمالي المعلق</span>
            <span className="text-sm font-black font-mono text-amber-400" dir="rtl">
              {totalPendingAmount.toFixed(2)} ج.م
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2 flex flex-col">
            <span className="text-[10px] text-slate-400">إجمالي الطلبات</span>
            <span className="text-sm font-black font-mono text-slate-200">
              {depositTxs.length} طلب
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/80">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => setFilter('pending')}
            className={`py-2 px-3.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              filter === 'pending'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>قيد المراجعة</span>
            {pendingCount > 0 && (
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-black ${
                filter === 'pending' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/30 text-amber-300'
              }`}>
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setFilter('completed')}
            className={`py-2 px-3.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              filter === 'completed'
                ? 'bg-emerald-600 text-white font-black shadow-lg shadow-emerald-600/20'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>المقبولة ({completedCount})</span>
          </button>

          <button
            onClick={() => setFilter('rejected')}
            className={`py-2 px-3.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              filter === 'rejected'
                ? 'bg-red-600 text-white font-black shadow-lg shadow-red-600/20'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>المرفوضة ({rejectedCount})</span>
          </button>

          <button
            onClick={() => setFilter('all')}
            className={`py-2 px-3.5 rounded-xl font-bold transition cursor-pointer whitespace-nowrap ${
              filter === 'all'
                ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            جميع الطلبات ({depositTxs.length})
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 sm:max-w-xs min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالـ ID (10 أرقام)، الهاتف، المبلغ..."
            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Deposits List Cards Feed */}
      {displayedDeposits.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <ArrowDownToLine className="w-12 h-12 text-slate-600" />
          <h3 className="text-base font-bold text-slate-300">لا توجد طلبات إيداع تطابق الفلتر الحالي</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            {searchQuery
              ? 'جرّب تعديل نص البحث أو إزالته لعرض جميع الطلبات'
              : 'جميع طلبات الإيداع في هذا القسم تمت معالجتها أو لا توجد طلبات جديدة'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedDeposits.map((tx) => {
            const online = isPlayerOnline(tx.userId, tx.userPhone);
            const userObj = allUsers.find(
              (u) => u.id === tx.userId || (Boolean(tx.userPhone) && u.phone === tx.userPhone)
            );
            const methodInfo = getMethodBadge(tx.method);

            return (
              <div
                key={tx.id}
                className={`bg-slate-800/90 rounded-2xl border p-4 sm:p-5 flex flex-col gap-4 shadow-xl transition hover:border-slate-600 ${
                  tx.status === 'pending'
                    ? 'border-amber-500/40 bg-gradient-to-b from-slate-800/90 to-amber-950/10'
                    : tx.status === 'completed'
                    ? 'border-emerald-500/30'
                    : 'border-red-500/30'
                }`}
              >
                {/* Header: Status & Transaction ID */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black text-amber-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                      {tx.id}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        tx.status === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse'
                          : tx.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {tx.status === 'pending'
                        ? '⏳ قيد المراجعة'
                        : tx.status === 'completed'
                        ? '✅ تم القبول والشحن'
                        : '❌ تم رفض الطلب'}
                    </span>
                  </div>

                  <span className="text-[11px] text-slate-400 font-medium">
                    {new Date(tx.timestamp).toLocaleString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: 'numeric',
                      month: 'numeric',
                    })}
                  </span>
                </div>

                {/* Player Profile & ID Row */}
                <div className="bg-[#0b1220] p-3 rounded-xl border border-slate-700/70 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold">
                        <User className="w-4 h-4" />
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0b1220] ${
                          online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                        }`}
                      />
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">{tx.userName || 'اللاعب'}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            online ? 'text-emerald-400 bg-emerald-950/60' : 'text-slate-500'
                          }`}
                        >
                          {online ? '🟢 متصل' : '⚪ غير متصل'}
                        </span>
                      </div>

                      {/* 10-Digit ID with copy */}
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[10px] text-slate-400">ID:</span>
                        <span className="font-mono font-extrabold text-amber-300 text-xs">{tx.userId}</span>
                        <button
                          onClick={() => handleCopy(tx.userId, `id-${tx.id}`)}
                          className="p-0.5 text-slate-400 hover:text-white"
                          title="نسخ المعرف"
                        >
                          {copiedField === `id-${tx.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Player current balance */}
                  {userObj && (
                    <div className="bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg text-xs text-right">
                      <span className="text-[9px] text-slate-400 block">رصيد اللاعب الآن:</span>
                      <span className="font-mono font-bold text-emerald-300" dir="rtl">
                        {userObj.balance.toFixed(2)} ج.م
                      </span>
                    </div>
                  )}
                </div>

                {/* Deposit Details Grid */}
                <div className="bg-slate-900/70 p-3.5 rounded-xl border border-slate-700/60 grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px]">المبلغ المطلوب:</span>
                    <span className="text-base font-black text-emerald-400 font-mono" dir="rtl">
                      {tx.amount.toFixed(2)} ج.م
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">وسيلة التحويل:</span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border inline-block mt-0.5 ${methodInfo.bg}`}>
                      {methodInfo.label}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">رقم المحفظة المحول منها:</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="font-mono font-bold text-white text-xs" dir="ltr">
                        {tx.senderPhone || 'غير محدد'}
                      </span>
                      {tx.senderPhone && (
                        <button
                          onClick={() => handleCopy(tx.senderPhone || '', `phone-${tx.id}`)}
                          className="p-0.5 text-slate-400 hover:text-white"
                        >
                          {copiedField === `phone-${tx.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px]">كود العملية / المرجع:</span>
                    <span className="font-mono font-bold text-slate-200 text-xs block truncate mt-0.5">
                      {tx.referenceCode || tx.id}
                    </span>
                  </div>
                </div>

                {/* Screenshot Receipt Card */}
                {tx.receiptImage ? (
                  <div className="bg-slate-900/90 p-3 rounded-xl border border-blue-500/40 flex items-center justify-between gap-3 shadow-inner">
                    <div className="flex items-center gap-3">
                      <div
                        onClick={() => onViewReceiptImage(tx.receiptImage || '', tx)}
                        className="relative group cursor-pointer w-16 h-16 rounded-xl overflow-hidden border-2 border-blue-400/50 shadow-md shrink-0"
                      >
                        <img
                          src={tx.receiptImage}
                          alt="إيصال التحويل"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <Eye className="w-5 h-5 text-white" />
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-xs font-black text-blue-300 flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                          <span>صورة سكرين شوت الإيصال</span>
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                          انقر لمعاينة الإيصال بملء الشاشة وتكبير تفاصيل التحويل بدقة
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onViewReceiptImage(tx.receiptImage || '', tx)}
                      className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>معاينة وتكبير</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-900/40 px-3 py-2 rounded-xl border border-slate-800 text-[11px] text-slate-500 text-center">
                    لم يرفق اللاعب صورة إيصال مع هذا الطلب (تحويل مباشر)
                  </div>
                )}

                {/* Rejection note */}
                {tx.note && (
                  <div className="bg-red-950/40 border border-red-800/40 p-2.5 rounded-xl text-xs text-red-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>سبب الرفض: {tx.note}</span>
                  </div>
                )}

                {/* Action Buttons Row */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  {/* Dedicated Chat with Player button */}
                  <button
                    onClick={() => onOpenDepositChat(tx)}
                    id={`chat-deposit-${tx.id}`}
                    className="py-2.5 px-3.5 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>محادثة اللاعب بخصوص الإيداع</span>
                  </button>

                  {/* If pending: Approve & Reject buttons */}
                  {tx.status === 'pending' && (
                    <>
                      <button
                        onClick={() => approveDeposit(tx.id)}
                        id={`approve-deposit-${tx.id}`}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-1.5 cursor-pointer transition active:scale-98"
                      >
                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                        <span>قبول وإضافة {tx.amount} ج.م</span>
                      </button>

                      <button
                        onClick={() => onRequestReject(tx.id)}
                        id={`reject-deposit-${tx.id}`}
                        className="py-2.5 px-3.5 rounded-xl bg-red-950 hover:bg-red-900 border border-red-700 text-red-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>رفض</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

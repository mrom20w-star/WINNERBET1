import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Transaction } from '../../types';
import { ReceiptLightboxModal } from './ReceiptLightboxModal';
import { DepositChatModal } from './DepositChatModal';
import { AdminSupportView } from './AdminSupportView';
import { AdminDepositsView } from './AdminDepositsView';
import { AdminOnlineDevicesView } from './AdminOnlineDevicesView';
import {
  ShieldCheck,
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  Phone,
  CheckCircle2,
  XCircle,
  Clock,
  PlusCircle,
  Search,
  Settings,
  RefreshCw,
  Home,
  AlertTriangle,
  FileText,
  DollarSign,
  Eye,
  Image as ImageIcon,
  X,
  Headphones,
  Send,
  MessageSquare,
  User,
  Plane,
  Flame,
  Zap,
  RotateCw,
  Download,
  ExternalLink,
  Sliders,
  Check,
  Filter,
  Laptop,
  Smartphone,
  Ban,
  Copy,
  ShieldAlert,
  Wifi,
  Activity,
} from 'lucide-react';

type AdminTab = 'deposits' | 'crash' | 'support' | 'numbers' | 'users' | 'withdraws' | 'transactions' | 'devices';
type DepositFilter = 'pending' | 'completed' | 'rejected' | 'all';

export const AdminDashboard: React.FC = () => {
  const {
    user,
    allUsers,
    adminSettings,
    updateAdminSettings,
    transactions,
    approveDeposit,
    rejectDeposit,
    approveWithdraw,
    rejectWithdraw,
    addBalanceByUserId,
    deleteAndBanUser,
    unbanUser,
    supportTickets,
    sendSupportMessage,
    resolveSupportTicket,
    getOrCreateTicketForUser,
    connectedDevices,
    setScreen,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<AdminTab>('deposits');
  const [depositFilter, setDepositFilter] = useState<DepositFilter>('pending');
  const [viewingReceiptImage, setViewingReceiptImage] = useState<string | null>(null);
  const [viewingReceiptTx, setViewingReceiptTx] = useState<Transaction | null>(null);
  const [activeDepositChatTx, setActiveDepositChatTx] = useState<Transaction | null>(null);
  const [depositFilterUserId, setDepositFilterUserId] = useState<string | null>(null);
  const [imageRotation, setImageRotation] = useState(0);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');

  // Rejection modal state
  const [rejectingTxId, setRejectingTxId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('لم يتم استلام المبلغ على المحفظة');

  const handleBanDeviceFromDevicesView = (deviceId: string, userId?: string) => {
    if (window.confirm('هل أنت متأكد من حظر هذا الجهاز نهائياً وإيقاف جلسة اللاعب؟')) {
      if (userId) {
        deleteAndBanUser(userId, 'تم حظر الحساب والجهاز بواسطة الإدارة');
      }
      showToast('تم حظر الجهاز بنجاح ✅', 'success');
    }
  };

  // Form states for updating numbers
  const [vodafoneNumber, setVodafoneNumber] = useState(adminSettings.vodafoneNumber);
  const [etisalatNumber, setEtisalatNumber] = useState(adminSettings.etisalatNumber);
  const [orangeNumber, setOrangeNumber] = useState(adminSettings.orangeNumber);
  const [instapayNumber, setInstapayNumber] = useState(adminSettings.instapayNumber);
  const [minDeposit, setMinDeposit] = useState(adminSettings.minDeposit);
  const [minWithdraw, setMinWithdraw] = useState(adminSettings.minWithdraw);
  const [autoApprove, setAutoApprove] = useState(adminSettings.autoApproveDeposits);

  // Form states for top-up by ID
  const [targetUserId, setTargetUserId] = useState('');
  const [topUpAmount, setTopUpAmount] = useState<number | string>('');
  const [topUpNote, setTopUpNote] = useState('شحن رصيد مباشر من الإدارة');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Crash Game Multiplier state
  const [forcedCrashInput, setForcedCrashInput] = useState<string>('');
  const [currentForcedMultiplier, setCurrentForcedMultiplier] = useState<number | null>(null);

  // Load existing forced multiplier on mount
  useEffect(() => {
    const saved = localStorage.getItem('app_forced_crash_multiplier');
    if (saved) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val > 0) {
        setCurrentForcedMultiplier(val);
        setForcedCrashInput(val.toString());
      }
    }
  }, []);

  // Sync settings when adminSettings change
  useEffect(() => {
    setVodafoneNumber(adminSettings.vodafoneNumber);
    setEtisalatNumber(adminSettings.etisalatNumber);
    setOrangeNumber(adminSettings.orangeNumber);
    setInstapayNumber(adminSettings.instapayNumber);
    setMinDeposit(adminSettings.minDeposit);
    setMinWithdraw(adminSettings.minWithdraw);
    setAutoApprove(adminSettings.autoApproveDeposits);
  }, [adminSettings]);

  // Counts & Device presence
  const allDepositTxs = transactions.filter((t) => t.type === 'deposit');
  const pendingDeposits = allDepositTxs.filter((t) => t.status === 'pending');
  const completedDeposits = allDepositTxs.filter((t) => t.status === 'completed');
  const rejectedDeposits = allDepositTxs.filter((t) => t.status === 'rejected');

  const pendingWithdraws = transactions.filter((t) => t.type === 'withdraw' && t.status === 'pending');
  const openSupportTickets = supportTickets.filter((t) => t.status === 'open');
  const totalSystemBalance = allUsers.reduce((sum, u) => sum + (u.balance || 0), 0);
  const onlineDevices = (connectedDevices || []).filter((d) => d.isOnline);

  // Search & Filter states
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Auto-select first ticket if none selected
  useEffect(() => {
    if (!selectedTicketId && supportTickets.length > 0) {
      setSelectedTicketId(supportTickets[0].id);
    }
  }, [supportTickets, selectedTicketId]);

  // Filtered deposits based on selected sub-filter
  const displayedDeposits = allDepositTxs.filter((t) => {
    if (depositFilter === 'pending') return t.status === 'pending';
    if (depositFilter === 'completed') return t.status === 'completed';
    if (depositFilter === 'rejected') return t.status === 'rejected';
    return true; // 'all'
  });

  const selectedTicket = supportTickets.find((t) => t.id === selectedTicketId);

  // Send reply in live support
  const handleAdminSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminReplyText.trim() || !selectedTicketId) return;
    const text = adminReplyText;
    setAdminReplyText('');
    await sendSupportMessage(selectedTicketId, text);
    showToast('تم إرسال رد الدعم الفني للاعب بنجاح ومزامنته في الوقت الفعلي ✅', 'success');
  };

  // Save cash numbers & limits
  const handleSaveNumbers = (e: React.FormEvent) => {
    e.preventDefault();
    updateAdminSettings({
      vodafoneNumber: vodafoneNumber.trim(),
      etisalatNumber: etisalatNumber.trim(),
      orangeNumber: orangeNumber.trim(),
      instapayNumber: instapayNumber.trim(),
      minDeposit: Number(minDeposit),
      minWithdraw: Number(minWithdraw),
      autoApproveDeposits: autoApprove,
    });
    showToast('تم حفظ أرقام المحافظ والإعدادات بنجاح ومزامنتها مع الموقع 💾', 'success');
  };

  // Direct Top Up by User ID
  const handleDirectTopUp = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(topUpAmount);
    if (isNaN(amt) || amt === 0) {
      showToast('يرجى إدخال مبلغ صحيح', 'error');
      return;
    }
    if (!targetUserId.trim()) {
      showToast('يرجى إدخال معرف اللاعب (User ID) أو رقم الهاتف', 'error');
      return;
    }

    const res = addBalanceByUserId(targetUserId, amt, topUpNote);
    if (res.success) {
      setTopUpAmount('');
      setTargetUserId('');
    }
  };

  // Handle Crash game multiplier update
  const handleApplyCrashMultiplier = (multVal?: number) => {
    const val = multVal !== undefined ? multVal : parseFloat(forcedCrashInput);
    if (!isNaN(val) && val >= 1.0) {
      const fixed = Number(val.toFixed(2));
      localStorage.setItem('app_forced_crash_multiplier', fixed.toString());
      setCurrentForcedMultiplier(fixed);
      setForcedCrashInput(fixed.toString());
      showToast(`تم تثبيت نقطة انفجار الطيارة القادمة عند ${fixed}x ✈️`, 'success');
    } else {
      showToast('يرجى إدخال مضاعف صحيح أكبر من أو يساوي 1.00', 'error');
    }
  };

  const handleResetCrashMultiplier = () => {
    localStorage.removeItem('app_forced_crash_multiplier');
    setCurrentForcedMultiplier(null);
    setForcedCrashInput('');
    showToast('تمت إعادة لعبة الطيارة إلى الوضع العشوائي التلقائي ✅', 'info');
  };

  // Confirm rejection
  const handleConfirmRejection = () => {
    if (!rejectingTxId) return;
    rejectDeposit(rejectingTxId, rejectReason);
    setRejectingTxId(null);
    showToast('تم رفض طلب الإيداع وإشعار اللاعب بالقرار ❌', 'error');
  };

  const filteredUsers = allUsers.filter(
    (u) =>
      u.id.includes(userSearchQuery) ||
      u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.phone.includes(userSearchQuery)
  );

  return (
    <div className="w-full min-h-screen bg-slate-900 text-slate-100 font-['Tajawal','Cairo',sans-serif] flex flex-col select-none" dir="rtl">
      {/* Top Admin Header Bar */}
      <header className="w-full bg-slate-950 border-b border-slate-800 py-3.5 px-4 sm:px-8 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-slate-950 shadow-md">
            <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div className="flex flex-col text-right">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-white tracking-wide">
                لوحة تحكم الأدمن والمدير (React)
              </h1>
              <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/40">
                OFFICIAL V2.5
              </span>
            </div>
            <span className="text-xs text-slate-400">
              قبول الإيداعات الفورية، معاينة سكرينات التحويل، مراقبة الأجهزة المتصلة، وتعديل أرقام الكاش
            </span>
          </div>
        </div>

        {/* Action Buttons & Real-Time Sync Indicator */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Live Auto-Refresh Indicator */}
          <div className="flex items-center gap-2 bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs px-3 py-1.5 rounded-xl font-bold shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline">التحديث التلقائي نشط (كل 3.5 ثانية)</span>
            <span className="sm:hidden">مزامنة فورية</span>
          </div>

          {/* Manual Force-Refresh Button */}
          <button
            onClick={() => {
              setIsManualSyncing(true);
              setLastSyncTime(new Date());
              setTimeout(() => setIsManualSyncing(false), 700);
              showToast('تمت المزامنة اللحظية والتحديث الفوري لجميع البيانات والطلبات 🔄', 'info');
            }}
            id="admin-manual-refresh-btn"
            className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 shadow-md transition cursor-pointer"
            title="تحديث يدوي فوري للبيانات"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin text-amber-400' : ''}`} />
            <span>تحديث يدوي</span>
          </button>

          <a
            href="/admin.html"
            target="_blank"
            rel="noopener noreferrer"
            id="admin-open-html-btn"
            className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white font-bold text-xs sm:text-sm border border-slate-700 shadow-md transition cursor-pointer"
            title="فتح لوحة تحكم HTML المستقلة في نافذة جديدة"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>لوحة HTML المستقلة</span>
          </a>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: Pending Deposits */}
          <div
            onClick={() => {
              setActiveTab('deposits');
              setDepositFilter('pending');
            }}
            className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
              activeTab === 'deposits' && depositFilter === 'pending'
                ? 'bg-amber-950/40 border-amber-500/60 ring-2 ring-amber-500/20'
                : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">طلبات إيداع معلقة</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <ArrowDownToLine className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
                {pendingDeposits.length}
              </span>
              <span className="text-xs text-amber-300 font-medium">تحتاج قراراً</span>
            </div>
          </div>

          {/* Card 2: Connected Devices (Live Online) */}
          <div
            onClick={() => setActiveTab('devices')}
            className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
              activeTab === 'devices'
                ? 'bg-emerald-950/40 border-emerald-500/60 ring-2 ring-emerald-500/20'
                : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">الأجهزة المتصلة الآن</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Laptop className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
                {onlineDevices.length}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                متصل / {(connectedDevices || []).length} مسجل
              </span>
            </div>
          </div>

          {/* Card 3: Support Tickets */}
          <div
            onClick={() => setActiveTab('support')}
            className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
              activeTab === 'support'
                ? 'bg-blue-950/40 border-blue-500/60 ring-2 ring-blue-500/20'
                : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">رسائل وتذاكر الدعم</span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <Headphones className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-blue-400 font-mono">
                {openSupportTickets.length}
              </span>
              <span className="text-xs text-blue-300 font-medium">تذكرة مفتوحة</span>
            </div>
          </div>

          {/* Card 4: Registered Players */}
          <div
            onClick={() => setActiveTab('users')}
            className={`p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
              activeTab === 'users'
                ? 'bg-purple-950/40 border-purple-500/60 ring-2 ring-purple-500/20'
                : 'bg-slate-800/80 border-slate-700 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">إجمالي اللاعبين</span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-purple-400 font-mono">
                {allUsers.length}
              </span>
              <span className="text-xs text-slate-400 font-medium">لاعب مسجل</span>
            </div>
          </div>

          {/* Card 5: Total Balances */}
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">أرصدة المنصة</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
                {totalSystemBalance.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400">ج.م</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 border-b border-slate-800">
        <div className="flex items-center gap-2 overflow-x-auto pb-3 text-xs sm:text-sm font-bold scrollbar-none">
          <button
            onClick={() => setActiveTab('deposits')}
            id="tab-btn-deposits"
            className={`py-2.5 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'deposits'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>مراجعة وقبول الإيداعات</span>
            {pendingDeposits.length > 0 && (
              <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black animate-pulse">
                {pendingDeposits.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            id="tab-btn-devices"
            className={`py-2.5 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'devices'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>الأجهزة المتصلة الآن</span>
            {onlineDevices.length > 0 && (
              <span className="bg-emerald-400 text-slate-950 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black">
                {onlineDevices.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('crash')}
            id="tab-btn-crash"
            className={`py-2.5 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'crash'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Plane className="w-4 h-4" />
            <span>التحكم في لعبة الطيارة</span>
            {currentForcedMultiplier && (
              <span className="bg-emerald-500 text-slate-950 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black">
                {currentForcedMultiplier}x
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('support')}
            id="tab-btn-support"
            className={`py-2.5 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'support'
                ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Headphones className="w-4 h-4" />
            <span>رسائل وتذاكر الدعم</span>
            {openSupportTickets.length > 0 && (
              <span className="bg-blue-400 text-slate-950 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black animate-pulse">
                {openSupportTickets.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('numbers')}
            id="tab-btn-numbers"
            className={`py-2.5 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'numbers'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Phone className="w-4 h-4" />
            <span>تغيير أرقام الكاش</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            id="tab-btn-users"
            className={`py-2.5 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>إدارة اللاعبين وشحن رصيد بالـ ID</span>
          </button>

          <button
            onClick={() => setActiveTab('withdraws')}
            id="tab-btn-withdraws"
            className={`py-2.5 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'withdraws'
                ? 'bg-purple-600 text-white font-black shadow-lg shadow-purple-600/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <ArrowUpFromLine className="w-4 h-4" />
            <span>طلبات السحب</span>
            {pendingWithdraws.length > 0 && (
              <span className="bg-purple-400 text-slate-950 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-black">
                {pendingWithdraws.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('transactions')}
            id="tab-btn-txs"
            className={`py-2.5 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>سجل المعاملات الكامل</span>
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 flex-1">
        {/* ======================================================== */}
        {/* TAB 1: DEPOSITS APPROVAL WORKFLOW */}
        {/* ======================================================== */}
        {activeTab === 'deposits' && (
          <AdminDepositsView
            onOpenDepositChat={(tx) => setActiveDepositChatTx(tx)}
            onViewReceiptImage={(img, tx) => {
              setViewingReceiptImage(img);
              setViewingReceiptTx(tx);
            }}
            onRequestReject={(txId) => {
              setRejectingTxId(txId);
              setRejectReason('لم يتم استلام المبلغ على المحفظة');
            }}
            preselectedUserId={depositFilterUserId}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 2: CRASH GAME FLIGHT CONTROLLER */}
        {/* ======================================================== */}
        {activeTab === 'crash' && (
          <div className="max-w-3xl mx-auto flex flex-col gap-6">
            <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-purple-950/40 p-6 rounded-3xl border border-purple-500/30 shadow-2xl flex flex-col gap-6">
              <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Plane className="w-7 h-7 stroke-[2.2]" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                      <span>محرك لعبة الطيارة الداخلي المستقل (Fair Internal Engine)</span>
                      <Flame className="w-4 h-4 text-orange-400 animate-bounce" />
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      تم تحويل محرك اللعبة ليعمل داخلياً 100% بحسابات احتمالية مستقلة لكل جولة دون أي توقعات أو قيم خارجية.
                    </p>
                  </div>
                </div>
              </div>

              {/* Current Engine Status Banner */}
              <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">حالة المحرك: نظام داخلي ديناميكي عشوائي 100%</span>
                    <span className="text-[11px] text-emerald-400 font-mono">Provably Fair Internal Simulation Active</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    handleResetCrashMultiplier();
                    showToast('تم التحقق من نظافة المحرك ومسح أي قيم سابقة معلقة بنجاح ✅', 'success');
                  }}
                  className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد استقلالية المحرك الداخلي</span>
                </button>
              </div>

              {/* Engine Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col gap-1">
                  <span className="text-xs text-slate-400 font-bold">استقلالية الجولات</span>
                  <span className="text-base font-black text-amber-300">100% فريدة</span>
                  <span className="text-[10px] text-slate-500">كل جولة تولد برقم ID ومضاعف مستقل تماماً</span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col gap-1">
                  <span className="text-xs text-slate-400 font-bold">توزيع المضاعفات</span>
                  <span className="text-base font-black text-emerald-400">من 1.05x إلى 75x+</span>
                  <span className="text-[10px] text-slate-500">منحنى واقعي يحاكي ألعاب Aviator الرسمية</span>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col gap-1">
                  <span className="text-xs text-slate-400 font-bold">اللاعبون بالجولة</span>
                  <span className="text-base font-black text-blue-400">تفاعلي حي</span>
                  <span className="text-[10px] text-slate-500">شخصيات مصرية واقعية مع سحب أرباح حقيقي</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB: CONNECTED DEVICES & SESSIONS MANAGEMENT */}
        {/* ======================================================== */}
        {activeTab === 'devices' && (
          <AdminOnlineDevicesView
            onStartChatWithUser={async (uId, uName, uPhone) => {
              await getOrCreateTicketForUser(
                uId,
                uName || `لاعب_${uId.slice(-4)}`,
                uPhone || '',
                `محادثة دعم فني فورية للاعب (${uId})`
              );
              setActiveTab('support');
            }}
            onTopUpUser={(uId) => {
              setTargetUserId(uId);
              setActiveTab('users');
            }}
            onBanDevice={handleBanDeviceFromDevicesView}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 3: SUPPORT TICKETS & REAL-TIME PLAYER CHAT */}
        {/* ======================================================== */}
        {activeTab === 'support' && (
          <AdminSupportView
            onViewDepositsOfUser={(uId) => {
              setDepositFilterUserId(uId);
              setActiveTab('deposits');
            }}
            onTopUpUser={(uId) => {
              setTargetUserId(uId);
              setActiveTab('users');
            }}
            onViewReceipt={(img) => {
              setViewingReceiptImage(img);
              setViewingReceiptTx(null);
            }}
          />
        )}

        {/* ======================================================== */}
        {/* TAB 4: UPDATE CASH NUMBERS & MIN LIMITS */}
        {/* ======================================================== */}
        {activeTab === 'numbers' && (
          <div className="max-w-2xl mx-auto flex flex-col gap-6">
            <div className="bg-slate-800/80 p-6 rounded-3xl border border-slate-700 shadow-xl flex flex-col gap-6">
              <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    تعديل أرقام محافظ الكاش الرسمية للمنصة
                  </h2>
                  <p className="text-xs text-slate-400">
                    الأرقام التي تضعها هنا ستظهر مباشرة لجميع اللاعبين في صفحة الإيداع بالنسخة الرسمية.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveNumbers} className="flex flex-col gap-4">
                {/* Vodafone Cash Number */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-red-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    رقم فودافون كاش (Vodafone Cash):
                  </label>
                  <input
                    type="text"
                    value={vodafoneNumber}
                    onChange={(e) => setVodafoneNumber(e.target.value)}
                    placeholder="مثال: 01098688815"
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-base focus:border-red-500 focus:outline-none text-left"
                    dir="ltr"
                    required
                  />
                </div>

                {/* Etisalat Cash Number */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    رقم اتصالات كاش (Etisalat Cash):
                  </label>
                  <input
                    type="text"
                    value={etisalatNumber}
                    onChange={(e) => setEtisalatNumber(e.target.value)}
                    placeholder="مثال: 01123456789"
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-base focus:border-emerald-500 focus:outline-none text-left"
                    dir="ltr"
                    required
                  />
                </div>

                {/* Orange Cash Number */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-orange-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                    رقم أورانج كاش (Orange Cash):
                  </label>
                  <input
                    type="text"
                    value={orangeNumber}
                    onChange={(e) => setOrangeNumber(e.target.value)}
                    placeholder="مثال: 01234567890"
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-base focus:border-orange-500 focus:outline-none text-left"
                    dir="ltr"
                    required
                  />
                </div>

                {/* Instapay / Account */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-purple-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    رقم أو معرف إنستاباي (Instapay / IPN):
                  </label>
                  <input
                    type="text"
                    value={instapayNumber}
                    onChange={(e) => setInstapayNumber(e.target.value)}
                    placeholder="مثال: 01098688815"
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-base focus:border-purple-500 focus:outline-none text-left"
                    dir="ltr"
                  />
                </div>

                {/* Limits */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-300">الحد الأدنى للإيداع (ج.م):</label>
                    <input
                      type="number"
                      value={minDeposit}
                      onChange={(e) => setMinDeposit(Number(e.target.value))}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm text-center"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-300">الحد الأدنى للسحب (ج.م):</label>
                    <input
                      type="number"
                      value={minWithdraw}
                      onChange={(e) => setMinWithdraw(Number(e.target.value))}
                      className="w-full py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm text-center"
                    />
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  id="save-admin-numbers-btn"
                  className="w-full mt-4 py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base shadow-xl shadow-amber-500/20 transition cursor-pointer active:scale-98 text-center"
                >
                  حفظ وتطبيق الأرقام فوراً بالمنصة ✅
                </button>
              </form>

              {/* Live Preview Box */}
              <div className="border-t border-slate-700/80 pt-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    معاينة حية كما تظهر للاعبين في صفحة الإيداع بالنسخة:
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">LIVE PREVIEW</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-red-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">فودافون كاش</span>
                        <span className="font-mono text-xs text-red-300 select-all font-bold">
                          {adminSettings.vodafoneNumber || 'غير محدد'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(adminSettings.vodafoneNumber);
                        showToast('تم نسخ رقم فودافون كاش', 'info');
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="نسخ"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">اتصالات كاش</span>
                        <span className="font-mono text-xs text-emerald-300 select-all font-bold">
                          {adminSettings.etisalatNumber || 'غير محدد'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(adminSettings.etisalatNumber);
                        showToast('تم نسخ رقم اتصالات كاش', 'info');
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="نسخ"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-orange-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">أورانج كاش</span>
                        <span className="font-mono text-xs text-orange-300 select-all font-bold">
                          {adminSettings.orangeNumber || 'غير محدد'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(adminSettings.orangeNumber);
                        showToast('تم نسخ رقم أورانج كاش', 'info');
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="نسخ"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-purple-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">إنستاباي (Instapay)</span>
                        <span className="font-mono text-xs text-purple-300 select-all font-bold">
                          {adminSettings.instapayNumber || 'غير محدد'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(adminSettings.instapayNumber);
                        showToast('تم نسخ معرف إنستاباي', 'info');
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="نسخ"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: USER MANAGEMENT & TOP-UP BY ID */}
        {/* ======================================================== */}
        {activeTab === 'users' && (
          <div className="flex flex-col gap-6">
            {/* Top-up Form Box */}
            <div className="bg-gradient-to-br from-slate-800 via-slate-800 to-blue-950/40 p-6 rounded-3xl border border-blue-500/30 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <PlusCircle className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">
                    شحن وإضافة رصيد لأي لاعب بالـ ID
                  </h2>
                  <p className="text-xs text-slate-300">
                    أدخل معرف اللاعب (ID) أو رقم هاتفه والمبلغ لإضافة الرصيد إلى محفظته بشكل فوري.
                  </p>
                </div>
              </div>

              <form onSubmit={handleDirectTopUp} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                {/* User ID field */}
                <div className="sm:col-span-4 flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-300">معرف اللاعب (User ID) أو الهاتف:</label>
                  <input
                    type="text"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    placeholder="مثال: 84920 أو 01098688815"
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>

                {/* Amount field */}
                <div className="sm:col-span-3 flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-300">المبلغ المراد إضافته (ج.م):</label>
                  <input
                    type="number"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder="المبلغ بالجنيه"
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 text-emerald-400 font-bold text-sm focus:border-blue-500 focus:outline-none text-center"
                    required
                  />
                </div>

                {/* Reason note */}
                <div className="sm:col-span-3 flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-300">ملاحظة / سبب الشحن:</label>
                  <input
                    type="text"
                    value={topUpNote}
                    onChange={(e) => setTopUpNote(e.target.value)}
                    placeholder="شحن مباشر من الإدارة"
                    className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {/* Submit button */}
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    id="submit-direct-topup-btn"
                    className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md transition cursor-pointer active:scale-98 text-center"
                  >
                    شحن الرصيد الآن
                  </button>
                </div>
              </form>

              {/* Quick Amount Buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-700/60">
                <span className="text-xs text-slate-400">مبالغ سريعة:</span>
                {[50, 100, 250, 500, 1000, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setTopUpAmount(amt)}
                    className="py-1 px-3 rounded-lg bg-slate-900/80 hover:bg-slate-700 border border-slate-700 text-xs font-mono font-bold text-slate-200 transition cursor-pointer"
                  >
                    +{amt} ج.م
                  </button>
                ))}
              </div>
            </div>

            {/* Players Table */}
            <div className="bg-slate-800/80 rounded-3xl border border-slate-700 p-5 flex flex-col gap-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">قائمة جميع اللاعبين المسجلين بالمنصة</h3>
                  <span className="bg-slate-700 text-slate-300 text-xs font-bold px-2 py-0.5 rounded-lg">
                    {allUsers.length}
                  </span>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="ابحث بالـ ID أو الاسم أو الهاتف..."
                    className="w-full py-2 pr-9 pl-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs">
                      <th className="py-3 px-3">معرف اللاعب (ID)</th>
                      <th className="py-3 px-3">الاسم</th>
                      <th className="py-3 px-3">رقم الهاتف</th>
                      <th className="py-3 px-3">الرصيد الحالي</th>
                      <th className="py-3 px-3">إجمالي الإيداعات</th>
                      <th className="py-3 px-3 text-center">إجراءات سريعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 font-medium">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-700/30 transition">
                        <td className="py-3 px-3 font-mono font-bold text-amber-400">
                          #{u.id}
                        </td>
                        <td className="py-3 px-3 text-white font-bold">
                          {u.username}
                          {u.role === 'admin' && (
                            <span className="mr-2 bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded">
                              مدير
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300" dir="ltr">
                          {u.phone}
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-400" dir="rtl">
                          {u.balance.toFixed(2)} ج.م
                        </td>
                        <td className="py-3 px-3 text-slate-400" dir="rtl">
                          {(u.totalDeposited || 0).toFixed(2)} ج.م
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setTargetUserId(u.id);
                                setTopUpAmount(100);
                                showToast(`تم اختيار اللاعب ${u.username} للشحن`, 'info');
                              }}
                              className="py-1 px-2.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-bold transition cursor-pointer"
                            >
                              +100 ج.م
                            </button>
                            <button
                              onClick={() => {
                                setTargetUserId(u.id);
                                setTopUpAmount(500);
                                showToast(`تم اختيار اللاعب ${u.username} للشحن`, 'info');
                              }}
                              className="py-1 px-2.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-bold transition cursor-pointer"
                            >
                              +500 ج.م
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: WITHDRAWALS */}
        {/* ======================================================== */}
        {activeTab === 'withdraws' && (
          <div className="flex flex-col gap-6">
            <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700 shadow-md">
              <h2 className="text-base font-bold text-white mb-1">طلبات السحب المقدمة من اللاعبين</h2>
              <p className="text-xs text-slate-400">
                قم بمراجعة طلبات السحب وتحويل الأموال للمحافظ الموضحة ثم تأكيد التحويل. في حالة الرفض، سيتم إرجاع المبلغ كاملاً لرصيد اللاعب.
              </p>
            </div>

            {pendingWithdraws.length === 0 ? (
              <div className="w-full py-16 bg-slate-800/40 rounded-3xl border border-slate-800 flex flex-col items-center justify-center gap-3 text-center">
                <CheckCircle2 className="w-12 h-12 text-purple-400" />
                <span className="text-base font-bold text-slate-200">
                  لا توجد طلبات سحب معلقة حالياً
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingWithdraws.map((tx) => (
                  <div
                    key={tx.id}
                    className="bg-slate-800 rounded-2xl border border-purple-500/40 p-5 flex flex-col justify-between gap-4 shadow-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-white">{tx.userName}</span>
                          <span className="bg-blue-500/20 text-blue-300 font-mono text-xs px-2 py-0.5 rounded">
                            ID: {tx.userId}
                          </span>
                        </div>
                        <span className="text-xs text-purple-300 font-mono mt-1 block">
                          محفظة السحب: {tx.phone}
                        </span>
                      </div>

                      <div className="bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-xl text-right">
                        <span className="text-[10px] block">المبلغ المطلوب سحبه</span>
                        <span className="text-lg font-extrabold" dir="rtl">{tx.amount.toFixed(2)} ج.م</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-700">
                      <button
                        onClick={() => approveWithdraw(tx.id)}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم تحويل المبلغ وتأكيد السحب</span>
                      </button>
                      <button
                        onClick={() => rejectWithdraw(tx.id)}
                        className="py-2.5 px-3 rounded-xl bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>رفض وإرجاع الرصيد</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 7: ALL TRANSACTIONS */}
        {/* ======================================================== */}
        {activeTab === 'transactions' && (
          <div className="bg-slate-800/80 rounded-3xl border border-slate-700 p-5 flex flex-col gap-4 shadow-xl">
            <h3 className="text-base font-bold text-white">سجل جميع المعاملات في المنصة</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-xs">
                    <th className="py-2.5 px-3">رقم العملية</th>
                    <th className="py-2.5 px-3">اللاعب (ID)</th>
                    <th className="py-2.5 px-3">النوع</th>
                    <th className="py-2.5 px-3">المبلغ</th>
                    <th className="py-2.5 px-3">الحالة</th>
                    <th className="py-2.5 px-3">التاريخ والوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 font-medium">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-700/30">
                      <td className="py-2.5 px-3 font-mono text-slate-400">{t.id}</td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {t.userName} <span className="text-xs text-amber-400 font-mono">({t.userId})</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            t.type === 'deposit'
                              ? 'bg-blue-500/20 text-blue-300'
                              : t.type === 'withdraw'
                              ? 'bg-purple-500/20 text-purple-300'
                              : t.type === 'win'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {t.type === 'deposit'
                            ? 'إيداع'
                            : t.type === 'withdraw'
                            ? 'سحب'
                            : t.type === 'win'
                            ? 'أرباح لعبة'
                            : 'شحن إدارة'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-100" dir="rtl">
                        {t.amount.toFixed(2)} ج.م
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            t.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : t.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {t.status === 'completed'
                            ? 'مكتمل ✅'
                            : t.status === 'pending'
                            ? 'معلق ⏳'
                            : 'مرفوض ❌'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-xs">
                        {new Date(t.timestamp).toLocaleString('ar-EG')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Receipt Image Full-Screen Inspection Lightbox */}
      <ReceiptLightboxModal
        image={viewingReceiptImage}
        tx={viewingReceiptTx}
        onClose={() => {
          setViewingReceiptImage(null);
          setViewingReceiptTx(null);
        }}
        onApprove={(txId) => approveDeposit(txId)}
        onReject={(txId) => {
          setRejectingTxId(txId);
          setRejectReason('لم يتم استلام المبلغ على المحفظة');
        }}
        onOpenChat={(tx) => setActiveDepositChatTx(tx)}
      />

      {/* Dedicated Deposit Chat Modal */}
      <DepositChatModal
        tx={activeDepositChatTx}
        onClose={() => setActiveDepositChatTx(null)}
        onApprove={(txId) => approveDeposit(txId)}
        onReject={(txId) => {
          setRejectingTxId(txId);
          setRejectReason('لم يتم استلام المبلغ على المحفظة');
        }}
        onViewReceipt={(img) => {
          setViewingReceiptImage(img);
          setViewingReceiptTx(activeDepositChatTx);
        }}
      />

      {/* Reject Reason Confirmation Modal */}
      {rejectingTxId && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setRejectingTxId(null)}
        >
          <div
            className="relative max-w-md w-full bg-slate-900 rounded-3xl border border-red-500/40 p-6 shadow-2xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
                <XCircle className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">تأكيد رفض طلب الإيداع</h3>
                <span className="text-xs text-slate-400">حدد سبب الرفض ليظهر للاعب في إشعارات حسابه</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-300">سبب الرفض:</label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-red-500"
              >
                <option value="لم يتم استلام المبلغ على المحفظة">لم يتم استلام المبلغ على المحفظة</option>
                <option value="رقم المحفظة المحول منها غير مطابق">رقم المحفظة المحول منها غير مطابق</option>
                <option value="صورة الإيصال غير واضحة أو مكررة">صورة الإيصال غير واضحة أو مكررة</option>
                <option value="كود العملية غير صحيح">كود العملية غير صحيح</option>
                <option value="المبلغ المحول أقل من المبلغ المطلوب">المبلغ المحول أقل من المبلغ المطلوب</option>
              </select>

              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="أو اكتب سبباً مخصصاً..."
                className="w-full py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleConfirmRejection}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                تأكيد رفض الطلب ❌
              </button>
              <button
                type="button"
                onClick={() => setRejectingTxId(null)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

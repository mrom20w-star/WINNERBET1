import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  Search,
  User,
  Phone,
  Wallet,
  CheckCircle2,
  Clock,
  Send,
  Paperclip,
  X,
  Copy,
  Check,
  Eye,
  Plus,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ArrowDownToLine,
  Coins,
  RefreshCw,
} from 'lucide-react';
import { SupportTicket, SupportMessage, UserAccount } from '../../types';
import { useApp } from '../../context/AppContext';

interface AdminSupportViewProps {
  onViewDepositsOfUser?: (userId: string) => void;
  onTopUpUser?: (userId: string) => void;
  onViewReceipt?: (img: string) => void;
}

export const AdminSupportView: React.FC<AdminSupportViewProps> = ({
  onViewDepositsOfUser,
  onTopUpUser,
  onViewReceipt,
}) => {
  const {
    allUsers,
    supportTickets,
    sendSupportMessage,
    resolveSupportTicket,
    getOrCreateTicketForUser,
    connectedDevices,
    showToast,
  } = useApp();

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'online' | 'resolved'>('all');
  const [adminReplyText, setAdminReplyText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // New Chat Modal state
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [manual10DigitId, setManual10DigitId] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-select first ticket if none selected and tickets exist
  useEffect(() => {
    if (!selectedTicketId && supportTickets.length > 0) {
      setSelectedTicketId(supportTickets[0].id);
    }
  }, [supportTickets, selectedTicketId]);

  // Check if a specific user is online
  const isUserOnline = (userId: string, userPhone?: string): boolean => {
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

  // Selected ticket
  const selectedTicket = supportTickets.find((t) => t.id === selectedTicketId);
  const messages: SupportMessage[] = selectedTicket?.messages || [];

  // Selected ticket user info
  const ticketUser: UserAccount | undefined = selectedTicket
    ? allUsers.find(
        (u) =>
          u.id === selectedTicket.userId ||
          (Boolean(selectedTicket.userPhone) && u.phone === selectedTicket.userPhone)
      )
    : undefined;

  const isSelectedUserOnline = selectedTicket
    ? isUserOnline(selectedTicket.userId, selectedTicket.userPhone)
    : false;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, selectedTicketId]);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleSendReply = async (customText?: string) => {
    const text = (customText || adminReplyText).trim();
    if ((!text && !selectedImage) || isSending || !selectedTicketId) return;

    setIsSending(true);
    setAdminReplyText('');
    const imgToSend = selectedImage || undefined;
    setSelectedImage(null);

    try {
      await sendSupportMessage(
        selectedTicketId,
        text || 'صورة مرفقة من الدعم الفني',
        'admin',
        'إدارة المنصة (الدعم الفني)',
        imgToSend
      );
    } finally {
      setIsSending(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartChatWithUser = async (targetUser: UserAccount) => {
    const ticketId = await getOrCreateTicketForUser(
      targetUser.id,
      targetUser.username,
      targetUser.phone,
      `محادثة دعم فني مخصصة للاعب (${targetUser.id})`
    );
    setSelectedTicketId(ticketId);
    setIsNewChatModalOpen(false);
    showToast(`تم فتح المحادثة الخاصة باللاعب ${targetUser.id} بنجاح!`, 'success');
  };

  const handleStartChatManual = async () => {
    const id = manual10DigitId.trim();
    if (!id) return;
    const existingUser = allUsers.find((u) => u.id === id);
    const ticketId = await getOrCreateTicketForUser(
      id,
      existingUser?.username || `لاعب_${id.slice(-4)}`,
      existingUser?.phone || '',
      `محادثة دعم فني مخصصة للاعب (${id})`
    );
    setSelectedTicketId(ticketId);
    setManual10DigitId('');
    setIsNewChatModalOpen(false);
    showToast(`تم فتح المحادثة للـ ID ${id}!`, 'success');
  };

  const quickReplies = [
    'أهلاً بك يا بطل، كيف يمكننا مساعدتك اليوم؟ 👋',
    'تم تأكيد طلبك وشحن الرصيد في حسابك بنجاح ✅',
    'يرجى رفع سكرين شوت واضحة للتحويل من تطبيق الدفع 📸',
    'طلبك قيد المتابعة من الإدارة وسيتم الرد خلال دقائق ⏳',
    'تم حل مشكلتك، نتمنى لك وقتاً ممتعاً وأرباحاً وفيرة! 🌟',
  ];

  // Filtered tickets
  const filteredTickets = supportTickets.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      t.userId.toLowerCase().includes(q) ||
      t.userName.toLowerCase().includes(q) ||
      (t.userPhone && t.userPhone.includes(q)) ||
      t.subject.toLowerCase().includes(q) ||
      (t.messages && t.messages.some((m) => m.text.toLowerCase().includes(q)));

    if (!matchesSearch) return false;

    if (statusFilter === 'open') return t.status === 'open';
    if (statusFilter === 'resolved') return t.status === 'resolved';
    if (statusFilter === 'online') {
      return isUserOnline(t.userId, t.userPhone);
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Top Banner & Action */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/80 p-4 rounded-2xl border border-slate-700 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              <span>الدعم الفني وشات اللاعبين المخصص بالـ ID</span>
              <span className="text-xs font-mono font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                {supportTickets.length} محادثة
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              لكل لاعب شات مخصص ومستقل بمعرف الـ 10 أرقام الخاص به، مع إمكانية إرسال واستقبال الصور ومتابعة الحالة المباشرة
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsNewChatModalOpen(true)}
          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-blue-900/30 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>بدء محادثة جديدة مع لاعب بالـ ID</span>
        </button>
      </div>

      {/* Main 2-Column Chat Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* RIGHT COLUMN: Tickets / Players List (4 cols on lg) */}
        <div className="lg:col-span-4 bg-slate-800/70 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col gap-3 max-h-[760px]">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالـ ID (10 أرقام)، الاسم، الهاتف..."
              className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              الكل ({supportTickets.length})
            </button>
            <button
              onClick={() => setStatusFilter('online')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                statusFilter === 'online'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>أونلاين</span>
            </button>
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === 'open'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              مفتوحة ({supportTickets.filter((t) => t.status === 'open').length})
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={`px-3 py-1 rounded-lg font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === 'resolved'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              مكتملة
            </button>
          </div>

          {/* Ticket Items Scrollable Feed */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 max-h-[600px]">
            {filteredTickets.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs flex flex-col items-center gap-2">
                <MessageCircle className="w-8 h-8 opacity-40" />
                <span>لا توجد محادثات تطابق البحث أو التصفية الحالية</span>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = selectedTicketId === t.id;
                const online = isUserOnline(t.userId, t.userPhone);
                const lastMsg = t.messages && t.messages.length > 0 ? t.messages[t.messages.length - 1] : null;
                const hasPlayerUnread = lastMsg && lastMsg.sender === 'user';

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-blue-950/70 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                        : 'bg-slate-900/70 hover:bg-slate-900 border-slate-700/70'
                    }`}
                  >
                    {/* Top row: ID badge & status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="relative flex h-2.5 w-2.5">
                          {online && (
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          )}
                          <span
                            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                              online ? 'bg-emerald-500' : 'bg-slate-600'
                            }`}
                          />
                        </span>

                        <span className="font-mono font-extrabold text-[11px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                          ID: {t.userId}
                        </span>

                        {hasPlayerUnread && (
                          <span className="text-[9px] bg-blue-500 text-white font-black px-1.5 py-0.2 rounded-full animate-bounce">
                            رسالة جديدة
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          t.status === 'open'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {t.status === 'open' ? 'قيد المتابعة' : 'مكتملة'}
                      </span>
                    </div>

                    {/* Middle: Player Name & Time */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-200 truncate">{t.userName}</span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(t.updatedAt || t.createdAt).toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Bottom: Last Message snippet */}
                    {lastMsg && (
                      <div className="text-[11px] text-slate-300 truncate bg-slate-950/60 px-2 py-1 rounded-md border border-slate-800">
                        <span className="text-slate-500 font-bold">
                          {lastMsg.sender === 'admin' ? 'الإدارة: ' : 'اللاعب: '}
                        </span>
                        <span>{lastMsg.text}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* LEFT / MAIN COLUMN: Active Chat Feed (8 cols on lg) */}
        <div className="lg:col-span-8 bg-slate-800/70 border border-slate-700/80 rounded-2xl overflow-hidden flex flex-col h-[760px] shadow-xl">
          {selectedTicket ? (
            <>
              {/* Active Ticket Header with Player Card */}
              <div className="bg-[#101b33] border-b border-slate-700/80 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                        <User className="w-6 h-6" />
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#101b33] ${
                          isSelectedUserOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
                        }`}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-black text-white">{selectedTicket.userName}</h3>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                            isSelectedUserOnline
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isSelectedUserOnline ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                          {isSelectedUserOnline ? 'متصل الآن بالمنصة' : 'غير متصل'}
                        </span>
                      </div>

                      {/* 10-Digit ID & Phone Bar */}
                      <div className="flex items-center gap-2.5 mt-1 text-xs text-slate-300 flex-wrap">
                        <div className="flex items-center gap-1 bg-slate-900/90 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                          <span className="text-[10px] text-slate-400">معرف اللاعب (ID):</span>
                          <span className="font-mono font-black text-amber-300">{selectedTicket.userId}</span>
                          <button
                            onClick={() => handleCopy(selectedTicket.userId, 'ticketUserId')}
                            className="p-0.5 text-slate-400 hover:text-white"
                          >
                            {copiedField === 'ticketUserId' ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {selectedTicket.userPhone && (
                          <div className="flex items-center gap-1 bg-slate-900/90 px-2 py-0.5 rounded-lg border border-slate-700">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span className="font-mono text-slate-200" dir="ltr">
                              {selectedTicket.userPhone}
                            </span>
                          </div>
                        )}

                        {ticketUser && (
                          <div className="flex items-center gap-1 bg-emerald-950/40 px-2.5 py-0.5 rounded-lg border border-emerald-800/40 text-emerald-300 font-mono">
                            <span className="text-[10px] text-slate-400">الرصيد:</span>
                            <span className="font-black">{ticketUser.balance.toFixed(2)} ج.م</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions on this user */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {onTopUpUser && (
                      <button
                        onClick={() => onTopUpUser(selectedTicket.userId)}
                        className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md shadow-amber-500/20 transition cursor-pointer"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        <span>شحن رصيد</span>
                      </button>
                    )}

                    {onViewDepositsOfUser && (
                      <button
                        onClick={() => onViewDepositsOfUser(selectedTicket.userId)}
                        className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1 border border-slate-700 transition cursor-pointer"
                      >
                        <ArrowDownToLine className="w-3.5 h-3.5 text-blue-400" />
                        <span>إيداعات هذا اللاعب</span>
                      </button>
                    )}

                    <button
                      onClick={() => resolveSupportTicket(selectedTicket.id)}
                      className={`py-1.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                        selectedTicket.status === 'open'
                          ? 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border-emerald-700/60'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      {selectedTicket.status === 'open' ? 'تعليم كمكتملة ✓' : 'إعادة فتح التذكرة'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#080d19]">
                {/* Security and isolation notice */}
                <div className="flex justify-center">
                  <span className="bg-[#111c30] border border-blue-500/30 text-blue-300 text-[11px] px-3.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>محادثة مشفرة وخاصة بحساب اللاعب {selectedTicket.userId} فقط</span>
                  </span>
                </div>

                {messages.map((msg, idx) => {
                  const isAdmin = msg.sender === 'admin';
                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col max-w-[85%] ${
                        isAdmin ? 'self-end items-end' : 'self-start items-start'
                      }`}
                    >
                      <div
                        className={`p-3.5 rounded-2xl shadow-md text-xs sm:text-sm leading-relaxed flex flex-col gap-1.5 ${
                          isAdmin
                            ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white rounded-tl-xs border border-amber-500/40'
                            : 'bg-[#18263e] text-slate-100 rounded-tr-xs border border-slate-700/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-[11px] font-bold border-b pb-1 border-white/20">
                          <span className={isAdmin ? 'text-amber-100' : 'text-blue-300'}>
                            {msg.senderName || (isAdmin ? 'إدارة المنصة (الدعم الفني)' : 'اللاعب')}
                          </span>
                          {msg.depositRefId && (
                            <span className="text-[9px] font-mono opacity-80">
                              بخصوص طلب: {msg.depositRefId}
                            </span>
                          )}
                        </div>

                        {msg.image && (
                          <div
                            onClick={() => onViewReceipt && onViewReceipt(msg.image || '')}
                            className="rounded-xl overflow-hidden cursor-pointer max-w-[280px] border border-white/30 group relative"
                          >
                            <img
                              src={msg.image}
                              alt="مرفق"
                              className="w-full h-auto object-cover max-h-64 group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        )}

                        <p className="whitespace-pre-wrap select-text leading-relaxed">{msg.text}</p>

                        <span
                          className={`text-[10px] font-mono self-end mt-0.5 ${
                            isAdmin ? 'text-amber-200' : 'text-slate-400'
                          }`}
                        >
                          {new Date(msg.timestamp).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Selected Image Preview (before send) */}
              {selectedImage && (
                <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={selectedImage} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-amber-500/50" />
                    <span className="text-xs text-amber-300 font-bold">صورة جاهزة للإرسال في الشات</span>
                  </div>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Quick Replies Bar */}
              <div className="bg-[#0b1220] border-t border-slate-800 px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <span className="text-[10px] text-slate-400 font-bold shrink-0 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  رد سريع:
                </span>
                {quickReplies.map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendReply(qr)}
                    disabled={isSending}
                    className="text-[11px] whitespace-nowrap bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-full border border-slate-700 hover:border-amber-500/40 transition cursor-pointer"
                  >
                    {qr}
                  </button>
                ))}
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 sm:p-4 bg-[#101b33] border-t border-slate-700/80 flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="إرفاق صورة"
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={adminReplyText}
                  onChange={(e) => setAdminReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`اكتب رسالة الرد للاعب (${selectedTicket.userName} - ${selectedTicket.userId})...`}
                  disabled={isSending}
                  className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition"
                />

                <button
                  onClick={() => handleSendReply()}
                  disabled={isSending || (!adminReplyText.trim() && !selectedImage)}
                  className="p-2.5 sm:px-5 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">إرسال</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center gap-3">
              <MessageCircle className="w-14 h-14 opacity-30 text-blue-400" />
              <h4 className="text-base font-bold text-slate-300">لم يتم تحديد أي محادثة</h4>
              <p className="text-xs text-slate-400 max-w-sm">
                اختر محادثة من القائمة على اليمين بالـ ID أو اضغط على "بدء محادثة جديدة مع لاعب" لفتح شات مخصص لأي لاعب
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Start New Chat with Player by ID */}
      {isNewChatModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsNewChatModalOpen(false)}
        >
          <div
            className="bg-[#0e172e] border border-blue-500/40 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-black text-white">بدء محادثة دعم جديدة مع لاعب</h3>
              </div>
              <button
                onClick={() => setIsNewChatModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Direct 10-Digit ID Input */}
            <div className="bg-slate-900/90 p-3.5 rounded-2xl border border-slate-700/80 flex flex-col gap-2">
              <label className="text-xs font-bold text-amber-300">
                إدخال معرف اللاعب مباشرة (10 أرقام):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manual10DigitId}
                  onChange={(e) => setManual10DigitId(e.target.value.replace(/\D/g, ''))}
                  placeholder="مثال: 1726413807"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={handleStartChatManual}
                  disabled={manual10DigitId.length < 5}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer"
                >
                  فتح الشات
                </button>
              </div>
            </div>

            {/* Pick from registered players list */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>أو اختر من قائمة اللاعبين المسجلين:</span>
                <span className="font-mono">{allUsers.length} لاعب</span>
              </div>

              <input
                type="text"
                value={newChatSearch}
                onChange={(e) => setNewChatSearch(e.target.value)}
                placeholder="بحث في اللاعبين..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500"
              />

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5">
                {allUsers
                  .filter((u) => {
                    const q = newChatSearch.toLowerCase().trim();
                    return (
                      !q ||
                      u.id.includes(q) ||
                      u.username.toLowerCase().includes(q) ||
                      (u.phone && u.phone.includes(q))
                    );
                  })
                  .slice(0, 30)
                  .map((u) => {
                    const online = isUserOnline(u.id, u.phone);
                    return (
                      <div
                        key={u.id}
                        onClick={() => handleStartChatWithUser(u)}
                        className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-blue-500/40 transition cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                            }`}
                          />
                          <div>
                            <span className="text-xs font-bold text-white block">{u.username}</span>
                            <span className="text-[10px] font-mono text-amber-300">ID: {u.id}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-emerald-400 font-bold" dir="rtl">
                            {u.balance.toFixed(2)} ج.م
                          </span>
                          <span className="text-[11px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            بدء الشات ←
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

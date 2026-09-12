import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  User,
  Phone,
  Wallet,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Eye,
  ImageIcon,
  ShieldCheck,
  Sparkles,
  Paperclip,
} from 'lucide-react';
import { Transaction, SupportTicket, SupportMessage } from '../../types';
import { useApp } from '../../context/AppContext';

interface DepositChatModalProps {
  tx: Transaction | null;
  onClose: () => void;
  onApprove: (txId: string) => void;
  onReject: (txId: string) => void;
  onViewReceipt: (img: string) => void;
}

export const DepositChatModal: React.FC<DepositChatModalProps> = ({
  tx,
  onClose,
  onApprove,
  onReject,
  onViewReceipt,
}) => {
  const {
    allUsers,
    supportTickets,
    sendSupportMessage,
    getOrCreateTicketForUser,
    connectedDevices,
  } = useApp();

  const [messageInput, setMessageInput] = useState('');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize or fetch dedicated ticket for this user
  useEffect(() => {
    if (!tx) return;
    const initTicket = async () => {
      const id = await getOrCreateTicketForUser(
        tx.userId,
        tx.userName,
        tx.userPhone,
        `محادثة إيداع (${tx.id})`
      );
      setTicketId(id);
    };
    initTicket();
  }, [tx, getOrCreateTicketForUser]);

  // Find ticket data
  const currentTicket: SupportTicket | undefined = supportTickets.find((t) =>
    ticketId ? t.id === ticketId : t.userId === tx?.userId
  );

  const messages: SupportMessage[] = currentTicket?.messages || [];

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  if (!tx) return null;

  // Real-time player details
  const targetUser = allUsers.find(
    (u) => u.id === tx.userId || (Boolean(tx.userPhone) && u.phone === tx.userPhone)
  );

  // Is user online right now?
  const isOnline = Boolean(
    connectedDevices?.some(
      (d) =>
        (d.userId === tx.userId || (Boolean(tx.userPhone) && d.phone === tx.userPhone)) &&
        d.isOnline &&
        Date.now() - (d.lastSeen || 0) < 45000
    ) || (targetUser?.lastActive && Date.now() - targetUser.lastActive < 60000)
  );

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || messageInput).trim();
    if ((!text && !selectedImage) || isSending || !ticketId) return;

    setIsSending(true);
    setMessageInput('');
    const imgToSend = selectedImage || undefined;
    setSelectedImage(null);

    try {
      await sendSupportMessage(
        ticketId,
        text || 'صورة مرفقة من الإدارة',
        'admin',
        'إدارة المنصة (قسم الإيداعات)',
        imgToSend,
        tx.id
      );
    } finally {
      setIsSending(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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

  const quickReplies = [
    'تم استلام المبلغ وسيتم شحن الرصيد خلال ثوانٍ ✅',
    'يرجى رفع سكرين شوت أوضح من داخل تطبيق الدفع 📸',
    'لم يصلنا أي تحويل، يرجى التأكد من الرقم المحول إليه ⚠️',
    'تم قبول طلبك وإضافة الرصيد في حسابك بنجاح! 🎉',
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full h-[90vh] max-h-[780px] bg-[#0d1627] border border-blue-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="bg-[#111e38] border-b border-slate-700/80 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
                <User className="w-5 h-5" />
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#111e38] ${
                  isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white">
                  محادثة مخصصة للاعب: {tx.userName || 'اللاعب'}
                </h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                    isOnline
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-400'}`} />
                  {isOnline ? 'متصل الآن' : 'غير متصل'}
                </span>
              </div>

              {/* 10-Digit ID and Balance Bar */}
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-300 flex-wrap">
                <div className="flex items-center gap-1 bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-700">
                  <span className="text-[10px] text-slate-400">ID:</span>
                  <span className="font-mono font-extrabold text-amber-300">{tx.userId}</span>
                  <button
                    onClick={() => handleCopy(tx.userId, 'id')}
                    className="p-0.5 text-slate-400 hover:text-white"
                  >
                    {copiedField === 'id' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>

                {targetUser && (
                  <div className="flex items-center gap-1 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-800/40 text-emerald-300 font-mono text-xs">
                    <span className="text-[10px] text-slate-400">الرصيد:</span>
                    <strong>{targetUser.balance.toFixed(2)} ج.م</strong>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer border border-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Deposit Summary Card (Sticky under header) */}
        <div className="bg-[#0b1220] border-b border-slate-800 p-3.5 flex items-center justify-between gap-3 shadow-inner flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-3">
            {tx.receiptImage ? (
              <div
                onClick={() => onViewReceipt(tx.receiptImage || '')}
                className="relative group cursor-pointer w-14 h-14 rounded-xl overflow-hidden border border-blue-500/50 shadow-md shrink-0"
              >
                <img
                  src={tx.receiptImage}
                  alt="إيصال الإيداع"
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <Eye className="w-4 h-4 text-white" />
                </div>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center text-slate-400 shrink-0">
                <ImageIcon className="w-5 h-5 text-slate-500" />
                <span className="text-[8px] mt-0.5">بدون صورة</span>
              </div>
            )}

            <div className="flex flex-col text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[11px]">طلب إيداع:</span>
                <span className="font-mono font-bold text-slate-200">{tx.id}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                    tx.status === 'pending'
                      ? 'bg-amber-500/20 text-amber-300'
                      : tx.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {tx.status === 'pending' ? 'قيد الانتظار' : tx.status === 'completed' ? 'مقبول' : 'مرفوض'}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-1">
                <span className="text-emerald-400 font-black text-sm font-mono" dir="rtl">
                  {tx.amount.toFixed(2)} ج.م
                </span>
                <span className="text-amber-300 font-bold text-[11px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {tx.method || 'فودافون كاش'}
                </span>
                {tx.senderPhone && (
                  <span className="text-slate-300 font-mono text-[11px]" dir="ltr">
                    📱 {tx.senderPhone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Accept/Reject from within the Chat */}
          {tx.status === 'pending' && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onApprove(tx.id)}
                className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-900/30 transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>قبول وشحن</span>
              </button>
              <button
                onClick={() => onReject(tx.id)}
                className="py-2 px-3 rounded-xl bg-red-950 hover:bg-red-900 border border-red-800 text-red-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>رفض</span>
              </button>
            </div>
          )}
        </div>

        {/* Live Chat Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#080e1a]">
          {/* Notice */}
          <div className="flex justify-center">
            <span className="bg-slate-800/80 border border-slate-700/60 text-slate-300 text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>محادثة مباشرة وخاصة باللاعب برقم المعرف {tx.userId}</span>
            </span>
          </div>

          {messages.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs">
              <span>لا توجد رسائل سابقة. يمكنك بدء المحادثة مع اللاعب الآن.</span>
            </div>
          ) : (
            messages.map((msg, idx) => {
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
                        : 'bg-[#1a273e] text-slate-100 rounded-tr-xs border border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[11px] font-bold border-b pb-1 border-white/20">
                      <span className={isAdmin ? 'text-amber-100' : 'text-blue-300'}>
                        {msg.senderName || (isAdmin ? 'إدارة المنصة' : 'اللاعب')}
                      </span>
                      {msg.depositRefId && (
                        <span className="text-[9px] font-mono opacity-80">
                          بخصوص طلب: {msg.depositRefId}
                        </span>
                      )}
                    </div>

                    {msg.image && (
                      <div
                        onClick={() => onViewReceipt(msg.image || '')}
                        className="rounded-xl overflow-hidden cursor-pointer max-w-[260px] border border-white/30 group relative"
                      >
                        <img
                          src={msg.image}
                          alt="مرفق"
                          className="w-full h-auto object-cover max-h-60 group-hover:scale-105 transition"
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
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Selected image preview to send */}
        {selectedImage && (
          <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={selectedImage} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-amber-500/50" />
              <span className="text-xs text-amber-300 font-bold">صورة جاهزة للإرسال</span>
            </div>
            <button
              onClick={() => setSelectedImage(null)}
              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Replies Strip */}
        <div className="bg-[#0b1222] border-t border-slate-800/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[10px] text-slate-400 font-bold shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            ردود سريعة:
          </span>
          {quickReplies.map((qr, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(qr)}
              disabled={isSending}
              className="text-[11px] whitespace-nowrap bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-full border border-slate-700/80 hover:border-amber-500/40 transition cursor-pointer"
            >
              {qr}
            </button>
          ))}
        </div>

        {/* Reply Input Bar */}
        <div className="p-3 sm:p-4 bg-[#111e38] border-t border-slate-700/80 flex items-center gap-2">
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
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`اكتب رسالة للاعب (ID: ${tx.userId})...`}
            disabled={isSending}
            className="flex-1 bg-slate-900/90 border border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 transition"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={isSending || (!messageInput.trim() && !selectedImage)}
            className="p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-500/20"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">إرسال</span>
          </button>
        </div>
      </div>
    </div>
  );
};

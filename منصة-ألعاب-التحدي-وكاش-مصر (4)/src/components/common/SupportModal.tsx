import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Send,
  CheckCheck,
  Headphones,
  Phone,
  Paperclip,
  Smile,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { SupportTicket, SupportMessage } from '../../types';

export const SupportModal: React.FC = () => {
  const {
    isSupportOpen,
    setIsSupportOpen,
    user,
    supportTickets,
    createSupportTicket,
    sendSupportMessage,
  } = useApp();

  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Find user's dedicated chat thread
  const userThread: SupportTicket | undefined = supportTickets.find(
    (t) => t.userId === user.id || (user.phone && t.userPhone === user.phone)
  );

  const messages: SupportMessage[] = userThread?.messages || [];

  // Auto-scroll to bottom on new messages or modal open
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isSupportOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [isSupportOpen, messages.length]);

  if (!isSupportOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || messageInput).trim();
    if (!text || isSending) return;

    setIsSending(true);
    setMessageInput('');

    try {
      if (userThread) {
        await sendSupportMessage(userThread.id, text);
      } else {
        await createSupportTicket('محادثة دعم فني مباشر', text);
      }
    } finally {
      setIsSending(false);
      setTimeout(scrollToBottom, 150);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const quickQuestions = [
    'استفسار عن إيداع لم يصل 💳',
    'متى تتم معالجة طلب السحب؟ ⏳',
    'شحن رصيد مباشر عبر فودافون كاش ⚡',
    'استفسار عن لعبة التفاحة والطيارة 🎮',
  ];

  const formatMessageTime = (ts?: number) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
    >
      {/* WhatsApp Chat Window */}
      <div className="w-full max-w-lg bg-[#0b141a] text-slate-100 rounded-3xl border border-slate-700/80 shadow-2xl overflow-hidden flex flex-col h-[85vh] sm:h-[80vh] max-h-[700px] relative">
        
        {/* WHATSAPP TOP HEADER */}
        <div className="px-4 py-3 bg-[#202c33] border-b border-slate-700/60 flex items-center justify-between shadow-md z-10">
          <div className="flex items-center gap-3">
            {/* Avatar with Online indicator */}
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md border border-emerald-400/30">
                <Headphones className="w-6 h-6 text-white" />
              </div>
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#202c33] rounded-full"></span>
            </div>

            {/* Support Info */}
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm sm:text-base text-white tracking-wide">
                  الدعم الفني المباشر
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">
                  رسمي
                </span>
              </div>
              <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>متصل الآن • خدمة عملاء 24/7</span>
              </span>
            </div>
          </div>

          {/* Actions: Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSupportOpen(false)}
              id="support-modal-close-btn"
              className="w-9 h-9 rounded-full bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              title="إغلاق الشات"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* WHATSAPP CHAT WALLPAPER & MESSAGES AREA */}
        <div
          className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar relative"
          style={{
            backgroundColor: '#0b141a',
            backgroundImage: `radial-gradient(#1f2c34 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        >
          {/* Security Notice Pill */}
          <div className="flex justify-center my-1">
            <div className="bg-[#182229] border border-amber-500/20 text-amber-300 text-[11px] px-3 py-1.5 rounded-xl shadow-xs text-center max-w-sm flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>محادثة مشفرة وخاصة بحسابك فقط مع إدارة ومسؤولي المنصة.</span>
            </div>
          </div>

          {/* Date separator */}
          <div className="flex justify-center my-1">
            <span className="bg-[#182229] text-slate-400 text-[10px] px-3 py-0.5 rounded-full font-bold shadow-xs">
              اليوم
            </span>
          </div>

          {/* Auto Welcome Message from Support */}
          <div className="flex items-start gap-2 max-w-[85%] self-start" dir="rtl">
            <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center text-white shrink-0 mt-1 shadow-xs">
              <Headphones className="w-4 h-4" />
            </div>
            <div className="bg-[#202c33] text-slate-100 rounded-2xl rounded-tr-xs p-3 shadow-md border border-slate-700/40 text-xs sm:text-sm leading-relaxed flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 border-b border-slate-700/40 pb-1 text-[11px] text-emerald-400 font-bold">
                <span>خدمة العملاء (1X WINNER)</span>
                <span>🎧</span>
              </div>
              <p className="text-slate-200">
                مرحباً بك يا بطل في شات الدعم الفني المباشر لمنصة 1X WINNER! 👋
                <br />
                يمكنك كتابة أي استفسار بخصوص شحن الرصيد، سحب الأرباح، أو المساعدة في الألعاب، وسيقوم مسؤول الدعم بالرد عليك فوراً.
              </p>
              <div className="flex justify-end text-[10px] text-slate-400 mt-1 font-mono">
                <span>خدمة 24 ساعة</span>
              </div>
            </div>
          </div>

          {/* Render Actual Messages */}
          {messages.map((msg, idx) => {
            const isUser = msg.sender === 'user';
            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col max-w-[82%] ${
                  isUser ? 'self-end items-end' : 'self-start items-start'
                }`}
              >
                <div
                  className={`p-3 rounded-2xl shadow-md text-xs sm:text-sm leading-relaxed flex flex-col gap-1 ${
                    isUser
                      ? 'bg-[#005c4b] text-white rounded-tl-xs border border-emerald-600/30'
                      : 'bg-[#202c33] text-slate-100 rounded-tr-xs border border-slate-700/40'
                  }`}
                >
                  {!isUser && (
                    <span className="text-[11px] font-bold text-emerald-400">
                      {msg.senderName || 'الدعم الفني'}
                    </span>
                  )}
                  {msg.image && (
                    <div className="my-1 rounded-lg overflow-hidden border border-white/20 max-w-[240px]">
                      <img src={msg.image} alt="مرفق" className="w-full h-auto object-cover max-h-60" />
                    </div>
                  )}
                  <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                  <div
                    className={`flex items-center gap-1 text-[10px] mt-0.5 ${
                      isUser ? 'text-emerald-200 self-end' : 'text-slate-400 self-end'
                    }`}
                  >
                    <span className="font-mono">{formatMessageTime(msg.timestamp)}</span>
                    {isUser && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* QUICK QUESTION PILLS (WhatsApp suggestions) */}
        <div className="px-3 py-1.5 bg-[#111b21] border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
          {quickQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(q)}
              className="bg-[#202c33] hover:bg-emerald-950/60 border border-slate-700/80 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-300 text-[11px] font-medium px-3 py-1 rounded-full whitespace-nowrap transition cursor-pointer shadow-xs active:scale-95"
            >
              {q}
            </button>
          ))}
        </div>

        {/* WHATSAPP MESSAGE INPUT BAR */}
        <div className="p-2.5 sm:p-3 bg-[#202c33] border-t border-slate-700/60 flex items-center gap-2">
          {/* Input field */}
          <div className="flex-1 relative flex items-center bg-[#2a3942] rounded-2xl border border-slate-600/40 px-3 py-2 shadow-inner">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالتك للدعم الفني هنا..."
              id="support-chat-input"
              className="w-full bg-transparent text-white text-xs sm:text-sm placeholder-slate-400 focus:outline-none"
              disabled={isSending}
              autoComplete="off"
            />
          </div>

          {/* Send button styled like WhatsApp Green Send Circle */}
          <button
            onClick={() => handleSendMessage()}
            disabled={!messageInput.trim() || isSending}
            id="support-chat-send-btn"
            className={`w-11 h-11 rounded-full flex items-center justify-center transition shadow-lg shrink-0 cursor-pointer ${
              messageInput.trim() && !isSending
                ? 'bg-[#00a884] hover:bg-[#008f6f] text-white active:scale-95 shadow-emerald-900/50'
                : 'bg-slate-700/60 text-slate-500 cursor-not-allowed'
            }`}
            title="إرسال الرسالة"
          >
            <Send className="w-5 h-5 rtl:rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
};

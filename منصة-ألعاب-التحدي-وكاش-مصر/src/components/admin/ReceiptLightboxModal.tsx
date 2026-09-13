import React, { useState } from 'react';
import {
  X,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Download,
  CheckCircle2,
  XCircle,
  MessageCircle,
  Copy,
  Check,
  Calendar,
  Wallet,
  Phone,
  Hash,
} from 'lucide-react';
import { Transaction } from '../../types';

interface ReceiptLightboxModalProps {
  image: string | null;
  tx?: Transaction | null;
  onClose: () => void;
  onApprove?: (txId: string) => void;
  onReject?: (txId: string) => void;
  onOpenChat?: (tx: Transaction) => void;
}

export const ReceiptLightboxModal: React.FC<ReceiptLightboxModalProps> = ({
  image,
  tx,
  onClose,
  onApprove,
  onReject,
  onOpenChat,
}) => {
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!image) return null;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150 select-none"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full max-h-[95vh] bg-[#0b1222] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#0e172e] border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <span>معاينة إيصال التحويل البنكي / الكاش</span>
                {tx && (
                  <span className="text-xs font-mono font-bold bg-slate-800 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                    {tx.id}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                فحص صورة الإيصال المرفقة بواسطة اللاعب والتأكد من بيانات التحويل
              </p>
            </div>
          </div>

          {/* Viewer Controls & Close */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleZoomOut}
              title="تصغير"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold text-slate-400 px-1 hidden sm:inline">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              title="تكبير"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleRotate}
              title="تدوير 90 درجة"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            {(zoom !== 1 || rotation !== 0) && (
              <button
                onClick={handleReset}
                title="إعادة ضبط"
                className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
              >
                إعادة ضبط
              </button>
            )}
            <a
              href={image}
              download={`receipt-${tx?.id || 'deposit'}.jpg`}
              title="تحميل الصورة"
              className="p-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white transition cursor-pointer border border-blue-500/40"
            >
              <Download className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              title="إغلاق"
              className="p-2 rounded-xl bg-red-500/20 hover:bg-red-600 text-red-300 hover:text-white transition cursor-pointer border border-red-500/40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Canvas: The Receipt Image */}
        <div className="flex-1 overflow-auto bg-[#070b14] flex items-center justify-center p-4 min-h-[380px] max-h-[62vh] relative">
          <div
            className="transition-transform duration-200 ease-out origin-center flex items-center justify-center"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          >
            <img
              src={image}
              alt="صورة إيصال التحويل"
              className="max-w-full max-h-[58vh] object-contain rounded-xl shadow-2xl border border-slate-700/60"
            />
          </div>
        </div>

        {/* Bottom Details Strip & Actions (If TX info provided) */}
        {tx && (
          <div className="bg-[#0e172e] border-t border-slate-700/80 p-4 flex flex-col gap-3">
            {/* Metadata Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex flex-col">
                <span className="text-slate-400 text-[10px]">المبلغ المطلوب</span>
                <span className="text-sm font-black text-emerald-400 font-mono" dir="rtl">
                  {tx.amount.toFixed(2)} ج.م
                </span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex flex-col">
                <span className="text-slate-400 text-[10px]">معرف اللاعب (ID)</span>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="text-xs font-mono font-bold text-amber-300">{tx.userId}</span>
                  <button
                    onClick={() => handleCopy(tx.userId, 'id')}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {copiedField === 'id' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex flex-col">
                <span className="text-slate-400 text-[10px]">المحفظة / الهاتف</span>
                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="text-xs font-mono font-bold text-white" dir="ltr">
                    {tx.senderPhone || 'غير محدد'}
                  </span>
                  {tx.senderPhone && (
                    <button
                      onClick={() => handleCopy(tx.senderPhone || '', 'phone')}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      {copiedField === 'phone' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex flex-col">
                <span className="text-slate-400 text-[10px]">كود العملية / التوقيت</span>
                <span className="text-[11px] font-mono text-slate-300 truncate">
                  {tx.referenceCode || tx.id}
                </span>
              </div>
            </div>

            {/* Direct Action Buttons */}
            <div className="flex items-center gap-2.5 pt-1">
              {onOpenChat && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenChat(tx);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-blue-900/30"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>محادثة اللاعب بخصوص الإيداع</span>
                </button>
              )}

              {tx.status === 'pending' && onApprove && (
                <button
                  onClick={() => {
                    onApprove(tx.id);
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-900/40"
                >
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>قبول وإضافة {tx.amount} ج.م فوراً</span>
                </button>
              )}

              {tx.status === 'pending' && onReject && (
                <button
                  onClick={() => {
                    onClose();
                    onReject(tx.id);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-700/80 text-red-300 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  <span>رفض الطلب</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

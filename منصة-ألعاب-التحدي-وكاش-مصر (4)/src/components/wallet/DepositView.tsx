import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Copy, Check, ArrowRight, RotateCw, X, Plus, ChevronDown } from 'lucide-react';

interface MethodConfig {
  id: 'vodafone' | 'etisalat' | 'orange' | 'instapay' | 'telda' | 'usdt';
  name: string;
  minDeposit: number;
  maxDeposit: number;
  logo: React.ReactNode;
  instructionsName: string;
  senderLabel: string;
  category: 'recommended' | 'bank' | 'crypto';
}

export const DepositView: React.FC = () => {
  const { user, setScreen, deposit, showToast, adminSettings, transactions } = useApp();
  const [selectedMethod, setSelectedMethod] = useState<MethodConfig | null>(null);
  const [successDialogMethod, setSuccessDialogMethod] = useState<MethodConfig | null>(null);
  const [amount, setAmount] = useState<string>('300.00');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [referenceCode, setReferenceCode] = useState<string>('');
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const phoneMap: Record<string, string> = {
    vodafone: adminSettings.vodafoneNumber || '01098688815',
    etisalat: adminSettings.etisalatNumber || '01123456789',
    orange: adminSettings.orangeNumber || '01234567890',
    instapay: adminSettings.instapayNumber || '01098688815',
    telda: adminSettings.vodafoneNumber || '01098688815',
    usdt: 'TYD4kLq7w9PvR2x7M6Jz1nB9XwQv8K2Lp',
  };

  const minDep = adminSettings.minDeposit || 10;

  // Available Cash and IPN payment methods (auto-updated from admin)
  const methods: MethodConfig[] = [
    {
      id: 'instapay',
      name: 'InstaPay',
      minDeposit: minDep,
      maxDeposit: 50000,
      instructionsName: 'إنستاباي (InstaPay Egypt)',
      senderLabel: 'عنوان IPN أو رقم الحساب/الهاتف المحول منه:',
      category: 'recommended',
      logo: (
        <div className="flex items-center justify-center gap-1.5 font-bold text-sm">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-700 to-indigo-800 flex items-center justify-center text-white text-xs font-black shadow-xs">
            IP
          </div>
          <div className="flex items-center font-black tracking-tight text-sm">
            <span className="text-[#3b1263]">Insta</span>
            <span className="text-[#e85d04] italic font-black">Pay</span>
          </div>
        </div>
      ),
    },
    {
      id: 'vodafone',
      name: 'Vodafone Cash',
      minDeposit: minDep,
      maxDeposit: 30000,
      instructionsName: 'فودافون كاش',
      senderLabel: 'اكتب رقمك الذى ارسلت منه:',
      category: 'recommended',
      logo: (
        <div className="flex items-center justify-center gap-1.5 font-bold text-sm sm:text-base">
          <div className="w-5 h-5 rounded-full border-2 border-red-600 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-red-600"></div>
          </div>
          <span className="text-red-600 font-extrabold lowercase tracking-tight">vodafone</span>
        </div>
      ),
    },
    {
      id: 'etisalat',
      name: 'Etisalat Cash',
      minDeposit: minDep,
      maxDeposit: 20000,
      instructionsName: 'اتصالات كاش',
      senderLabel: 'رقم هاتفك الذي تم منه التحويل:',
      category: 'recommended',
      logo: (
        <div className="flex items-center justify-center gap-1 font-bold text-sm sm:text-base">
          <span className="text-slate-900 font-black lowercase tracking-tight">etisalat</span>
          <span className="text-red-600 font-black italic">e&</span>
        </div>
      ),
    },
    {
      id: 'orange',
      name: 'Orange cash',
      minDeposit: minDep,
      maxDeposit: 30000,
      instructionsName: 'اورنج كاش',
      senderLabel: 'رقم هاتفك الذي تم منه التحويل:',
      category: 'recommended',
      logo: (
        <div className="flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm">
          <div className="w-5 h-5 bg-black flex items-center justify-center font-black text-amber-500 text-xs rounded-2xs">
            7K
          </div>
          <span className="text-slate-900 font-extrabold">كاش اورنج</span>
        </div>
      ),
    },
    {
      id: 'telda',
      name: 'Telda',
      minDeposit: minDep,
      maxDeposit: 50000,
      instructionsName: 'تيلدا (Telda)',
      senderLabel: 'رقم هاتف حساب تيلدا أو اسم المستخدم المحول منه:',
      category: 'bank',
      logo: (
        <div className="flex items-center justify-center font-black text-slate-900 text-base sm:text-lg tracking-tight font-sans">
          <span className="text-[#321c4d]">telda</span>
        </div>
      ),
    },
    {
      id: 'usdt',
      name: 'USDT (TRC20)',
      minDeposit: 50,
      maxDeposit: 100000,
      instructionsName: 'USDT TRC20',
      senderLabel: 'عنوان محفظتك أو رقم المعاملة (TxID):',
      category: 'crypto',
      logo: (
        <div className="flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm">
          <div className="w-5 h-5 rounded-full bg-[#26a17b] text-white flex items-center justify-center font-black text-xs">
            ₮
          </div>
          <span className="text-[#26a17b] font-black">USDT TRC20</span>
        </div>
      ),
    },
  ];

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    showToast('تم نسخ رقم الحساب', 'success');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyPhone = (phoneNum: string) => {
    navigator.clipboard.writeText(phoneNum);
    setCopiedPhone(true);
    showToast('تم نسخ رقم الهاتف بنجاح', 'success');
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawData = event.target?.result as string;
        if (!rawData) return;
        // Compress image using canvas
        const img = new Image();
        img.onload = () => {
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            setSelectedImage(compressed);
            showToast('تم إرفاق وضغط صورة الإيصال بنجاح ✅', 'success');
          } else {
            setSelectedImage(rawData);
            showToast('تم تحميل صورة الإيصال بنجاح', 'success');
          }
        };
        img.onerror = () => {
          setSelectedImage(rawData);
          showToast('تم تحميل صورة الإيصال', 'success');
        };
        img.src = rawData;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMethod) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < selectedMethod.minDeposit) {
      showToast(`الحد الأدنى للإيداع هو EGP ${selectedMethod.minDeposit.toFixed(2)}`, 'error');
      return;
    }

    if (numAmount > selectedMethod.maxDeposit) {
      showToast(`الحد الأقصى للإيداع هو EGP ${selectedMethod.maxDeposit.toLocaleString('en-US')}`, 'error');
      return;
    }

    if (!senderPhone.trim()) {
      showToast('يرجى إدخال رقم هاتفك الذي قمت بالتحويل منه', 'error');
      return;
    }

    const ok = deposit(
      numAmount,
      selectedMethod.name,
      senderPhone.trim(),
      selectedImage || undefined,
      referenceCode.trim() || undefined
    );
    if (ok) {
      const chosen = selectedMethod;
      setSelectedMethod(null);
      setSenderPhone('');
      setReferenceCode('');
      setSelectedImage(null);
      setSuccessDialogMethod(chosen);
    }
  };

  const activePhone = selectedMethod ? (phoneMap[selectedMethod.id] || adminSettings.vodafoneNumber || '01098688815') : (adminSettings.vodafoneNumber || '01098688815');
  const userDepositHistory = transactions.filter(
    (t) =>
      t.type === 'deposit' &&
      Boolean(t.userId) &&
      (t.userId === user.id ||
        (!/^\d{10}$/.test(t.userId) && Boolean(user.phone) && user.phone.length >= 8 && (t.userPhone === user.phone || t.senderPhone === user.phone)))
  );

  return (
    <div className="w-full min-h-screen bg-[#d6e5d8] text-slate-800 flex flex-col font-['Tajawal',sans-serif] select-none" dir="rtl">
      {/* Top Header Bar matching screenshot */}
      <div className="w-full bg-white border-b border-slate-300/80 px-4 py-2.5 flex items-center justify-between shadow-xs sticky top-0 z-30">
        {/* Refresh Icon */}
        <button
          onClick={() => window.location.reload()}
          id="deposit-refresh-btn"
          className="p-1.5 text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          <RotateCw className="w-5 h-5" />
        </button>

        {/* Center Title */}
        <h1 className="text-base sm:text-lg font-bold text-slate-700">إيداعات الحساب</h1>

        {/* Back Arrow */}
        <button
          onClick={() => setScreen('lobby')}
          id="deposit-back-header-btn"
          className="p-1.5 text-slate-600 hover:text-slate-900 transition cursor-pointer"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 py-3 flex flex-col gap-3">
        {/* Subheader: Account ID with copy icon & Payment types filter */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
              <span>إعادة تعبئة الحساب</span>
              <button
                onClick={handleCopyId}
                id="deposit-copy-account-id-btn"
                className="flex items-center gap-1 font-mono font-bold text-slate-900 bg-white/70 hover:bg-white px-2 py-0.5 rounded border border-slate-300/80 cursor-pointer shadow-2xs"
              >
                <span>{user.id}</span>
                {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-[#245830] text-white text-xs font-bold px-3 py-1.5 rounded-sm shadow-xs flex items-center gap-1">
              <span>أنواع أنظمة الدفع</span>
            </div>

            <button
              onClick={() => setShowHistory(!showHistory)}
              id="deposit-history-toggle-btn"
              className="bg-white/80 hover:bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-sm border border-slate-300 shadow-xs flex items-center gap-1 cursor-pointer transition"
            >
              <span>سجل إيداعاتي ({userDepositHistory.length})</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Deposit History Drawer if opened */}
        {showHistory && (
          <div className="w-full bg-white rounded border border-slate-300 p-3 shadow-xs flex flex-col gap-2 text-xs">
            <span className="font-bold text-slate-800">طلبات الإيداع السابقة:</span>
            {userDepositHistory.length === 0 ? (
              <span className="text-slate-500 py-2 text-center">لا توجد طلبات إيداع سابقة</span>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100">
                {userDepositHistory.map((item) => (
                  <div key={item.id} className="py-2 flex items-center justify-between">
                    <div className="flex flex-col text-right">
                      <span className="font-bold text-slate-800">{item.method || 'إيداع كاش'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(item.timestamp).toLocaleTimeString('ar-EG')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold font-mono text-slate-900">{item.amount.toFixed(2)} EGP</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          item.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.status === 'completed' ? 'مكتمل ومضاف' : item.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Gray Info Box matching screenshot */}
        <div className="w-full bg-[#dbe6dc] border border-slate-300/80 p-3 rounded text-slate-800 flex flex-col gap-1 text-xs">
          <div className="font-bold text-slate-900">اصبح وكيل تيم كاش</div>
          <div className="text-[11px] text-slate-600 leading-relaxed">
            إنضم الآن كوكيل رسمي و أربح اليوم، يرجى التواصل عبر الإيميل PAYPARTNERS-EGYPT@WINNER.COM أو قناة التليجرام WinnerEGY_bot
          </div>
          <div className="text-[11px] text-slate-600 font-bold mt-0.5 hover:underline cursor-pointer">
            مشكلة خاصة بالايداع
          </div>
        </div>

        {/* Category: موصى به (Recommended - InstaPay, Vodafone, Etisalat, Orange) */}
        <div className="flex flex-col gap-2 mt-1">
          <span className="text-xs font-bold text-slate-700">موصى به</span>
          <div className="grid grid-cols-2 gap-2.5">
            {methods
              .filter((m) => m.category === 'recommended')
              .map((method) => (
                <div
                  key={method.id}
                  onClick={() => {
                    setSelectedMethod(method);
                    setAmount('300.00');
                  }}
                  id={`deposit-card-${method.id}`}
                  className="bg-white rounded overflow-hidden border border-slate-300/90 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col group"
                >
                  {/* Upper Logo Area */}
                  <div className="w-full h-16 bg-white flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-200">
                    {method.logo}
                  </div>
                  {/* Bottom Dark Grey Name Area */}
                  <div className="w-full bg-[#464c53] text-white text-center py-1.5 text-xs font-bold">
                    {method.name}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Category: التحويل البنكي (Bank Transfer - Telda) */}
        <div className="flex flex-col gap-2 mt-1">
          <span className="text-xs font-bold text-slate-700">التحويل البنكي</span>
          <div className="grid grid-cols-2 gap-2.5">
            {methods
              .filter((m) => m.category === 'bank')
              .map((method) => (
                <div
                  key={method.id}
                  onClick={() => {
                    setSelectedMethod(method);
                    setAmount('300.00');
                  }}
                  id={`deposit-card-${method.id}`}
                  className="bg-white rounded overflow-hidden border border-slate-300/90 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col group"
                >
                  {/* Upper Logo Area */}
                  <div className="w-full h-16 bg-white flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-200">
                    {method.logo}
                  </div>
                  {/* Bottom Dark Grey Name Area */}
                  <div className="w-full bg-[#464c53] text-white text-center py-1.5 text-xs font-bold">
                    {method.name}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Category: عملة الكريبتو (Crypto - USDT) */}
        <div className="flex flex-col gap-2 mt-1">
          <span className="text-xs font-bold text-slate-700">عملة الكريبتو</span>
          <div className="grid grid-cols-2 gap-2.5">
            {methods
              .filter((m) => m.category === 'crypto')
              .map((method) => (
                <div
                  key={method.id}
                  onClick={() => {
                    setSelectedMethod(method);
                    setAmount('100.00');
                  }}
                  id={`deposit-card-${method.id}`}
                  className="bg-white rounded overflow-hidden border border-slate-300/90 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col group"
                >
                  {/* Upper Logo Area */}
                  <div className="w-full h-16 bg-white flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-200">
                    {method.logo}
                  </div>
                  {/* Bottom Dark Grey Name Area */}
                  <div className="w-full bg-[#464c53] text-white text-center py-1.5 text-xs font-bold">
                    {method.name}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* POPUP / MODAL for Selected Deposit Method matching screenshot */}
      {selectedMethod && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            className="w-full max-w-md bg-white rounded-md shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto relative animate-in fade-in zoom-in-95 duration-200"
            dir="rtl"
          >
            {/* Modal Header with Close 'X' and Brand Logo */}
            <div className="w-full px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-100">
              <div className="w-6"></div>
              {/* Brand Logo in Center */}
              <div className="flex items-center justify-center">
                {selectedMethod.logo}
              </div>
              {/* Close Button 'X' on top left/right */}
              <button
                type="button"
                onClick={() => setSelectedMethod(null)}
                id="deposit-modal-close-btn"
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitDeposit} className="p-4 flex flex-col gap-3 max-h-[85vh] overflow-y-auto">
              {/* Green Alert Banner matching screenshot */}
              <div className="w-full bg-[#245830] text-white p-3 rounded text-xs font-medium leading-relaxed text-center shadow-xs">
                قم بتحويل الأموال في غضون 10 دقيقة قبل إنشاء طلب باستخدام تفاصيل الدفع المقدمة أدناه.
              </div>

              {/* Transfer Phone Number with Copy Icon */}
              <div className="flex items-center justify-center gap-2 py-1 text-slate-800">
                <button
                  type="button"
                  onClick={() => handleCopyPhone(activePhone)}
                  id="deposit-copy-phone-btn"
                  className="p-1 text-slate-600 hover:text-emerald-700 transition cursor-pointer"
                  title="نسخ رقم الهاتف"
                >
                  {copiedPhone ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
                <span className="font-mono text-base sm:text-lg font-bold text-slate-900 tracking-wider" dir="ltr">
                  {activePhone}
                </span>
                <span className="text-xs font-bold text-slate-700">:رقم الهاتف</span>
              </div>

              {/* Amount Input with Min/Max Label */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                  <span>(الحد الأقصى EGP {selectedMethod.maxDeposit.toLocaleString('en-US')}.00)</span>
                  <span>المبلغ (الحد الأدنى EGP {selectedMethod.minDeposit.toFixed(2)} /</span>
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={selectedMethod.minDeposit}
                  max={selectedMethod.maxDeposit}
                  step="any"
                  id="deposit-amount-input"
                  className="w-full p-2 rounded border border-slate-300 text-center font-bold text-slate-900 text-sm focus:outline-none focus:border-emerald-600 bg-white"
                  required
                />
              </div>

              {/* 7 Quick Amount Select Buttons matching screenshot */}
              <div className="grid grid-cols-7 gap-1" dir="ltr">
                {['70', '99', '150', '250', '500', '1 000', '2 000'].map((amtStr) => {
                  const numericVal = amtStr.replace(/\s+/g, '');
                  return (
                    <button
                      key={amtStr}
                      type="button"
                      onClick={() => setAmount(`${numericVal}.00`)}
                      className={`py-1 px-0.5 text-[10px] font-bold rounded border transition cursor-pointer text-center ${
                        amount.startsWith(numericVal)
                          ? 'bg-slate-700 text-white border-slate-800'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {amtStr}
                    </button>
                  );
                })}
              </div>

              {/* Sender Phone Input */}
              <div className="flex flex-col gap-1 mt-1">
                <label className="text-xs font-bold text-slate-700 text-right">
                  {selectedMethod.senderLabel}
                </label>
                <input
                  type="tel"
                  value={senderPhone}
                  onChange={(e) => setSenderPhone(e.target.value)}
                  placeholder="digits 11"
                  id="deposit-sender-phone-input"
                  className="w-full p-2 rounded border border-slate-300 text-right text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-600 bg-white"
                  required
                />
              </div>

              {/* Transfer Reference / Transaction Code (Optional/Recommended) */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-medium">(لتسريع عملية التأكيد)</span>
                  <label className="text-xs font-bold text-slate-700 text-right">
                    رقم التحويل / مرجع المعاملة (المرجع):
                  </label>
                </div>
                <input
                  type="text"
                  value={referenceCode}
                  onChange={(e) => setReferenceCode(e.target.value)}
                  placeholder="أدخل رقم العملية أو كود التحويل (إن وجد)"
                  id="deposit-reference-code-input"
                  className="w-full p-2 rounded border border-slate-300 text-right text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-600 bg-white"
                />
              </div>

              {/* Screenshot Upload Box matching screenshot */}
              <div className="flex flex-col gap-1.5 mt-1">
                <span className="text-[11px] text-slate-600 leading-relaxed text-right">
                  قم بتحميل لقطة شاشة للحوالة إلى المحفظة المحددة من تطبيق الدفع الخاص بك، على سبيل المثال {selectedMethod.instructionsName}:
                </span>

                <div className="flex items-center gap-3">
                  <label
                    htmlFor="screenshot-file-upload"
                    className="w-16 h-16 rounded border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-100 flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer overflow-hidden transition shadow-2xs relative"
                  >
                    {selectedImage ? (
                      <img src={selectedImage} alt="Receipt" className="w-full h-full object-cover" />
                    ) : (
                      <Plus className="w-6 h-6 text-slate-400" />
                    )}
                    <input
                      id="screenshot-file-upload"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>

                  <div className="flex flex-col text-[10px] text-slate-400 text-right">
                    <span>(.jpg, .jpeg, .png, .pdf)</span>
                    <span>الحجم الأقصى للملف هو 20 ميغا بايت</span>
                  </div>
                </div>
              </div>

              {/* Bottom Confirm Button matching screenshot */}
              <button
                type="submit"
                id="deposit-submit-confirm-btn"
                className="w-full py-2.5 px-4 rounded bg-[#245830] hover:bg-[#1e4a28] active:scale-98 text-white font-bold text-sm tracking-wide shadow-md transition cursor-pointer text-center mt-3"
              >
                التأكيد
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Deposit Request Created Success Dialog matching user's screenshot exactly */}
      {successDialogMethod && (
        <div
          id="deposit-success-dialog-backdrop"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSuccessDialogMethod(null)}
        >
          <div
            id="deposit-success-dialog-card"
            className="w-full max-w-[340px] bg-white rounded-lg shadow-2xl overflow-hidden relative flex flex-col animate-in zoom-in-95 duration-200"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close 'X' button at top right */}
            <button
              type="button"
              id="deposit-success-dialog-close-btn"
              onClick={() => setSuccessDialogMethod(null)}
              className="absolute top-2.5 right-2.5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition z-10 cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Upper Section: White background with centered payment method logo */}
            <div className="w-full pt-9 pb-8 px-4 flex items-center justify-center bg-white min-h-[95px]">
              <div className="scale-125 transform transition-transform flex items-center justify-center">
                {successDialogMethod.logo}
              </div>
            </div>

            {/* Lower Section: Light gray background with centered text matching screenshot */}
            <div className="w-full py-4 px-4 bg-[#f2f4f6] text-center border-t border-slate-200/60">
              <p className="text-slate-800 font-bold text-sm sm:text-base leading-relaxed select-text">
                تم إنشاء طلب الإيداع بنجاح.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

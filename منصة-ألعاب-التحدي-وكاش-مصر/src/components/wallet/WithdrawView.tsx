import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Copy, Check, ArrowRight, RotateCw, X, ChevronDown, AlertTriangle } from 'lucide-react';

interface WithdrawMethodConfig {
  id: string;
  name: string;
  category: 'recommended' | 'bank' | 'crypto';
  minWithdraw: number;
  maxWithdraw: number;
  logo: React.ReactNode;
  label: string;
}

export const WithdrawView: React.FC = () => {
  const { user, setScreen, withdraw, showToast, transactions, adminSettings, isBalanceCapped, maxBalanceLimit } = useApp();
  const [selectedMethod, setSelectedMethod] = useState<WithdrawMethodConfig | null>(null);
  const [amount, setAmount] = useState<string>('50.00');
  const [walletPhone, setWalletPhone] = useState<string>(user.phone || '');
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const minGlobalWithdraw = adminSettings.minWithdraw || 50;

  const methods: WithdrawMethodConfig[] = [
    // Recommended
    {
      id: 'instapay',
      name: 'Instapay',
      category: 'recommended',
      minWithdraw: minGlobalWithdraw,
      maxWithdraw: 50000,
      label: 'رقم هاتف أو عنوان انستاباي:',
      logo: (
        <div className="flex items-center justify-center font-black italic tracking-tighter text-base sm:text-lg">
          <span className="text-[#3b1263]">INSTA</span>
          <span className="text-[#e85d04]">»</span>
          <span className="text-[#3b1263]">PAY</span>
        </div>
      ),
    },
    {
      id: 'vodafone',
      name: 'Vodafone Cash',
      category: 'recommended',
      minWithdraw: minGlobalWithdraw,
      maxWithdraw: 30000,
      label: 'رقم هاتفك فودافون كاش:',
      logo: (
        <div className="flex items-center justify-center gap-1.5 font-bold text-sm sm:text-base">
          <div className="w-5 h-5 rounded-full border-2 border-red-600 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-red-600"></div>
          </div>
          <span className="text-red-600 font-extrabold lowercase">vodafone</span>
        </div>
      ),
    },
    {
      id: 'etisalat',
      name: 'Etisalat Cash',
      category: 'recommended',
      minWithdraw: minGlobalWithdraw,
      maxWithdraw: 20000,
      label: 'رقم هاتفك اتصالات كاش:',
      logo: (
        <div className="flex items-center justify-center gap-1 font-bold text-sm sm:text-base">
          <span className="text-slate-900 font-black lowercase">etisalat</span>
          <span className="text-red-600 font-black italic">e&</span>
        </div>
      ),
    },
    {
      id: 'orange',
      name: 'Orange cash',
      category: 'recommended',
      minWithdraw: minGlobalWithdraw,
      maxWithdraw: 30000,
      label: 'رقم هاتفك اورنج كاش:',
      logo: (
        <div className="flex items-center justify-center gap-1.5 font-bold text-xs sm:text-sm">
          <div className="w-5 h-5 bg-black flex items-center justify-center font-black text-amber-500 text-xs">
            7K
          </div>
          <span className="text-slate-900 font-extrabold">كاش اورنج</span>
        </div>
      ),
    },
    // Bank Transfer
    {
      id: 'telda',
      name: 'Telda',
      category: 'bank',
      minWithdraw: 100,
      maxWithdraw: 50000,
      label: 'رقم هاتف أو حساب تيلدا:',
      logo: (
        <div className="flex items-center justify-center font-black text-xl sm:text-2xl text-[#4f2d7f] tracking-tight">
          telda
        </div>
      ),
    },
    // Crypto
    {
      id: 'tether_pol',
      name: 'Tether on POL',
      category: 'crypto',
      minWithdraw: 200,
      maxWithdraw: 100000,
      label: 'عنوان محفظة Tether (POL):',
      logo: (
        <div className="flex items-center justify-center gap-1 opacity-80">
          <div className="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center text-xs font-bold">
            ₮
          </div>
          <div className="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center text-xs font-bold">
            ∞
          </div>
        </div>
      ),
    },
    {
      id: 'tether_ton',
      name: 'Tether on TON',
      category: 'crypto',
      minWithdraw: 200,
      maxWithdraw: 100000,
      label: 'عنوان محفظة Tether (TON):',
      logo: (
        <div className="flex items-center justify-center gap-1 opacity-80">
          <div className="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center text-xs font-bold">
            ₮
          </div>
          <div className="w-6 h-6 rounded-full bg-slate-400 text-white flex items-center justify-center text-xs font-bold">
            ∇
          </div>
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

  const handleSubmitWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMethod) return;

    if (user.role !== 'admin' && isBalanceCapped) {
      showToast(
        `لقد وصلت إلى الحد النهائي من الفلوس (${maxBalanceLimit.toLocaleString('ar-EG')} ج.م). يجب عمل إيداع جديد لتفعيل السحب ومواصلة اللعب!`,
        'error'
      );
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < selectedMethod.minWithdraw) {
      showToast(`الحد الأدنى للسحب هو EGP ${selectedMethod.minWithdraw}`, 'error');
      return;
    }

    if (numAmount > user.balance) {
      showToast('عفواً، رصيدك الحالي لا يكفي لإتمام عملية السحب', 'error');
      return;
    }

    if (!walletPhone.trim()) {
      showToast('يرجى إدخال رقم الهاتف المراد السحب إليه', 'error');
      return;
    }

    const res = withdraw(numAmount, `${selectedMethod.name} (${walletPhone})`);
    if (res.success) {
      setSelectedMethod(null);
      setWalletPhone('');
    }
  };

  const userWithdrawHistory = transactions.filter(
    (t) =>
      t.type === 'withdraw' &&
      Boolean(t.userId) &&
      (t.userId === user.id ||
        (!/^\d{10}$/.test(t.userId) && Boolean(user.phone) && user.phone.length >= 8 && t.userPhone === user.phone))
  );

  return (
    <div className="w-full min-h-screen bg-[#d6e5d8] text-slate-800 flex flex-col font-['Tajawal',sans-serif] select-none" dir="rtl">
      {/* Top Header Bar matching screenshot */}
      <div className="w-full bg-white border-b border-slate-300/80 px-4 py-2.5 flex items-center justify-between shadow-xs sticky top-0 z-30">
        {/* Refresh Icon */}
        <button
          onClick={() => window.location.reload()}
          id="withdraw-refresh-btn"
          className="p-1.5 text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          <RotateCw className="w-5 h-5" />
        </button>

        {/* Center Title */}
        <h1 className="text-base sm:text-lg font-bold text-slate-700">سحب الأموال</h1>

        {/* Back Arrow */}
        <button
          onClick={() => setScreen('lobby')}
          id="withdraw-back-header-btn"
          className="p-1.5 text-slate-600 hover:text-slate-900 transition cursor-pointer"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 py-3 flex flex-col gap-3">
        {/* Subheader: Account ID with copy icon */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
              <span>سحب الأموال من الحساب</span>
              <button
                onClick={handleCopyId}
                id="withdraw-copy-account-id-btn"
                className="flex items-center gap-1 font-mono font-bold text-slate-900 bg-white/70 hover:bg-white px-2 py-0.5 rounded border border-slate-300/80 cursor-pointer shadow-2xs"
              >
                <span>{user.id}</span>
                {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-500" />}
              </button>
            </div>
            
            {/* Current Balance Tag */}
            <div className="text-xs font-bold text-slate-800">
              الرصيد: <span className="text-emerald-700 font-mono">{user.balance.toFixed(2)} EGP</span>
            </div>
          </div>

          {/* Balance Capped Warning Banner */}
          {user.role !== 'admin' && isBalanceCapped && (
            <div className="w-full bg-red-50 border-2 border-red-500 rounded-lg p-3 text-right shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-red-700">
                    لقد وصلت إلى الحد النهائي من الفلوس ({maxBalanceLimit.toLocaleString('ar-EG')} ج.م)
                  </span>
                  <span className="text-xs text-slate-600">
                    لا يمكنك سحب الأموال أو اللعب حالياً. قم بإجراء إيداع جديد لتفعيل السحب ومواصلة اللعب بحرية.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScreen('deposit')}
                id="withdraw-capped-deposit-btn"
                className="px-4 py-2 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs transition"
              >
                شحن الحساب الآن 💳
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="bg-[#245830] text-white text-xs font-bold px-3 py-1.5 rounded-sm shadow-xs flex items-center gap-1">
              <span>أنواع أنظمة الدفع</span>
            </div>

            {/* Green button: طلبات السحب ︾ */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              id="withdraw-history-toggle-btn"
              className="bg-[#245830] hover:bg-[#1e4a28] text-white text-xs font-bold px-3 py-1.5 rounded-sm shadow-xs flex items-center gap-1.5 cursor-pointer transition"
            >
              <span>طلبات السحب</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Withdrawal History Drawer if toggled */}
        {showHistory && (
          <div className="w-full bg-white rounded border border-slate-300 p-3 shadow-xs flex flex-col gap-2 text-xs">
            <span className="font-bold text-slate-800">سجل طلبات السحب الخاصة بك:</span>
            {userWithdrawHistory.length === 0 ? (
              <span className="text-slate-500 py-2 text-center">لا توجد طلبات سحب سابقة</span>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100">
                {userWithdrawHistory.map((item) => (
                  <div key={item.id} className="py-2 flex items-center justify-between">
                    <div className="flex flex-col text-right">
                      <span className="font-bold text-slate-800">{item.method || 'سحب لمحفظة'}</span>
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
                        {item.status === 'completed' ? 'تم التحويل' : item.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Category: موصى به (Recommended) */}
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
                    setAmount('50.00');
                  }}
                  id={`withdraw-card-${method.id}`}
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

        {/* Category: التحويل البنكي (Bank Transfer) */}
        <div className="flex flex-col gap-2 mt-2">
          <span className="text-xs font-bold text-slate-700">التحويل البنكي</span>
          <div className="grid grid-cols-2 gap-2.5">
            {methods
              .filter((m) => m.category === 'bank')
              .map((method) => (
                <div
                  key={method.id}
                  onClick={() => {
                    setSelectedMethod(method);
                    setAmount('100.00');
                  }}
                  id={`withdraw-card-${method.id}`}
                  className="bg-white rounded overflow-hidden border border-slate-300/90 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col group col-start-2"
                >
                  <div className="w-full h-16 bg-white flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-200">
                    {method.logo}
                  </div>
                  <div className="w-full bg-[#464c53] text-white text-center py-1.5 text-xs font-bold">
                    {method.name}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Category: عملة الكريبتو (Crypto) */}
        <div className="flex flex-col gap-2 mt-2 pb-8">
          <span className="text-xs font-bold text-slate-700">عملة الكريبتو</span>
          <div className="grid grid-cols-2 gap-2.5">
            {methods
              .filter((m) => m.category === 'crypto')
              .map((method) => (
                <div
                  key={method.id}
                  onClick={() => {
                    setSelectedMethod(method);
                    setAmount('200.00');
                  }}
                  id={`withdraw-card-${method.id}`}
                  className="bg-white rounded overflow-hidden border border-slate-300/90 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col group"
                >
                  <div className="w-full h-16 bg-white flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-200">
                    {method.logo}
                  </div>
                  <div className="w-full bg-[#95a5b5] text-white text-center py-1.5 text-xs font-medium">
                    {method.name}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* POPUP / MODAL for Selected Withdrawal Method matching photo_2026-08-31_22-05-46.jpg */}
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
                id="withdraw-modal-close-btn"
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body matching photo_2026-08-31_22-05-46.jpg */}
            <form onSubmit={handleSubmitWithdraw} className="p-4 flex flex-col gap-4">
              {/* Amount Row with Min / Max */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium">
                  <span>(EGP {selectedMethod.maxWithdraw.toLocaleString('en-US')}.00 الأقصى</span>
                  <span>المبلغ (الحد الأدنى EGP {selectedMethod.minWithdraw.toFixed(2)} / الحد</span>
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={selectedMethod.minWithdraw}
                  max={selectedMethod.maxWithdraw}
                  step="any"
                  id="withdraw-amount-input"
                  className="w-full p-2.5 rounded border border-slate-300 text-center font-bold text-slate-900 text-sm focus:outline-none focus:border-emerald-600 bg-white"
                  required
                />
              </div>

              {/* Phone / Account Number Row */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 text-right">
                  {selectedMethod.label}
                </label>
                <input
                  type="tel"
                  value={walletPhone}
                  onChange={(e) => setWalletPhone(e.target.value)}
                  placeholder="digits 11"
                  id="withdraw-phone-input"
                  className="w-full p-2.5 rounded border border-slate-300 text-right text-xs sm:text-sm font-mono text-slate-900 focus:outline-none focus:border-emerald-600 bg-white"
                  required
                />
              </div>

              {/* Confirm Button matching screenshot */}
              <button
                type="submit"
                id="withdraw-submit-confirm-btn"
                className="w-full py-2.5 px-4 rounded bg-[#245830] hover:bg-[#1e4a28] active:scale-98 text-white font-bold text-sm tracking-wide shadow-md transition cursor-pointer text-center mt-2"
              >
                التأكيد
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

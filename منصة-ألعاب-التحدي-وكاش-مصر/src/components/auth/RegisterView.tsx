import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export const RegisterView: React.FC = () => {
  const { register, setScreen, showToast } = useApp();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      showToast('يرجى إدخال رقم الهاتف', 'error');
      return;
    }
    if (!password) {
      showToast('يرجى إدخال كلمة المرور', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showToast('كلمات المرور غير متطابقة', 'error');
      return;
    }
    register(phone, password);
  };

  return (
    <div className="w-full min-h-full flex-1 flex flex-col justify-between bg-slate-50 relative py-12 px-8">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center">
        {/* Top Header */}
        <h1 className="text-2xl font-bold text-center text-[#173a67] mb-12 tracking-tight">
          إنشاء حساب جديد
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-7 w-full">
          {/* Phone Input */}
          <div className="relative border-b border-slate-300 focus-within:border-blue-500 transition-colors pb-1">
            <input
              type="tel"
              id="register-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="رقم الهاتف"
              className="w-full py-2 px-1 text-slate-800 placeholder-slate-400 bg-transparent text-sm md:text-base focus:outline-none text-right"
              dir="rtl"
            />
          </div>

          {/* Password Input */}
          <div className="relative border-b border-slate-300 focus-within:border-blue-500 transition-colors pb-1">
            <input
              type="password"
              id="register-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة المرور"
              className="w-full py-2 px-1 text-slate-800 placeholder-slate-400 bg-transparent text-sm md:text-base focus:outline-none text-right"
              dir="rtl"
            />
          </div>

          {/* Confirm Password Input */}
          <div className="relative border-b border-slate-300 focus-within:border-blue-500 transition-colors pb-1">
            <input
              type="password"
              id="register-confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="تأكيد كلمة المرور"
              className="w-full py-2 px-1 text-slate-800 placeholder-slate-400 bg-transparent text-sm md:text-base focus:outline-none text-right"
              dir="rtl"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="register-submit-btn"
            className="w-full mt-6 py-3 px-6 rounded-full bg-[#4a80ce] hover:bg-[#3b70be] active:scale-[0.99] text-white font-bold text-base shadow-md transition-all cursor-pointer text-center"
          >
            إنشاء الحساب ودخول
          </button>
        </form>
      </div>

      {/* Bottom Link to Login */}
      <div className="w-full text-center mt-6">
        <button
          type="button"
          onClick={() => setScreen('login')}
          id="goto-login-btn"
          className="text-sm font-semibold text-[#4a80ce] hover:underline cursor-pointer"
        >
          لديك حساب بالفعل؟ تسجيل الدخول
        </button>
      </div>
    </div>
  );
};

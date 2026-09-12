import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Eye, EyeOff } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, setScreen, showToast } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      showToast('يرجى إدخال البريد الإلكتروني أو اسم المستخدم', 'error');
      return;
    }
    if (!password) {
      showToast('يرجى إدخال كلمة المرور', 'error');
      return;
    }
    login(identifier, password);
  };

  return (
    <div className="w-full min-h-full flex-1 flex flex-col justify-between bg-slate-50 relative pb-8">
      {/* Top 3D Sphere Graphic matching screenshot */}
      <div className="w-full h-48 relative overflow-hidden bg-gradient-to-b from-slate-100 to-slate-50 flex items-center justify-center">
        {/* Abstract 3D Shapes & Baseball */}
        <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
          {/* Red curved swirl shape */}
          <div className="absolute -top-10 -left-6 w-36 h-36 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 shadow-xl opacity-90"></div>
          {/* Blue curved swirl shape */}
          <div className="absolute -top-12 -right-4 w-44 h-44 rounded-full bg-gradient-to-bl from-blue-500 to-blue-700 shadow-xl opacity-90"></div>
          
          {/* Centered realistic 3D Baseball */}
          <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-br from-slate-100 via-white to-slate-300 shadow-[0_12px_24px_rgba(0,0,0,0.25)] flex items-center justify-center border border-slate-200">
            {/* Red Baseball Stitches */}
            <svg className="w-20 h-20 text-red-500/70" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M 25,10 C 15,35 15,65 25,90" strokeDasharray="3 3" />
              <path d="M 75,10 C 85,35 85,65 75,90" strokeDasharray="3 3" />
              <path d="M 20,20 L 28,24 M 17,35 L 26,37 M 17,50 L 26,50 M 17,65 L 26,63 M 20,80 L 28,76" strokeWidth="1.5" />
              <path d="M 80,20 L 72,24 M 83,35 L 74,37 M 83,50 L 74,50 M 83,65 L 74,63 M 80,80 L 72,76" strokeWidth="1.5" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="w-full px-8 flex-1 flex flex-col justify-start max-w-sm mx-auto">
        <h1 className="text-2xl font-bold text-center text-[#173a67] mb-8 mt-2 tracking-tight">
          تسجيل الدخول
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
          {/* Identifier Input */}
          <div className="relative border-b border-slate-300 focus-within:border-blue-500 transition-colors pb-1">
            <input
              type="text"
              id="login-identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="البريد الإلكتروني أو اسم المستخدم"
              className="w-full py-2 px-1 text-slate-800 placeholder-slate-400 bg-transparent text-sm md:text-base focus:outline-none text-right"
              dir="rtl"
            />
          </div>

          {/* Password Input */}
          <div className="relative border-b border-slate-300 focus-within:border-blue-500 transition-colors pb-1 flex items-center">
            <input
              type={showPassword ? 'text' : 'password'}
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة المرور"
              className="w-full py-2 px-1 text-slate-800 placeholder-slate-400 bg-transparent text-sm md:text-base focus:outline-none text-right"
              dir="rtl"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
              title="إظهار / إخفاء كلمة المرور"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            id="login-submit-btn"
            className="w-full mt-6 py-3 px-6 rounded-full bg-[#4a80ce] hover:bg-[#3b70be] active:scale-[0.99] text-white font-bold text-base shadow-md transition-all cursor-pointer text-center"
          >
            دخول
          </button>
        </form>
      </div>

      {/* Bottom Link to Sign Up */}
      <div className="w-full text-center mt-6">
        <button
          type="button"
          onClick={() => setScreen('register')}
          id="goto-register-btn"
          className="text-sm font-semibold text-[#4a80ce] hover:underline cursor-pointer"
        >
          إنشاء حساب جديد
        </button>
      </div>
    </div>
  );
};

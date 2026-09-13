import React, { useState } from 'react';
import {
  Smartphone,
  Laptop,
  Globe,
  Wifi,
  User,
  Phone,
  Wallet,
  MessageCircle,
  Coins,
  Ban,
  Search,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Activity,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { ConnectedDeviceInfo, UserAccount } from '../../types';
import { useApp } from '../../context/AppContext';

interface AdminOnlineDevicesViewProps {
  onStartChatWithUser: (userId: string, userName?: string, phone?: string) => void;
  onTopUpUser: (userId: string) => void;
  onBanDevice: (deviceId: string, userId?: string) => void;
}

export const AdminOnlineDevicesView: React.FC<AdminOnlineDevicesViewProps> = ({
  onStartChatWithUser,
  onTopUpUser,
  onBanDevice,
}) => {
  const { connectedDevices, allUsers } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'online' | 'mobile' | 'desktop'>('all');

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const now = Date.now();
  const devices = connectedDevices || [];

  // Determine user status
  const getDeviceStatus = (dev: ConnectedDeviceInfo) => {
    const diff = now - (dev.lastSeen || 0);
    if (dev.isOnline && diff < 45000) {
      return { label: 'متصل الآن', color: 'emerald', isLive: true };
    }
    if (diff < 180000) {
      return { label: 'خامل مؤقتاً', color: 'amber', isLive: false };
    }
    return { label: 'غير متصل', color: 'slate', isLive: false };
  };

  // Counts
  const onlineCount = devices.filter((d) => {
    const diff = now - (d.lastSeen || 0);
    return d.isOnline && diff < 45000;
  }).length;

  const mobileCount = devices.filter(
    (d) => (d.deviceType || '').toLowerCase().includes('mobile') || (d.deviceOS || '').toLowerCase().includes('android') || (d.deviceOS || '').toLowerCase().includes('ios')
  ).length;

  const desktopCount = devices.filter(
    (d) => (d.deviceType || '').toLowerCase().includes('desktop') || (d.deviceOS || '').toLowerCase().includes('windows') || (d.deviceOS || '').toLowerCase().includes('mac')
  ).length;

  // Filtered devices
  const filteredDevices = devices.filter((dev) => {
    const status = getDeviceStatus(dev);
    const isMobile = (dev.deviceType || '').toLowerCase().includes('mobile') || (dev.deviceOS || '').toLowerCase().includes('android') || (dev.deviceOS || '').toLowerCase().includes('ios');
    const isDesktop = !isMobile;

    if (deviceFilter === 'online' && !status.isLive) return false;
    if (deviceFilter === 'mobile' && !isMobile) return false;
    if (deviceFilter === 'desktop' && !isDesktop) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      (dev.userId && dev.userId.toLowerCase().includes(q)) ||
      (dev.username && dev.username.toLowerCase().includes(q)) ||
      (dev.phone && dev.phone.includes(q)) ||
      dev.deviceId.toLowerCase().includes(q) ||
      (dev.deviceName && dev.deviceName.toLowerCase().includes(q)) ||
      (dev.deviceOS && dev.deviceOS.toLowerCase().includes(q)) ||
      (dev.deviceBrowser && dev.deviceBrowser.toLowerCase().includes(q)) ||
      (dev.currentScreen && dev.currentScreen.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex flex-col gap-6" dir="rtl">
      {/* Top Banner with Real-Time Presence Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800/80 p-5 rounded-2xl border border-slate-700 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center relative">
            <Wifi className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <span>المتواجدون الآن والأجهزة المتصلة (Live Online Users)</span>
              <span className="text-xs font-mono font-black bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-pulse" />
                {onlineCount} متصل الآن
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              متابعة حركة اللاعبين الحية بالـ ID، وتحديد الأجهزة، والصفحة المتواجدين فيها، وبدء محادثات فورية
            </p>
          </div>
        </div>

        {/* Real-time stats pills */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl px-3.5 py-2 flex flex-col">
            <span className="text-[10px] text-slate-400">أونلاين الآن</span>
            <span className="text-sm font-black font-mono text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {onlineCount} لاعب
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2 flex flex-col">
            <span className="text-[10px] text-slate-400">أجهزة الهاتف</span>
            <span className="text-sm font-black font-mono text-amber-400 flex items-center gap-1">
              <Smartphone className="w-3.5 h-3.5" />
              {mobileCount} جهاز
            </span>
          </div>

          <div className="bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2 flex flex-col">
            <span className="text-[10px] text-slate-400">الكمبيوتر المكتبي</span>
            <span className="text-sm font-black font-mono text-blue-400 flex items-center gap-1">
              <Laptop className="w-3.5 h-3.5" />
              {desktopCount} جهاز
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/80">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => setDeviceFilter('all')}
            className={`py-2 px-3.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
              deviceFilter === 'all'
                ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/20'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            جميع الأجهزة ({devices.length})
          </button>

          <button
            onClick={() => setDeviceFilter('online')}
            className={`py-2 px-3.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              deviceFilter === 'online'
                ? 'bg-emerald-600 text-white font-black shadow-lg shadow-emerald-600/20'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>متصلون الآن ({onlineCount})</span>
          </button>

          <button
            onClick={() => setDeviceFilter('mobile')}
            className={`py-2 px-3.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              deviceFilter === 'mobile'
                ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>هواتف ({mobileCount})</span>
          </button>

          <button
            onClick={() => setDeviceFilter('desktop')}
            className={`py-2 px-3.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              deviceFilter === 'desktop'
                ? 'bg-purple-600 text-white font-black shadow-lg shadow-purple-600/20'
                : 'bg-slate-900 text-slate-300 hover:text-white'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>كمبيوتر ({desktopCount})</span>
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالـ ID، الاسم، المتصفح، النظام..."
            className="w-full bg-slate-900/90 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {/* Devices Grid Cards */}
      {filteredDevices.length === 0 ? (
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-3">
          <Wifi className="w-12 h-12 text-slate-600" />
          <h3 className="text-base font-bold text-slate-300">لا توجد أجهزة متطابقة مع البحث</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            سيتم ظهور اللاعبين هنا فور زيارتهم للموقع أو فتح أي لعبة
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((dev) => {
            const status = getDeviceStatus(dev);
            const isMobile = (dev.deviceType || '').toLowerCase().includes('mobile') || (dev.deviceOS || '').toLowerCase().includes('android') || (dev.deviceOS || '').toLowerCase().includes('ios');
            
            // Find linked user if available
            const linkedUser = dev.userId
              ? allUsers.find((u) => u.id === dev.userId)
              : dev.phone
              ? allUsers.find((u) => u.phone === dev.phone)
              : null;

            const effectiveUserId = dev.userId || linkedUser?.id;
            const effectiveUserName = dev.username || linkedUser?.username || 'زائر غير مسجل';
            const effectivePhone = dev.phone || linkedUser?.phone;
            const effectiveBalance = dev.balance !== undefined ? dev.balance : (linkedUser?.balance || 0);

            return (
              <div
                key={dev.deviceId}
                className={`bg-slate-800/90 rounded-2xl border p-4 sm:p-5 flex flex-col justify-between gap-4 shadow-xl transition hover:border-slate-600 ${
                  status.isLive
                    ? 'border-emerald-500/40 bg-gradient-to-b from-slate-800/90 to-emerald-950/10'
                    : 'border-slate-700/70'
                }`}
              >
                <div className="flex flex-col gap-3">
                  {/* Card Header: Device icon + status */}
                  <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-300">
                        {isMobile ? <Smartphone className="w-5 h-5 text-amber-400" /> : <Laptop className="w-5 h-5 text-blue-400" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-white block">{dev.deviceName || 'جهاز متصل'}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {dev.deviceOS} • {dev.deviceBrowser}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5 ${
                        status.color === 'emerald'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : status.color === 'amber'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        status.color === 'emerald' ? 'bg-emerald-400 animate-pulse' : status.color === 'amber' ? 'bg-amber-400' : 'bg-slate-500'
                      }`} />
                      {status.label}
                    </span>
                  </div>

                  {/* Player 10-Digit ID & Info */}
                  <div className="bg-[#0b1220] p-3 rounded-xl border border-slate-700/70 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-bold text-white">{effectiveUserName}</span>
                      </div>

                      {effectiveUserId && (
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-mono font-extrabold bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                            ID: {effectiveUserId}
                          </span>
                          <button
                            onClick={() => handleCopy(effectiveUserId, `id-${dev.deviceId}`)}
                            className="p-0.5 text-slate-400 hover:text-white"
                          >
                            {copiedField === `id-${dev.deviceId}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                      <span className="text-slate-400 text-[11px]">الرصيد المتاح:</span>
                      <span className="font-mono font-black text-emerald-400" dir="rtl">
                        {effectiveBalance.toFixed(2)} ج.م
                      </span>
                    </div>

                    {dev.currentScreen && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 text-[11px]">الصفحة الحالية:</span>
                        <span className="text-amber-300 text-[11px] font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                          {dev.currentScreen}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions on this device & user */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-700/60">
                  {effectiveUserId && (
                    <button
                      onClick={() => onStartChatWithUser(effectiveUserId, effectiveUserName, effectivePhone)}
                      className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md shadow-blue-900/30"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>محادثة فورية</span>
                    </button>
                  )}

                  {effectiveUserId && (
                    <button
                      onClick={() => onTopUpUser(effectiveUserId)}
                      className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1 transition cursor-pointer shadow-md shadow-amber-500/20"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>شحن</span>
                    </button>
                  )}

                  <button
                    onClick={() => onBanDevice(dev.deviceId, effectiveUserId)}
                    title="حظر هذا الجهاز نهائياً"
                    className="p-2 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-300 hover:text-white border border-red-700/80 transition cursor-pointer"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

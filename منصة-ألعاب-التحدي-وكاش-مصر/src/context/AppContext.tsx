import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Screen, UserAccount, Transaction, PaymentMethodType, AdminSettings, SupportTicket, SupportMessage, ConnectedDeviceInfo, calculateBalanceLimit, getEffectiveBalanceLimit } from '../types';
import { sound } from '../utils/sound';
import { detectDeviceInfo } from '../utils/device';
import {
  fbSaveUser,
  fbSaveTransaction,
  fbUpdateTransactionStatus,
  fbSaveSettings,
  fbSaveSupportTicket,
  fbAddSupportMessage,
  fbListenTransactions,
  fbListenAllUsers,
  fbListenUser,
  fbListenSettings,
  fbListenSupportTickets,
  fbListenConnectedDevices,
  fbRegisterDevice,
  fbUpdateDevicePresence,
  fbMarkDeviceOffline,
  fbFetchAllTransactions,
  fbFetchAllUsers,
  fbFetchAllSupportTickets,
  fbFetchAllConnectedDevices,
  fbBanUserAndDevice,
  fbUnban,
  fbDeleteUser,
  fbListenBanned,
  fbUpdatePresence,
  fbMarkOffline,
  fbClearForceLogout,
  fbDeleteTransaction,
  fbClearAllTransactions,
  fbResetAllPlatformData,
} from '../services/firebaseSync';
import { broadcastSync, subscribeSync } from '../services/broadcastSync';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface AppContextType {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  user: UserAccount;
  setUser: React.Dispatch<React.SetStateAction<UserAccount>>;
  allUsers: UserAccount[];
  adminSettings: AdminSettings;
  updateAdminSettings: (settings: Partial<AdminSettings>) => void;
  login: (identifier: string, pass: string) => boolean;
  register: (phone: string, pass: string) => boolean;
  logout: () => void;
  selectedDepositMethod: PaymentMethodType;
  setSelectedDepositMethod: (method: PaymentMethodType) => void;
  deposit: (amount: number, method: string, senderPhone: string, receiptImage?: string, referenceCode?: string) => boolean;
  withdraw: (amount: number, walletNumber: string) => { success: boolean; error?: string };
  placeBet: (amount: number, game: string) => boolean;
  winBet: (amount: number, multiplier: number, game: string) => void;
  transactions: Transaction[];
  approveDeposit: (txId: string) => void;
  rejectDeposit: (txId: string, reason?: string) => void;
  approveWithdraw: (txId: string) => void;
  rejectWithdraw: (txId: string, reason?: string) => void;
  addBalanceByUserId: (userId: string, amount: number, note?: string) => { success: boolean; message: string };
  deleteAndBanUser: (userId: string, reason?: string) => Promise<boolean>;
  deleteUserOnly: (userId: string) => Promise<boolean>;
  deleteTransaction: (txId: string) => Promise<boolean>;
  clearAllTransactions: () => Promise<boolean>;
  resetAllPlatformData: () => Promise<boolean>;
  unbanUser: (identifier: string) => Promise<boolean>;
  isDeviceBanned: boolean;
  supportTickets: SupportTicket[];
  createSupportTicket: (subject: string, message: string) => Promise<string>;
  sendSupportMessage: (
    ticketId: string,
    text: string,
    senderRole?: 'user' | 'admin',
    senderName?: string,
    imageUrl?: string,
    depositRefId?: string
  ) => Promise<void>;
  getOrCreateTicketForUser: (
    targetUserId: string,
    targetUserName?: string,
    targetUserPhone?: string,
    subject?: string
  ) => Promise<string>;
  resolveSupportTicket: (ticketId: string) => Promise<void>;
  isSupportOpen: boolean;
  setIsSupportOpen: (open: boolean) => void;
  updateUserInstagram: (userId: string, instagram: string) => Promise<boolean>;
  updatePlayerProfitLimit: (userId: string, newLimit: number) => Promise<boolean>;
  connectedDevices: ConnectedDeviceInfo[];
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  isHackerEnabled: boolean;
  setIsHackerEnabled: (enabled: boolean) => void;
  maxBalanceLimit: number;
  isBalanceCapped: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  vodafoneNumber: '01098688815',
  etisalatNumber: '01123456789',
  orangeNumber: '01234567890',
  instapayNumber: '01098688815',
  instapayAccountName: 'WINNERBET EGYPT',
  minDeposit: 10,
  minWithdraw: 50,
  platformName: 'WINNERBET',
  autoApproveDeposits: false,
  instagramUsername: '@winnerbet_official',
  instagramLink: 'https://instagram.com/winnerbet_official',
  enableProfitCap: true,
  profitCapMultiplier: 5,
  profitCapBase: 'last_deposit',
  profitCapMessage: 'لقد وصلت إلى الحد الأقصى من الأرباح، يجب تشحن لإجراء عملية سحب أو لعب.',
  exactCrashAtLimit: true,
};

// Generate a random 10-digit numeric ID starting with 1-9 (e.g. 1726413807)
export const generate10DigitId = (): string => {
  const first = Math.floor(1 + Math.random() * 9); // 1-9
  const rest = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
  return `${first}${rest}`;
};

const createDefaultGuestUser = (): UserAccount => {
  const initialId = generate10DigitId();
  return {
    id: initialId,
    username: `لاعب_${initialId.slice(-4)}`,
    phone: '',
    balance: 0.0,
    isLoggedIn: false,
    registeredAt: Date.now(),
    totalDeposited: 0,
    totalWithdrawn: 0,
    role: 'user',
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Admin settings
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(() => {
    try {
      const saved = localStorage.getItem('app_admin_settings');
      if (saved) return { ...DEFAULT_ADMIN_SETTINGS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_ADMIN_SETTINGS;
  });

  // All registered users - ensure every user has a 10-digit ID
  const [allUsers, setAllUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem('app_all_users');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((u) => {
            if (u.role !== 'admin' && (!u.id || !/^\d{10}$/.test(u.id))) {
              return { ...u, id: generate10DigitId() };
            }
            return u;
          });
        }
      }
    } catch {}
    return [];
  });

  // Active current user session - always guarantees a 10-digit numeric ID
  const [user, setUser] = useState<UserAccount>(() => {
    try {
      const saved = localStorage.getItem('app_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          // If user is regular user, ensure 10-digit ID
          if (parsed.role !== 'admin') {
            if (!parsed.id || !/^\d{10}$/.test(parsed.id)) {
              const oldId = parsed.id;
              parsed.id = generate10DigitId();
              if (!parsed.username) parsed.username = `لاعب_${parsed.id.slice(-4)}`;
              // Migrate local transactions
              try {
                const txsStr = localStorage.getItem('app_txs');
                if (txsStr) {
                  const txs = JSON.parse(txsStr);
                  if (Array.isArray(txs)) {
                    const updatedTxs = txs.map((t: any) =>
                      t.userId === oldId || !t.userId ? { ...t, userId: parsed.id } : t
                    );
                    localStorage.setItem('app_txs', JSON.stringify(updatedTxs));
                  }
                }
              } catch {}
              try {
                localStorage.setItem('app_user', JSON.stringify(parsed));
              } catch {}
            }
          }
          return parsed;
        }
      }
    } catch {}
    const freshGuest = createDefaultGuestUser();
    try {
      localStorage.setItem('app_user', JSON.stringify(freshGuest));
    } catch {}
    return freshGuest;
  });

  // Screen
  const [screen, setScreenState] = useState<Screen>(() => {
    try {
      const saved = localStorage.getItem('app_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.isLoggedIn && parsed.id) return 'lobby';
      }
    } catch {}
    return 'register';
  });

  const [selectedDepositMethod, setSelectedDepositMethod] = useState<PaymentMethodType>('vodafone');
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(true);
  const [isHackerEnabled, setIsHackerEnabled] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);
  const [isDeviceBanned, setIsDeviceBanned] = useState<boolean>(() => {
    try {
      return localStorage.getItem('app_device_banned') === 'true';
    } catch {
      return false;
    }
  });
  const [bannedUsersMap, setBannedUsersMap] = useState<Record<string, any>>({});
  const [bannedDevicesMap, setBannedDevicesMap] = useState<Record<string, any>>({});

  // Transactions list
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('app_txs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Support Tickets
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => {
    try {
      const saved = localStorage.getItem('app_support_tickets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Connected live devices
  const [connectedDevices, setConnectedDevices] = useState<ConnectedDeviceInfo[]>([]);

  // Ref to track latest user balance for avoiding race conditions in listeners
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Persist states to local storage
  useEffect(() => {
    try {
      localStorage.setItem('app_admin_settings', JSON.stringify(adminSettings));
    } catch {}
  }, [adminSettings]);

  useEffect(() => {
    try {
      localStorage.setItem('app_all_users', JSON.stringify(allUsers));
    } catch {}
  }, [allUsers]);

  useEffect(() => {
    try {
      if (user.isLoggedIn) {
        localStorage.setItem('app_user', JSON.stringify(user));
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    try {
      localStorage.setItem('app_txs', JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  useEffect(() => {
    try {
      localStorage.setItem('app_support_tickets', JSON.stringify(supportTickets));
    } catch {}
  }, [supportTickets]);

  // Realtime Firebase RTDB Listeners (Transactions, Settings, Support Tickets, Users)
  useEffect(() => {
    // 1. Transactions Listener
    const unsubTxs = fbListenTransactions((fbTxs) => {
      if (fbTxs && fbTxs.length > 0) {
        setTransactions(fbTxs);
        try {
          localStorage.setItem('app_txs', JSON.stringify(fbTxs));
        } catch {}
      }
    });

    // 2. Settings Listener
    const unsubSettings = fbListenSettings((fbSettings) => {
      if (fbSettings) {
        setAdminSettings((prev) => ({ ...prev, ...fbSettings }));
      }
    });

    // 3. All Users Listener
    const unsubAllUsers = fbListenAllUsers((fbUsers) => {
      if (fbUsers && fbUsers.length > 0) {
        setAllUsers(fbUsers);
        try {
          localStorage.setItem('app_all_users', JSON.stringify(fbUsers));
        } catch {}
      }
    });

    // 4. Support Tickets Listener
    const unsubSupport = fbListenSupportTickets((fbTickets) => {
      if (fbTickets) {
        setSupportTickets(fbTickets);
        try {
          localStorage.setItem('app_support_tickets', JSON.stringify(fbTickets));
        } catch {}
      }
    });

    // 5. Banned Users & Devices Listener
    const unsubBanned = fbListenBanned(({ users: bannedUsers, devices: bannedDevices }) => {
      setBannedUsersMap(bannedUsers || {});
      setBannedDevicesMap(bannedDevices || {});

      // Check current device
      const currentDev = detectDeviceInfo();
      const safeDevKey = currentDev.deviceId.replace(/[.#$[\]]/g, '_');
      const isThisDeviceBanned = Boolean(bannedDevices && (bannedDevices[safeDevKey] || bannedDevices[currentDev.deviceId]));

      // Check active user
      const currentUserPhone = userRef.current?.phone?.replace(/[^0-9]/g, '') || '';
      const isThisUserBanned = Boolean(
        userRef.current?.isBanned ||
        (userRef.current?.id && bannedUsers && bannedUsers[userRef.current.id]) ||
        (currentUserPhone && bannedUsers && bannedUsers[currentUserPhone])
      );

      if (isThisDeviceBanned || isThisUserBanned) {
        setIsDeviceBanned(true);
        try {
          localStorage.setItem('app_device_banned', 'true');
          localStorage.removeItem('app_user');
        } catch {}
        setUser(createDefaultGuestUser());
        setScreenState('register');
      } else {
        // If explicitly unbanned
        if (!isThisDeviceBanned && !isThisUserBanned) {
          try {
            if (localStorage.getItem('app_device_banned') === 'true') {
              localStorage.removeItem('app_device_banned');
            }
          } catch {}
          setIsDeviceBanned(false);
        }
      }
    });

    // 6. Connected Devices Listener
    const unsubDevices = fbListenConnectedDevices((fbDevs) => {
      if (fbDevs) {
        setConnectedDevices(fbDevs);
      }
    });

    // 7. Register this client's device in Firebase RTDB and start heartbeat
    const clientDev = detectDeviceInfo(userRef.current);
    fbRegisterDevice(clientDev);

    const presenceInterval = setInterval(() => {
      const activeUser = userRef.current;
      fbUpdateDevicePresence(clientDev.deviceId, {
        userId: activeUser?.id || undefined,
        username: activeUser?.username || undefined,
        phone: activeUser?.phone || undefined,
        balance: activeUser?.balance,
        isOnline: true,
        lastSeen: Date.now(),
      });
    }, 12000);

    const handleBeforeUnload = () => {
      fbMarkDeviceOffline(clientDev.deviceId);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 8. Auto-Refresh Active Polling (every 3.5 seconds)
    // Ensures real-time synchronization for Admin even if WebSockets are throttled
    const autoRefreshInterval = setInterval(async () => {
      try {
        const [latestTxs, latestSupport, latestUsers, latestDevs] = await Promise.all([
          fbFetchAllTransactions(),
          fbFetchAllSupportTickets(),
          fbFetchAllUsers(),
          fbFetchAllConnectedDevices(),
        ]);

        if (latestTxs && latestTxs.length > 0) {
          setTransactions((prev) => {
            const prevPending = prev.filter((t) => t.type === 'deposit' && t.status === 'pending').length;
            const newPending = latestTxs.filter((t) => t.type === 'deposit' && t.status === 'pending').length;
            if (newPending > prevPending) {
              sound.playWin();
            }
            return latestTxs;
          });
        }

        if (latestSupport && latestSupport.length > 0) {
          setSupportTickets(latestSupport);
        }

        if (latestUsers && latestUsers.length > 0) {
          setAllUsers(latestUsers);
        }

        if (latestDevs && latestDevs.length > 0) {
          setConnectedDevices(latestDevs);
        }
      } catch (err) {
        // silent catch for background polling
      }
    }, 3500);

    return () => {
      clearInterval(presenceInterval);
      clearInterval(autoRefreshInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unsubTxs();
      unsubSettings();
      unsubAllUsers();
      unsubSupport();
      unsubBanned();
      unsubDevices();
    };
  }, []);

  // Listen to current active user's document in Firebase for instant live balance update, profit cap limit, and admin force-logout
  useEffect(() => {
    if (!user.id || user.id === 'guest') return;
    const unsubUser = fbListenUser(user.id, (userData) => {
      if (!userData) return;

      // 1. Check for Admin Force Logout command
      if (userData.forceLogout) {
        sound.playCrash();
        fbClearForceLogout(user.id);
        try {
          localStorage.removeItem('app_user');
        } catch {}
        const guest = createDefaultGuestUser();
        try {
          localStorage.setItem('app_user', JSON.stringify(guest));
        } catch {}
        setUser(guest);
        setScreenState('register');
        showToast('⚠️ قامت إدارة المنصة بتسجيل خروجك وإيقاف الجلسة. يمكنك إعادة تسجيل الدخول مجدداً.', 'error');
        return;
      }

      // 2. Sync balance, profit cap settings, and deposits/withdrawals
      setUser((prev) => {
        let changed = false;
        const next = { ...prev };

        if (typeof userData.balance === 'number' && userData.balance !== prev.balance) {
          if (userData.balance > prev.balance) {
            sound.playWin();
          }
          next.balance = Number(userData.balance.toFixed(2));
          changed = true;
        }

        if (userData.totalDeposited !== undefined && userData.totalDeposited !== prev.totalDeposited) {
          next.totalDeposited = userData.totalDeposited;
          changed = true;
        }

        if (userData.totalWithdrawn !== undefined && userData.totalWithdrawn !== prev.totalWithdrawn) {
          next.totalWithdrawn = userData.totalWithdrawn;
          changed = true;
        }

        if (userData.customProfitLimit !== undefined && userData.customProfitLimit !== prev.customProfitLimit) {
          next.customProfitLimit = userData.customProfitLimit;
          changed = true;
        }

        if (userData.profitLimitEnabled !== undefined && userData.profitLimitEnabled !== prev.profitLimitEnabled) {
          next.profitLimitEnabled = userData.profitLimitEnabled;
          changed = true;
        }

        if (userData.maxBalanceLimit !== undefined && userData.maxBalanceLimit !== prev.maxBalanceLimit) {
          next.maxBalanceLimit = userData.maxBalanceLimit;
          changed = true;
        }

        if (userData.lastDepositAmount !== undefined && userData.lastDepositAmount !== prev.lastDepositAmount) {
          next.lastDepositAmount = userData.lastDepositAmount;
          changed = true;
        }

        if (changed) {
          try {
            localStorage.setItem('app_user', JSON.stringify(next));
          } catch {}
          return next;
        }

        return prev;
      });
    });

    return () => unsubUser();
  }, [user.id]);

  // Real-time Presence Heartbeat: Keeps "المتصلين الآن" status 100% accurate in Admin Dashboard
  useEffect(() => {
    if (!user.id || user.id === 'guest') return;

    // Send immediate heartbeat on mount or login
    fbUpdatePresence(user.id);

    // Heartbeat every 10 seconds while tab is active
    const interval = setInterval(() => {
      fbUpdatePresence(user.id);
    }, 10000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fbUpdatePresence(user.id);
      } else {
        fbMarkOffline(user.id);
      }
    };

    const handleBeforeUnload = () => {
      fbMarkOffline(user.id);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user.id]);

  // Synchronize state with standalone HTML admin panel in real-time across tabs & broadcast channels
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      try {
        if (e.key === 'app_admin_settings' && e.newValue) {
          setAdminSettings(JSON.parse(e.newValue));
        }
        if (e.key === 'app_all_users' && e.newValue) {
          const parsedUsers: UserAccount[] = JSON.parse(e.newValue);
          setAllUsers(parsedUsers);
          const currentInParsed = parsedUsers.find((u) => u.id === user.id);
          if (currentInParsed) {
            setUser((prev) => ({ ...prev, balance: currentInParsed.balance }));
          }
        }
        if (e.key === 'app_user' && e.newValue) {
          setUser(JSON.parse(e.newValue));
        }
        if (e.key === 'app_txs' && e.newValue) {
          setTransactions(JSON.parse(e.newValue));
        }
        if (e.key === 'app_support_tickets' && e.newValue) {
          setSupportTickets(JSON.parse(e.newValue));
        }
      } catch {}
    };

    window.addEventListener('storage', handleStorage);

    // Also listen to zero-latency BroadcastChannel
    const unsubBroadcast = subscribeSync((msg) => {
      try {
        if (msg.type === 'SETTINGS_UPDATED' && msg.data) {
          setAdminSettings((prev) => ({ ...prev, ...msg.data }));
        }
        if (msg.type === 'DEPOSIT_APPROVED' || msg.type === 'DIRECT_TOPUP' || msg.type === 'USER_UPDATED') {
          if (msg.data?.userId === user.id && typeof msg.data.newBalance === 'number') {
            sound.playWin();
            setUser((prev) => ({ ...prev, balance: msg.data.newBalance }));
          }
        }
        if (msg.type === 'WITHDRAW_REJECTED' && msg.data?.userId === user.id) {
          if (typeof msg.data.newBalance === 'number') {
            setUser((prev) => ({ ...prev, balance: msg.data.newBalance }));
          }
        }
        if (msg.type === 'SUPPORT_UPDATED' && msg.data) {
          setSupportTickets((prev) => {
            const index = prev.findIndex((t) => t.id === msg.data.id);
            if (index >= 0) {
              const clone = [...prev];
              clone[index] = msg.data;
              return clone;
            }
            return [msg.data, ...prev];
          });
        }
      } catch (err) {
        console.warn('Broadcast sync message handling error:', err);
      }
    });

    return () => {
      window.removeEventListener('storage', handleStorage);
      unsubBroadcast();
    };
  }, [user.id]);

  const maxBalanceLimit = getEffectiveBalanceLimit(user);
  const isBalanceCapped = Boolean(
    user.isLoggedIn &&
    user.role !== 'admin' &&
    user.balance >= maxBalanceLimit
  );

  const setSoundEnabled = (val: boolean) => {
    setSoundEnabledState(val);
    sound.enabled = val;
  };

  const setScreen = (newScreen: Screen) => {
    sound.playClick();
    if (newScreen === 'crash' || newScreen === 'apple_of_fortune') {
      setIsHackerEnabled(false);
    }
    setScreenState(newScreen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const updateAdminSettings = (newSettings: Partial<AdminSettings>) => {
    const updated = { ...adminSettings, ...newSettings };
    setAdminSettings(updated);
    try {
      localStorage.setItem('app_admin_settings', JSON.stringify(updated));
    } catch {}
    fbSaveSettings(updated);
    broadcastSync('SETTINGS_UPDATED', updated);
    showToast('تم حفظ إعدادات وأرقام المنصة بنجاح ومزامنتها على السيرفر ✅', 'success');
  };

  const login = (identifier: string, _pass: string) => {
    sound.playClick();
    const dev = detectDeviceInfo();
    const safeDevKey = dev.deviceId.replace(/[.#$[\]]/g, '_');

    // 1. Check if device is banned
    if (isDeviceBanned || bannedDevicesMap[safeDevKey] || bannedDevicesMap[dev.deviceId]) {
      setIsDeviceBanned(true);
      try {
        localStorage.setItem('app_device_banned', 'true');
      } catch {}
      showToast('🚫 هذا الجهاز محظور نهائياً من دخول المنصة بواسطة إدارة النظام!', 'error');
      return false;
    }

    const trimmed = identifier.trim();
    const safePhone = trimmed.replace(/[^0-9]/g, '');

    // 2. Check if user identifier is banned
    if (
      bannedUsersMap[trimmed] ||
      (safePhone && bannedUsersMap[safePhone])
    ) {
      showToast('🚫 هذا الحساب محظور نهائياً من دخول المنصة بواسطة إدارة النظام!', 'error');
      return false;
    }

    const existing = allUsers.find(
      (u) => u.phone === trimmed || u.id === trimmed || u.username === trimmed
    );

    if (existing) {
      if (existing.isBanned || bannedUsersMap[existing.id] || (existing.phone && bannedUsersMap[existing.phone.replace(/[^0-9]/g, '')])) {
        showToast('🚫 هذا الحساب محظور نهائياً من دخول المنصة بواسطة إدارة النظام!', 'error');
        return false;
      }

      const loggedUser: UserAccount = {
        ...existing,
        isLoggedIn: true,
        deviceId: dev.deviceId,
        deviceName: dev.deviceName,
        deviceType: dev.deviceType,
        deviceOS: dev.deviceOS,
        deviceBrowser: dev.deviceBrowser,
        screenRes: dev.screenRes,
        lastLoginAt: Date.now(),
        lastActive: Date.now(),
      };
      setUser(loggedUser);
      fbSaveUser(loggedUser);
      try {
        localStorage.setItem('app_user', JSON.stringify(loggedUser));
      } catch {}
      showToast(`أهلاً بعودتك يا ${existing.username} (ID: ${existing.id}) 👋`, 'success');
      setScreenState('lobby');
      return true;
    } else {
      const newId = generate10DigitId();
      const newUserObj: UserAccount = {
        id: newId,
        username: trimmed.startsWith('01') ? 'لاعب_' + trimmed.slice(-4) : trimmed,
        phone: trimmed.startsWith('01') ? trimmed : '010' + Math.floor(10000000 + Math.random() * 90000000),
        email: trimmed.includes('@') ? trimmed : undefined,
        balance: 0.0,
        isLoggedIn: true,
        registeredAt: Date.now(),
        totalDeposited: 0,
        totalWithdrawn: 0,
        role: 'user',
        deviceId: dev.deviceId,
        deviceName: dev.deviceName,
        deviceType: dev.deviceType,
        deviceOS: dev.deviceOS,
        deviceBrowser: dev.deviceBrowser,
        screenRes: dev.screenRes,
        lastLoginAt: Date.now(),
        lastActive: Date.now(),
      };
      const updatedList = [newUserObj, ...allUsers];
      setAllUsers(updatedList);
      setUser(newUserObj);
      fbSaveUser(newUserObj);
      try {
        localStorage.setItem('app_all_users', JSON.stringify(updatedList));
        localStorage.setItem('app_user', JSON.stringify(newUserObj));
        window.dispatchEvent(new Event('storage'));
      } catch {}
      showToast(`تم تسجيل الدخول بنجاح! كود الآي دي (ID) الخاص بك هو: ${newId}`, 'success');
      setScreenState('lobby');
      return true;
    }
  };

  const register = (phone: string, _pass: string) => {
    sound.playClick();
    const dev = detectDeviceInfo();
    const safeDevKey = dev.deviceId.replace(/[.#$[\]]/g, '_');

    // 1. Check if device is banned
    if (isDeviceBanned || bannedDevicesMap[safeDevKey] || bannedDevicesMap[dev.deviceId]) {
      setIsDeviceBanned(true);
      try {
        localStorage.setItem('app_device_banned', 'true');
      } catch {}
      showToast('🚫 هذا الجهاز محظور نهائياً من دخول المنصة بواسطة إدارة النظام!', 'error');
      return false;
    }

    const trimmedPhone = phone.trim();
    const safePhone = trimmedPhone.replace(/[^0-9]/g, '');

    // 2. Check if phone is banned
    if (bannedUsersMap[trimmedPhone] || (safePhone && bannedUsersMap[safePhone])) {
      showToast('🚫 هذا الرقم محظور نهائياً من التسجيل في المنصة بواسطة إدارة النظام!', 'error');
      return false;
    }

    const existing = allUsers.find((u) => u.phone === trimmedPhone);
    if (existing) {
      if (existing.isBanned || bannedUsersMap[existing.id] || (existing.phone && bannedUsersMap[existing.phone.replace(/[^0-9]/g, '')])) {
        showToast('🚫 هذا الحساب محظور نهائياً من دخول المنصة بواسطة إدارة النظام!', 'error');
        return false;
      }
      let currentId = existing.id;
      if (existing.role !== 'admin' && (!currentId || !/^\d{10}$/.test(currentId))) {
        currentId = generate10DigitId();
      }
      const loggedUser: UserAccount = {
        ...existing,
        id: currentId,
        isLoggedIn: true,
        deviceId: dev.deviceId,
        deviceName: dev.deviceName,
        deviceType: dev.deviceType,
        deviceOS: dev.deviceOS,
        deviceBrowser: dev.deviceBrowser,
        screenRes: dev.screenRes,
        lastLoginAt: Date.now(),
        lastActive: Date.now(),
      };
      setUser(loggedUser);
      fbSaveUser(loggedUser);
      try {
        localStorage.setItem('app_user', JSON.stringify(loggedUser));
      } catch {}
      showToast(`هذا الرقم مسجل بالفعل! تم تسجيل دخولك لحسابك (ID: ${currentId}) 👋`, 'success');
      setScreenState('lobby');
      return true;
    }

    const newId = generate10DigitId();
    const newUserObj: UserAccount = {
      id: newId,
      username: 'لاعب_' + trimmedPhone.slice(-4),
      phone: trimmedPhone,
      balance: 0.0,
      isLoggedIn: true,
      registeredAt: Date.now(),
      totalDeposited: 0,
      totalWithdrawn: 0,
      role: 'user',
      deviceId: dev.deviceId,
      deviceName: dev.deviceName,
      deviceType: dev.deviceType,
      deviceOS: dev.deviceOS,
      deviceBrowser: dev.deviceBrowser,
      screenRes: dev.screenRes,
      lastLoginAt: Date.now(),
      lastActive: Date.now(),
    };

    const updatedList = [newUserObj, ...allUsers];
    setAllUsers(updatedList);
    setUser(newUserObj);
    fbSaveUser(newUserObj);
    try {
      localStorage.setItem('app_all_users', JSON.stringify(updatedList));
      localStorage.setItem('app_user', JSON.stringify(newUserObj));
      window.dispatchEvent(new Event('storage'));
    } catch {}

    showToast(`تم إنشاء الحساب بنجاح! كود الآي دي (ID) الخاص بك هو: ${newId}`, 'success');
    setScreenState('lobby');
    return true;
  };

  const logout = () => {
    sound.playClick();
    try {
      localStorage.removeItem('app_user');
    } catch {}
    const guest = createDefaultGuestUser();
    try {
      localStorage.setItem('app_user', JSON.stringify(guest));
    } catch {}
    setUser(guest);
    setScreenState('register');
    showToast('تم تسجيل الخروج بنجاح. يمكنك الآن تسجيل الدخول أو إنشاء حساب جديد', 'info');
  };

  // Permanently delete user and ban their phone and device
  const deleteAndBanUser = async (userId: string, reason: string = 'تم الحظر بواسطة الإدارة'): Promise<boolean> => {
    try {
      const target = allUsers.find((u) => u.id === userId);
      const phone = target?.phone || '';
      const deviceId = target?.deviceId || '';
      const username = target?.username || '';

      // 1. Push ban records to Firebase RTDB
      await fbBanUserAndDevice(userId, phone, deviceId, username, reason);

      // 2. Delete user from Firebase RTDB users collection
      await fbDeleteUser(userId);

      // 3. Update local state
      const updatedUsers = allUsers.filter((u) => u.id !== userId);
      setAllUsers(updatedUsers);
      try {
        localStorage.setItem('app_all_users', JSON.stringify(updatedUsers));
      } catch {}

      // 4. If target is current active user, log them out and ban screen
      if (user.id === userId) {
        setIsDeviceBanned(true);
        try {
          localStorage.setItem('app_device_banned', 'true');
          localStorage.removeItem('app_user');
        } catch {}
        setUser(createDefaultGuestUser());
        setScreenState('register');
      }

      // 5. Broadcast to all open tabs
      broadcastSync('USER_BANNED', { userId, phone, deviceId });

      showToast(`تم حذف المستخدم (ID: ${userId}) وحظر جهازه ورقم هاتفه نهائياً 🚫`, 'success');
      return true;
    } catch (err) {
      console.error('deleteAndBanUser error:', err);
      showToast('حدث خطأ أثناء محاولة حذف وحظر المستخدم', 'error');
      return false;
    }
  };

  // Unban user or device
  const unbanUser = async (identifier: string): Promise<boolean> => {
    try {
      await fbUnban(identifier);
      broadcastSync('USER_UNBANNED', { identifier });
      showToast(`تم رفع الحظر عن (${identifier}) بنجاح ✅`, 'success');
      return true;
    } catch (err) {
      console.error('unbanUser error:', err);
      showToast('حدث خطأ أثناء محاولة فك الحظر', 'error');
      return false;
    }
  };

  // Delete user account only (without banning phone or device)
  const deleteUserOnly = async (userId: string): Promise<boolean> => {
    try {
      await fbDeleteUser(userId);
      const updated = allUsers.filter((u) => u.id !== userId);
      setAllUsers(updated);
      try {
        localStorage.setItem('app_all_users', JSON.stringify(updated));
      } catch {}
      if (user.id === userId) {
        logout();
      }
      showToast(`تم مسح المستخدم (ID: ${userId}) بنجاح 🗑️`, 'success');
      return true;
    } catch (err) {
      console.error('deleteUserOnly error:', err);
      showToast('حدث خطأ أثناء مسح المستخدم', 'error');
      return false;
    }
  };

  // Delete single transaction (deposit or withdraw)
  const deleteTransaction = async (txId: string): Promise<boolean> => {
    try {
      await fbDeleteTransaction(txId);
      const updated = transactions.filter((t) => t.id !== txId);
      setTransactions(updated);
      try {
        localStorage.setItem('app_txs', JSON.stringify(updated));
      } catch {}
      showToast(`تم مسح المعاملة (${txId}) بنجاح 🗑️`, 'success');
      return true;
    } catch (err) {
      console.error('deleteTransaction error:', err);
      showToast('حدث خطأ أثناء مسح المعاملة', 'error');
      return false;
    }
  };

  // Clear all transactions (zero out deposits and withdrawals)
  const clearAllTransactions = async (): Promise<boolean> => {
    try {
      await fbClearAllTransactions();
      setTransactions([]);
      try {
        localStorage.removeItem('app_txs');
      } catch {}
      showToast('تم تصفير ومسح جميع طلبات الإيداع والسحب بنجاح 🧹', 'success');
      return true;
    } catch (err) {
      console.error('clearAllTransactions error:', err);
      showToast('حدث خطأ أثناء تصفير المعاملات', 'error');
      return false;
    }
  };

  // Master Zero Reset: Wipe all platform data to 0 (start completely fresh)
  const resetAllPlatformData = async (): Promise<boolean> => {
    try {
      await fbResetAllPlatformData();
      setTransactions([]);
      setAllUsers([]);
      setSupportTickets([]);
      setBannedUsersMap({});
      setBannedDevicesMap({});
      try {
        localStorage.removeItem('app_txs');
        localStorage.removeItem('app_all_users');
        localStorage.removeItem('app_support_tickets');
        localStorage.removeItem('app_user');
        localStorage.removeItem('app_device_banned');
      } catch {}
      const freshGuest = createDefaultGuestUser();
      try {
        localStorage.setItem('app_user', JSON.stringify(freshGuest));
      } catch {}
      setUser(freshGuest);
      setScreenState('register');
      showToast('تم تصفير جميع بيانات المنصة بالكامل (0 مستخدمين - 0 طلبات). تم البدء من جديد!', 'success');
      return true;
    } catch (err) {
      console.error('resetAllPlatformData error:', err);
      showToast('حدث خطأ أثناء تصفير البيانات', 'error');
      return false;
    }
  };

  // User submits a deposit request -> saved to Firebase and local storage
  const deposit = (
    amount: number,
    method: string,
    senderPhone: string,
    receiptImage?: string,
    referenceCode?: string
  ) => {
    if (amount <= 0) return false;

    // Ensure we have a valid 10-digit user ID attached
    let currentUserId = user.id;
    let currentUserName = user.username;
    let currentUserPhone = user.phone || senderPhone;

    if (!currentUserId || !/^\d{10}$/.test(currentUserId)) {
      currentUserId = generate10DigitId();
      currentUserName = currentUserName || ('لاعب_' + (senderPhone.slice(-4) || currentUserId.slice(-4)));
      currentUserPhone = currentUserPhone || senderPhone;
      const newUserObj: UserAccount = {
        ...user,
        id: currentUserId,
        username: currentUserName,
        phone: currentUserPhone,
      };
      setUser(newUserObj);
      fbSaveUser(newUserObj);
      setAllUsers((prev) => [newUserObj, ...prev.filter((u) => u.id !== currentUserId)]);
      try {
        localStorage.setItem('app_user', JSON.stringify(newUserObj));
      } catch {}
    }

    const newTxId = 'DEP-' + Math.floor(100000 + Math.random() * 900000);
    const isAuto = adminSettings.autoApproveDeposits;

    const newTx: Transaction = {
      id: newTxId,
      userId: currentUserId,
      userName: currentUserName || 'لاعب',
      userPhone: currentUserPhone || senderPhone,
      type: 'deposit',
      amount: Number(amount),
      method: method || 'فودافون كاش',
      senderPhone: senderPhone || '',
      receiptImage: receiptImage || '',
      referenceCode: referenceCode || '',
      status: isAuto ? 'completed' : 'pending',
      timestamp: Date.now(),
    };

    setTransactions((prev) => {
      const updated = [newTx, ...prev];
      try {
        localStorage.setItem('app_txs', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage'));
      } catch {}
      return updated;
    });

    // Save to Firebase RTDB for instant admin notification
    fbSaveTransaction(newTx);
    broadcastSync('NEW_DEPOSIT', newTx);

    if (isAuto) {
      sound.playWin();
      const newLimit = (user.balance || 0) + calculateBalanceLimit(amount);
      const updatedUser: UserAccount = {
        ...user,
        balance: Number((user.balance + amount).toFixed(2)),
        totalDeposited: (user.totalDeposited || 0) + amount,
        lastDepositAmount: amount,
        maxBalanceLimit: newLimit,
      };
      setUser(updatedUser);
      fbSaveUser(updatedUser);
      setAllUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      );
      showToast(`تم إيداع ${amount.toFixed(2)} ج.م بنجاح في حسابك! تم رفع حد أقصى الرصيد إلى ${newLimit.toLocaleString('ar-EG')} ج.م`, 'success');
    } else {
      sound.playClick();
      showToast(
        `تم إرسال طلب الإيداع بقيمة ${amount.toFixed(2)} ج.م بنجاح ومزامنته مع الإدارة للمراجعة وإضافة الرصيد فوراً.`,
        'info'
      );
    }
    return true;
  };

  // Admin approves a deposit
  const approveDeposit = (txId: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx || tx.status !== 'pending') return;

    sound.playWin();

    // 1. Update Transaction status in React state and Firebase
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, status: 'completed' } : t))
    );
    fbUpdateTransactionStatus(txId, 'completed');

    // 2. Add money to that specific user
    const targetUser = allUsers.find((u) => u.id === tx.userId);
    let finalBal = 0;
    if (targetUser) {
      const newBal = Number((targetUser.balance + tx.amount).toFixed(2));
      finalBal = newBal;
      const newTotalDep = (targetUser.totalDeposited || 0) + tx.amount;
      const newLimit = (targetUser.balance || 0) + calculateBalanceLimit(tx.amount);
      const updatedTargetUser: UserAccount = {
        ...targetUser,
        balance: newBal,
        totalDeposited: newTotalDep,
        lastDepositAmount: tx.amount,
        maxBalanceLimit: newLimit,
      };

      setAllUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === tx.userId ? updatedTargetUser : u))
      );
      fbSaveUser(updatedTargetUser);
    }

    // 3. If currently logged-in user matches, update their active balance immediately
    if (user.id === tx.userId) {
      const newLimit = (user.balance || 0) + calculateBalanceLimit(tx.amount);
      const updatedActiveUser: UserAccount = {
        ...user,
        balance: Number((user.balance + tx.amount).toFixed(2)),
        totalDeposited: (user.totalDeposited || 0) + tx.amount,
        lastDepositAmount: tx.amount,
        maxBalanceLimit: newLimit,
      };
      finalBal = updatedActiveUser.balance;
      setUser(updatedActiveUser);
      fbSaveUser(updatedActiveUser);
    }

    broadcastSync('DEPOSIT_APPROVED', { txId, userId: tx.userId, newBalance: finalBal, amount: tx.amount });
    showToast(`✅ تم قبول الإيداع بنجاح وتمت إضافة ${tx.amount} ج.م تلقائياً لحساب اللاعب (ID: ${tx.userId})`, 'success');
  };

  // Admin rejects a deposit
  const rejectDeposit = (txId: string, reason?: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx || tx.status !== 'pending') return;

    sound.playCrash();

    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, status: 'rejected', note: reason || 'تم رفض الإيداع من قبل الإدارة' } : t))
    );
    fbUpdateTransactionStatus(txId, 'rejected', reason || 'تم رفض الإيداع من قبل الإدارة');
    broadcastSync('DEPOSIT_REJECTED', { txId, userId: tx.userId, reason });

    showToast(`❌ تم رفض طلب الإيداع (ID: ${tx.userId})`, 'info');
  };

  // Admin approves withdrawal
  const approveWithdraw = (txId: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx || tx.status !== 'pending') return;

    sound.playClick();
    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, status: 'completed' } : t))
    );
    fbUpdateTransactionStatus(txId, 'completed');

    // Update user totalWithdrawn
    const targetUser = allUsers.find((u) => u.id === tx.userId);
    if (targetUser) {
      const updated = {
        ...targetUser,
        totalWithdrawn: (targetUser.totalWithdrawn || 0) + tx.amount,
      };
      fbSaveUser(updated);
    }

    broadcastSync('WITHDRAW_APPROVED', { txId, userId: tx.userId });
    showToast(`✅ تم تأكيد إرسال مبلغ السحب ${tx.amount} ج.م للاعب (ID: ${tx.userId})`, 'success');
  };

  // Admin rejects withdrawal & refunds user balance
  const rejectWithdraw = (txId: string, reason?: string) => {
    const tx = transactions.find((t) => t.id === txId);
    if (!tx || tx.status !== 'pending') return;

    sound.playCrash();

    let refundedBal = 0;
    // Refund balance
    const targetUser = allUsers.find((u) => u.id === tx.userId);
    if (targetUser) {
      const refunded = { ...targetUser, balance: Number((targetUser.balance + tx.amount).toFixed(2)) };
      refundedBal = refunded.balance;
      setAllUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === tx.userId ? refunded : u))
      );
      fbSaveUser(refunded);
    }

    if (user.id === tx.userId) {
      const refundedActive = {
        ...user,
        balance: Number((user.balance + tx.amount).toFixed(2)),
      };
      refundedBal = refundedActive.balance;
      setUser(refundedActive);
      fbSaveUser(refundedActive);
    }

    setTransactions((prev) =>
      prev.map((t) => (t.id === txId ? { ...t, status: 'rejected', note: reason || 'تم رفض السحب وإرجاع المبلغ للرصيد' } : t))
    );
    fbUpdateTransactionStatus(txId, 'rejected', reason || 'تم رفض السحب وإرجاع المبلغ للرصيد');
    broadcastSync('WITHDRAW_REJECTED', { txId, userId: tx.userId, newBalance: refundedBal });

    showToast(`تم رفض طلب السحب وإرجاع مبلغ ${tx.amount} ج.م لرصيد اللاعب.`, 'info');
  };

  // Admin directly credits balance by User ID
  const addBalanceByUserId = (userId: string, amount: number, note?: string) => {
    const trimmedId = userId.trim();
    const targetUser = allUsers.find((u) => u.id === trimmedId || u.phone === trimmedId);

    if (!targetUser) {
      showToast(`عفواً، لم يتم العثور على لاعب بالـ ID أو رقم الهاتف: ${trimmedId}`, 'error');
      return { success: false, message: 'مستخدم غير موجود' };
    }

    sound.playWin();

    const updatedBal = Number(Math.max(0, targetUser.balance + amount).toFixed(2));
    const newLimit = (targetUser.balance || 0) + calculateBalanceLimit(amount);
    const updatedUserObj: UserAccount = {
      ...targetUser,
      balance: updatedBal,
      totalDeposited: amount > 0 ? (targetUser.totalDeposited || 0) + amount : targetUser.totalDeposited,
      lastDepositAmount: amount > 0 ? amount : targetUser.lastDepositAmount,
      maxBalanceLimit: amount > 0 ? newLimit : targetUser.maxBalanceLimit,
    };

    setAllUsers((prevUsers) =>
      prevUsers.map((u) => (u.id === targetUser.id ? updatedUserObj : u))
    );
    fbSaveUser(updatedUserObj);

    if (user.id === targetUser.id) {
      setUser(updatedUserObj);
    }

    const newTx: Transaction = {
      id: 'ADM-' + Math.floor(100000 + Math.random() * 900000),
      userId: targetUser.id,
      userName: targetUser.username,
      userPhone: targetUser.phone,
      type: 'admin_adjustment',
      amount: Math.abs(amount),
      method: amount >= 0 ? 'إضافة رصيد من الإدارة' : 'خصم رصيد من الإدارة',
      status: 'completed',
      timestamp: Date.now(),
      note: note || 'شحن رصيد مباشر من لوحة التحكم',
    };
    setTransactions((prev) => [newTx, ...prev]);
    fbSaveTransaction(newTx);
    broadcastSync('DIRECT_TOPUP', { userId: targetUser.id, newBalance: updatedBal, amount });

    showToast(
      `تمت إضافة ${amount} ج.م بنجاح للاعب: ${targetUser.username} (ID: ${targetUser.id})!`,
      'success'
    );
    return { success: true, message: 'تم الشحن بنجاح' };
  };

  // Admin updates player Instagram handle
  const updateUserInstagram = async (userId: string, instagram: string): Promise<boolean> => {
    const trimmedId = userId.trim();
    const targetUser = allUsers.find((u) => u.id === trimmedId || u.phone === trimmedId);
    if (!targetUser) {
      showToast(`لم يتم العثور على اللاعب برقم: ${trimmedId}`, 'error');
      return false;
    }
    const cleanInsta = instagram.trim();
    const updatedUserObj = {
      ...targetUser,
      instagram: cleanInsta,
    };
    setAllUsers((prevUsers) =>
      prevUsers.map((u) => (u.id === targetUser.id ? updatedUserObj : u))
    );
    fbSaveUser(updatedUserObj);
    if (user.id === targetUser.id) {
      const updatedActive = { ...user, instagram: cleanInsta };
      setUser(updatedActive);
      try {
        localStorage.setItem('app_user', JSON.stringify(updatedActive));
      } catch {}
    }
    try {
      const saved = JSON.parse(localStorage.getItem('app_all_users') || '[]');
      const updatedList = saved.map((u: UserAccount) => (u.id === targetUser.id ? updatedUserObj : u));
      localStorage.setItem('app_all_users', JSON.stringify(updatedList));
    } catch {}
    broadcastSync('USER_UPDATED', updatedUserObj);
    showToast(`تم تحديث حساب إنستجرام للاعب #${targetUser.id} (${cleanInsta || 'تم الإلغاء'}) ✅`, 'success');
    return true;
  };

  const withdraw = (amount: number, walletNumber: string) => {
    if (user.role !== 'admin' && isBalanceCapped) {
      sound.playCrash();
      const msg = `لقد وصلت إلى الحد النهائي من الفلوس (${maxBalanceLimit.toLocaleString('ar-EG')} ج.م). يجب عمل إيداع جديد لتفعيل السحب ومواصلة اللعب!`;
      showToast(msg, 'error');
      return { success: false, error: msg };
    }
    if (amount < adminSettings.minWithdraw) {
      sound.playCrash();
      showToast(`الحد الأدنى للسحب هو ${adminSettings.minWithdraw} جنيه`, 'error');
      return { success: false, error: `الحد الأدنى للسحب هو ${adminSettings.minWithdraw} جنيه` };
    }
    if (amount > user.balance) {
      sound.playCrash();
      showToast('رصيدك الحالي غير كافٍ لإتمام السحب', 'error');
      return { success: false, error: 'رصيد غير كافٍ' };
    }
    sound.playClick();

    // Ensure user has valid 10-digit ID
    let currentUserId = user.id;
    let currentUserName = user.username;
    let currentUserPhone = user.phone;

    if (!currentUserId || !/^\d{10}$/.test(currentUserId)) {
      currentUserId = generate10DigitId();
      currentUserName = currentUserName || ('لاعب_' + currentUserId.slice(-4));
      const newUserObj: UserAccount = {
        ...user,
        id: currentUserId,
        username: currentUserName,
      };
      setUser(newUserObj);
      fbSaveUser(newUserObj);
      setAllUsers((prev) => [newUserObj, ...prev.filter((u) => u.id !== currentUserId)]);
      try {
        localStorage.setItem('app_user', JSON.stringify(newUserObj));
      } catch {}
    }

    const updatedUser = {
      ...user,
      id: currentUserId,
      username: currentUserName,
      balance: Number((user.balance - amount).toFixed(2)),
    };
    setUser(updatedUser);
    fbSaveUser(updatedUser);

    const newTx: Transaction = {
      id: 'WTH-' + Math.floor(100000 + Math.random() * 900000),
      userId: currentUserId,
      userName: currentUserName,
      userPhone: currentUserPhone,
      type: 'withdraw',
      amount,
      phone: walletNumber,
      status: 'pending',
      timestamp: Date.now(),
    };
    setTransactions((prev) => [newTx, ...prev]);
    fbSaveTransaction(newTx);
    broadcastSync('NEW_WITHDRAW', newTx);

    showToast(`تم إرسال طلب سحب بقيمة ${amount.toFixed(2)} ج.م بنجاح ومزامنته مع الإدارة.`, 'success');
    return { success: true };
  };

  const placeBet = (amount: number, _game: string): boolean => {
    if (user.role !== 'admin' && isBalanceCapped) {
      sound.playCrash();
      showToast(
        `لقد وصلت إلى الحد النهائي من الفلوس (${maxBalanceLimit.toLocaleString('ar-EG')} ج.م)! يجب عمل إيداع جديد لمواصلة اللعب والسحب.`,
        'error'
      );
      return false;
    }
    if (amount <= 0) {
      showToast('يرجى إدخال مبلغ رهان صالح', 'error');
      return false;
    }
    if (amount > user.balance) {
      sound.playCrash();
      showToast('رصيدك غير كافٍ! يرجى شحن الحساب', 'error');
      return false;
    }
    sound.playClick();
    const updatedUser = {
      ...user,
      balance: Number(Math.max(0, user.balance - amount).toFixed(2)),
    };
    setUser(updatedUser);
    fbSaveUser(updatedUser);
    return true;
  };

  const winBet = (amount: number, multiplier: number, game: string) => {
    sound.playWin();
    const winAmount = Number((amount * multiplier).toFixed(2));
    const updatedUser = {
      ...user,
      balance: Number((user.balance + winAmount).toFixed(2)),
    };
    setUser(updatedUser);
    fbSaveUser(updatedUser);

    const newTx: Transaction = {
      id: 'WIN-' + Math.floor(100000 + Math.random() * 900000),
      userId: user.id,
      userName: user.username,
      userPhone: user.phone,
      type: 'win',
      amount: winAmount,
      game,
      multiplier,
      status: 'completed',
      timestamp: Date.now(),
    };
    setTransactions((prev) => [newTx, ...prev]);
    fbSaveTransaction(newTx);

    showToast(`مبروك! ربحت ${winAmount.toFixed(2)} ج.م بنسبة (${multiplier.toFixed(2)}x)! 🎉`, 'success');
  };

  // Support Ticket / Chat Actions (Each user has a dedicated chat thread)
  const createSupportTicket = async (subject: string, messageText: string): Promise<string> => {
    // If user already has an active or previous chat thread, reuse it
    const existing = supportTickets.find(
      (t) => t.userId === user.id || (user.phone && t.userPhone === user.phone)
    );
    if (existing) {
      await sendSupportMessage(existing.id, messageText);
      return existing.id;
    }

    const ticketId = 'CHAT-' + (user.id || Math.floor(100000 + Math.random() * 900000));
    const initialMsg: SupportMessage = {
      id: 'MSG-' + Math.floor(100000 + Math.random() * 900000),
      sender: 'user',
      senderName: user.username || 'اللاعب',
      text: messageText.trim(),
      timestamp: Date.now(),
    };

    const newTicket: SupportTicket = {
      id: ticketId,
      userId: user.id || 'N/A',
      userName: user.username || 'لاعب',
      userPhone: user.phone || 'N/A',
      subject: subject.trim() || 'محادثة دعم فني مباشر',
      messages: [initialMsg],
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setSupportTickets((prev) => [newTicket, ...prev]);
    await fbSaveSupportTicket(newTicket);

    showToast('تم إرسال رسالتك للدعم الفني بنجاح! سيتم الرد عليك في أقرب وقت ✅', 'success');
    return ticketId;
  };

  const sendSupportMessage = async (
    ticketId: string,
    text: string,
    senderRole: 'user' | 'admin' = 'user',
    senderName?: string,
    imageUrl?: string,
    depositRefId?: string
  ): Promise<void> => {
    const msg: SupportMessage = {
      id: 'MSG-' + Math.floor(100000 + Math.random() * 900000),
      sender: senderRole,
      senderName: senderName || (senderRole === 'admin' ? 'إدارة المنصة (الدعم الفني)' : (user.username || 'اللاعب')),
      text: text.trim(),
      timestamp: Date.now(),
      image: imageUrl,
      depositRefId: depositRefId,
    };

    setSupportTickets((prev) =>
      prev.map((t) =>
        t.id === ticketId
          ? {
              ...t,
              messages: [...(t.messages || []), msg],
              status: 'open',
              updatedAt: Date.now(),
            }
          : t
      )
    );

    await fbAddSupportMessage(ticketId, msg);
  };

  const getOrCreateTicketForUser = async (
    targetUserId: string,
    targetUserName?: string,
    targetUserPhone?: string,
    subject?: string
  ): Promise<string> => {
    const existing = supportTickets.find(
      (t) => t.userId === targetUserId || (Boolean(targetUserPhone) && t.userPhone === targetUserPhone)
    );
    if (existing) {
      return existing.id;
    }

    const ticketId = 'CHAT-' + targetUserId;
    const initialMsg: SupportMessage = {
      id: 'MSG-' + Math.floor(100000 + Math.random() * 900000),
      sender: 'admin',
      senderName: 'إدارة المنصة (الدعم الفني)',
      text: 'مرحباً بك! تم تخصيص محادثة دعم فني مباشرة لحسابك برقم المعرف ' + targetUserId + '. يسعدنا الرد على أي استفسار أو مساعدة في عمليات الإيداع والسحب.',
      timestamp: Date.now(),
    };

    const newTicket: SupportTicket = {
      id: ticketId,
      userId: targetUserId,
      userName: targetUserName || ('لاعب_' + targetUserId.slice(-4)),
      userPhone: targetUserPhone || 'N/A',
      subject: subject || `محادثة دعم فني مخصصة للاعب (${targetUserId})`,
      messages: [initialMsg],
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setSupportTickets((prev) => [newTicket, ...prev.filter((t) => t.id !== ticketId)]);
    await fbSaveSupportTicket(newTicket);
    return ticketId;
  };

  const resolveSupportTicket = async (ticketId: string): Promise<void> => {
    setSupportTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: 'resolved', updatedAt: Date.now() } : t))
    );
    const target = supportTickets.find((t) => t.id === ticketId);
    if (target) {
      await fbSaveSupportTicket({ ...target, status: 'resolved', updatedAt: Date.now() });
    }
  };

  return (
    <AppContext.Provider
      value={{
        screen,
        setScreen,
        user,
        setUser,
        allUsers,
        adminSettings,
        updateAdminSettings,
        login,
        register,
        logout,
        selectedDepositMethod,
        setSelectedDepositMethod,
        deposit,
        withdraw,
        placeBet,
        winBet,
        transactions,
        approveDeposit,
        rejectDeposit,
        approveWithdraw,
        rejectWithdraw,
        addBalanceByUserId,
        updateUserInstagram,
        deleteAndBanUser,
        deleteUserOnly,
        deleteTransaction,
        clearAllTransactions,
        resetAllPlatformData,
        unbanUser,
        isDeviceBanned,
        supportTickets,
        createSupportTicket,
        sendSupportMessage,
        getOrCreateTicketForUser,
        resolveSupportTicket,
        isSupportOpen,
        setIsSupportOpen,
        connectedDevices,
        toasts,
        showToast,
        soundEnabled,
        setSoundEnabled,
        isHackerEnabled,
        setIsHackerEnabled,
        maxBalanceLimit,
        isBalanceCapped,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};

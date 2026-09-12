// Device detection & fingerprinting utility for 1X WINNER platform

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  deviceOS: string;
  deviceBrowser: string;
  screenRes: string;
  language: string;
  platform: string;
  userId?: string;
  username?: string;
  phone?: string;
  balance?: number;
  isOnline?: boolean;
  lastSeen?: number;
  connectedAt?: number;
}

// Generate or retrieve persistent unique device ID
export function getPersistentDeviceId(): string {
  try {
    const existing = localStorage.getItem('app_device_id');
    if (existing && existing.length > 5) return existing;

    // Check cookie fallback
    const cookieMatch = document.cookie.match(/app_device_id=([^;]+)/);
    if (cookieMatch && cookieMatch[1]) {
      localStorage.setItem('app_device_id', cookieMatch[1]);
      return cookieMatch[1];
    }

    // Generate deterministic + random hash
    const canvasFingerprint = getCanvasFingerprint();
    const entropy = [
      navigator.userAgent,
      navigator.language,
      window.screen.width,
      window.screen.height,
      window.screen.colorDepth,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvasFingerprint,
      Date.now(),
      Math.random(),
    ].join('###');

    let hash = 0;
    for (let i = 0; i < entropy.length; i++) {
      hash = (hash << 5) - hash + entropy.charCodeAt(i);
      hash |= 0;
    }

    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newId = `DEV-${Math.abs(hash).toString(36).toUpperCase().padStart(6, '0')}-${randomSuffix}`;

    localStorage.setItem('app_device_id', newId);
    document.cookie = `app_device_id=${newId}; path=/; max-age=315360000; SameSite=Lax`;
    return newId;
  } catch {
    return `DEV-${Math.floor(100000 + Math.random() * 900000)}`;
  }
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'nocanvas';
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(10, 5, 60, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('1X-DEV-FP', 12, 8);
    return canvas.toDataURL().slice(-30);
  } catch {
    return 'canvaserr';
  }
}

// Detect human-readable device name, OS, and browser
export function detectDeviceInfo(user?: any): DeviceInfo {
  const ua = navigator.userAgent || '';
  const deviceId = getPersistentDeviceId();
  const now = Date.now();

  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  let deviceOS = 'غير معروف (Unknown)';
  let deviceName = 'جهاز كمبيوتر (Desktop PC)';
  let deviceBrowser = 'متصفح ويب (Web Browser)';

  // 1. Detect Device Type
  const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk)/i.test(ua);
  const isMobile = /mobile|iphone|ipod|android|blackberry|opera mini|opera mobi|skyfire|maemo|windows phone|palm|iemobile|symbian|symbianos|fennec/i.test(ua);

  if (isTablet) {
    deviceType = 'tablet';
  } else if (isMobile) {
    deviceType = 'mobile';
  } else {
    deviceType = 'desktop';
  }

  // 2. Detect Detailed OS & Exact Device Model
  if (/iPhone/i.test(ua)) {
    deviceType = 'mobile';
    deviceOS = 'iOS';
    const matchVer = ua.match(/OS (\d+[_.]\d+)/i);
    if (matchVer) deviceOS = `iOS ${matchVer[1].replace('_', '.')}`;

    // Guess iPhone model by screen dimensions
    const w = Math.min(window.screen.width, window.screen.height);
    const h = Math.max(window.screen.width, window.screen.height);
    const r = window.devicePixelRatio || 1;

    if (w === 430 && h === 932) deviceName = 'iPhone 15 Pro Max / 14 Pro Max';
    else if (w === 393 && h === 852) deviceName = 'iPhone 15 / 15 Pro / 14 Pro';
    else if (w === 390 && h === 844) deviceName = 'iPhone 14 / 13 / 13 Pro / 12';
    else if (w === 414 && h === 896) deviceName = 'iPhone 11 / XR / XS Max';
    else if (w === 375 && h === 812) deviceName = 'iPhone 13 mini / 12 mini / X';
    else if (w === 375 && h === 667) deviceName = 'iPhone SE / 8 / 7';
    else deviceName = `Apple iPhone (${w}x${h})`;
  } else if (/iPad/i.test(ua)) {
    deviceType = 'tablet';
    deviceOS = 'iPadOS';
    const matchVer = ua.match(/OS (\d+[_.]\d+)/i);
    if (matchVer) deviceOS = `iPadOS ${matchVer[1].replace('_', '.')}`;
    deviceName = 'Apple iPad Tablet';
  } else if (/Android/i.test(ua)) {
    const matchVer = ua.match(/Android\s+([0-9.]+)/i);
    deviceOS = matchVer ? `Android ${matchVer[1]}` : 'Android OS';

    // Try to extract Android manufacturer/model
    // e.g. "Mozilla/5.0 (Linux; Android 14; SM-S928B Build/...) ..."
    const modelMatch = ua.match(/;\s*([^;]+?)\s*Build/i) || ua.match(/Android[^;]+;\s*([^)]+)\)/i);
    if (modelMatch && modelMatch[1]) {
      const rawModel = modelMatch[1].trim();
      if (/SM-/i.test(rawModel)) {
        deviceName = `سامسونج جالكسي (${rawModel})`;
      } else if (/Redmi|Mi\s|Xiaomi/i.test(rawModel)) {
        deviceName = `شاومي ريـدمي (${rawModel})`;
      } else if (/POCO/i.test(rawModel)) {
        deviceName = `بوكو (${rawModel})`;
      } else if (/Pixel/i.test(rawModel)) {
        deviceName = `جوجل بكسل (${rawModel})`;
      } else if (/Oppo|CPH/i.test(rawModel)) {
        deviceName = `أوبو (${rawModel})`;
      } else if (/Vivo/i.test(rawModel)) {
        deviceName = `فيفو (${rawModel})`;
      } else if (/Realme/i.test(rawModel)) {
        deviceName = `ريلمي (${rawModel})`;
      } else if (/Huawei|HONOR/i.test(rawModel)) {
        deviceName = `هواوي / هونر (${rawModel})`;
      } else {
        deviceName = `هاتف أندرويد (${rawModel})`;
      }
    } else {
      deviceName = isTablet ? 'تابلت أندرويد (Android Tablet)' : 'هاتف أندرويد (Android Phone)';
    }
  } else if (/Windows NT 10.0/i.test(ua)) {
    deviceOS = 'Windows 10 / 11';
    deviceName = 'كمبيوتر شخصي (Windows PC)';
  } else if (/Windows NT/i.test(ua)) {
    deviceOS = 'Windows';
    deviceName = 'كمبيوتر شخصي (Windows PC)';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    deviceOS = 'macOS';
    const matchVer = ua.match(/Mac OS X (\d+[._]\d+)/i);
    if (matchVer) deviceOS = `macOS ${matchVer[1].replace('_', '.')}`;
    deviceName = 'كمبيوتر أبل (MacBook / Mac)';
  } else if (/Linux/i.test(ua)) {
    deviceOS = 'Linux';
    deviceName = 'كمبيوتر لينكس (Linux PC)';
  }

  // 3. Detect Browser
  if (/Edg\//i.test(ua)) {
    const v = ua.match(/Edg\/([0-9.]+)/i);
    deviceBrowser = `Microsoft Edge ${v ? v[1].split('.')[0] : ''}`;
  } else if (/Chrome\//i.test(ua) && !/OPR\/|Edg\//i.test(ua)) {
    const v = ua.match(/Chrome\/([0-9.]+)/i);
    deviceBrowser = `Google Chrome ${v ? v[1].split('.')[0] : ''}`;
  } else if (/Firefox\//i.test(ua)) {
    const v = ua.match(/Firefox\/([0-9.]+)/i);
    deviceBrowser = `Mozilla Firefox ${v ? v[1].split('.')[0] : ''}`;
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) {
    const v = ua.match(/Version\/([0-9.]+)/i);
    deviceBrowser = `Apple Safari ${v ? v[1].split('.')[0] : ''}`;
  } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    deviceBrowser = 'Opera Browser';
  } else if (/SamsungBrowser/i.test(ua)) {
    deviceBrowser = 'Samsung Internet';
  }

  const screenRes = `${window.screen.width} × ${window.screen.height} (${window.devicePixelRatio || 1}x)`;

  return {
    deviceId,
    deviceName,
    deviceType,
    deviceOS,
    deviceBrowser,
    screenRes,
    language: navigator.language || 'ar',
    platform: navigator.platform || '',
    userId: user?.id,
    username: user?.username,
    phone: user?.phone,
    balance: user?.balance,
    isOnline: true,
    lastSeen: now,
    connectedAt: now,
  };
}

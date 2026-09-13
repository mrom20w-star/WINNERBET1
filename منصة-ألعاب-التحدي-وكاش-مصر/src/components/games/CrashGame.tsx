import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ArrowLeft,
  Plus,
  ShieldCheck,
  Zap,
  Flame,
  Award,
  TrendingUp,
  History,
  Users,
  Trophy,
  RotateCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { sound } from '../../utils/sound';
import confetti from 'canvas-confetti';

interface LivePlayerBet {
  id: string;
  name: string;
  avatarBg: string;
  initials: string;
  badge?: string;
  vipLevel?: string;
  bet: number;
  targetOdds: number;
  cashedOut: boolean;
  cashedOdds?: number;
  winAmount?: number;
}

interface UserBetRecord {
  id: string;
  roundId: string;
  bet: number;
  cashedOdds?: number;
  won: boolean;
  winAmount: number;
  crashPoint: number;
  timestamp: number;
}

// Realistic Egyptian & Arabic player pool with diverse ranks and styles
const REALISTIC_PLAYERS_POOL = [
  { name: 'كابتن محمود الباشا', bg: 'from-amber-600 via-yellow-500 to-orange-600', initials: 'م.ب', badge: '👑 VIP ماسي', vipLevel: 'VIP' },
  { name: 'أحمد السعدني', bg: 'from-blue-600 via-indigo-500 to-cyan-500', initials: 'أ.س', badge: '🔥 قناص', vipLevel: 'PRO' },
  { name: 'البرنس إبراهيم', bg: 'from-purple-600 via-fuchsia-500 to-pink-500', initials: 'إ.ب', badge: '💎 ملياردير', vipLevel: 'VIP' },
  { name: 'عمر الشريف الإسكندراني', bg: 'from-emerald-600 via-teal-500 to-cyan-600', initials: 'ع.ش', badge: '⚡ أسطورة' },
  { name: 'علي الكينج', bg: 'from-red-600 via-rose-500 to-amber-600', initials: 'ع.ك', badge: '👑 VIP ذهبي', vipLevel: 'VIP' },
  { name: 'محمد حسام التوربو', bg: 'from-indigo-600 via-blue-500 to-sky-500', initials: 'م.ح', badge: '🚀 طيار محترف' },
  { name: 'يوسف العنتيل', bg: 'from-yellow-600 via-amber-500 to-orange-600', initials: 'ي.ع', badge: '🎯 صياد مضاعفات' },
  { name: 'إسلام كاش فودافون', bg: 'from-green-600 via-emerald-500 to-teal-600', initials: 'إ.ك', badge: '💰 رهان عالي' },
  { name: 'فارس الصعيد', bg: 'from-cyan-600 via-blue-600 to-indigo-600', initials: 'ف.ص', badge: '⚡ سريع' },
  { name: 'طارق الوحش', bg: 'from-orange-600 via-red-500 to-rose-600', initials: 'ط.و', badge: '🔥 مجازف' },
  { name: 'كريم البرنس', bg: 'from-rose-600 via-pink-500 to-purple-600', initials: 'ك.ب', badge: '⭐ نجم' },
  { name: 'سيف المصري', bg: 'from-violet-600 via-purple-500 to-indigo-600', initials: 'س.م' },
  { name: 'زياد الجوكر', bg: 'from-teal-600 via-emerald-500 to-green-600', initials: 'ز.ج', badge: '🃏 جوكر' },
  { name: 'معتز هيرو', bg: 'from-fuchsia-600 via-purple-600 to-pink-600', initials: 'م.هـ', badge: '👑 VIP' },
  { name: 'حازم الصقر', bg: 'from-amber-700 via-orange-600 to-red-600', initials: 'ح.ص', badge: '🦅 صقر' },
  { name: 'مصطفى النمر', bg: 'from-blue-700 via-sky-600 to-cyan-500', initials: 'م.ن', badge: '🐅 نمر' },
];

// Helper to generate realistic bots per round
const generateBots = (currentCrashPoint: number): LivePlayerBet[] => {
  const betPool = [20, 50, 100, 150, 200, 300, 500, 800, 1000, 1500, 2000, 3000];
  const shuffled = [...REALISTIC_PLAYERS_POOL].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 9 + Math.floor(Math.random() * 4));

  return selected.map((p, idx) => {
    const bet = betPool[Math.floor(Math.random() * betPool.length)];
    // Intelligent cashout point: some cash out early, some wait, some crash
    let targetOdds: number;
    const r = Math.random();
    if (r < 0.70) {
      // 70% of bots aim below the crash point so they realistically win
      targetOdds = 1.10 + Math.random() * Math.max(0.4, (currentCrashPoint - 1.05) * 0.85);
    } else {
      // 30% of bots aim too high and end up crashing
      targetOdds = currentCrashPoint + 0.1 + Math.random() * 4.0;
    }
    return {
      id: `bot_${idx}_${Date.now()}_${Math.random()}`,
      name: p.name,
      avatarBg: p.bg,
      initials: p.initials,
      badge: p.badge,
      vipLevel: p.vipLevel,
      bet,
      targetOdds: Number(Math.max(1.11, targetOdds).toFixed(2)),
      cashedOut: false,
    };
  });
};

export const CrashGame: React.FC = () => {
  const { user, placeBet, winBet, setScreen, showToast, isHackerEnabled, setIsHackerEnabled, isBalanceCapped, maxBalanceLimit } = useApp();

  // Ensure hack is strictly OFF upon entering the game screen
  useEffect(() => {
    setIsHackerEnabled(false);
  }, [setIsHackerEnabled]);

  // Internal Round Identifiers
  const [roundNumber, setRoundNumber] = useState<number>(() => Math.floor(1000 + Math.random() * 9000));
  const [roundId, setRoundId] = useState<string>(() => `CR-${Math.floor(100000 + Math.random() * 900000)}`);

  // Core Game States
  const [gameState, setGameState] = useState<'countdown' | 'flying' | 'crashed'>('countdown');
  const [countdown, setCountdown] = useState<number>(5);
  const [multiplier, setMultiplier] = useState<number>(1.00);
  const [crashPoint, setCrashPoint] = useState<number>(() => generateInternalCrashTarget());
  const [history, setHistory] = useState<number[]>([1.84, 3.42, 1.25, 5.80, 2.10, 1.45, 12.60]);

  // Active Tab below canvas
  const [activeTab, setActiveTab] = useState<'players' | 'mybets' | 'top'>('players');

  // User Bet States
  const [betAmount, setBetAmount] = useState<number>(20);
  const [userBetPlaced, setUserBetPlaced] = useState<boolean>(false);
  const [userCashedOut, setUserCashedOut] = useState<boolean>(false);
  const [lastWinAmount, setLastWinAmount] = useState<number>(0);
  const [lastWinOdds, setLastWinOdds] = useState<number>(0);
  const [autoBetNextRound, setAutoBetNextRound] = useState<boolean>(false);

  // User Bets History
  const [myBetsHistory, setMyBetsHistory] = useState<UserBetRecord[]>(() => {
    try {
      const saved = localStorage.getItem('app_crash_my_bets');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Auto-Cashout States (Player customizable in UI)
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState<boolean>(false);
  const [autoCashoutMultiplier, setAutoCashoutMultiplier] = useState<number>(2.00);

  // Live Players
  const [liveBots, setLiveBots] = useState<LivePlayerBet[]>(() => generateBots(crashPoint));

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const planeImgRef = useRef<HTMLImageElement | null>(null);

  // Stability Refs to keep flight loop strictly decoupled from React re-renders
  const userBetPlacedRef = useRef(userBetPlaced);
  userBetPlacedRef.current = userBetPlaced;

  const userCashedOutRef = useRef(userCashedOut);
  userCashedOutRef.current = userCashedOut;

  const autoCashoutEnabledRef = useRef(autoCashoutEnabled);
  autoCashoutEnabledRef.current = autoCashoutEnabled;

  const autoCashoutMultiplierRef = useRef(autoCashoutMultiplier);
  autoCashoutMultiplierRef.current = autoCashoutMultiplier;

  const betAmountRef = useRef(betAmount);
  betAmountRef.current = betAmount;

  const crashPointRef = useRef(crashPoint);
  crashPointRef.current = crashPoint;

  const roundIdRef = useRef(roundId);
  roundIdRef.current = roundId;

  // Preload 3D airplane asset
  useEffect(() => {
    const img = new Image();
    img.src = '/plane.png';
    img.onload = () => {
      planeImgRef.current = img;
    };
  }, []);

  // -----------------------------------------------------------------
  // 100% PRECISE CRASH GENERATOR & FORCED MULTIPLIER SUPPORT
  // Guarantees plane explodes at the exact displayed prediction
  // -----------------------------------------------------------------
  function generateInternalCrashTarget(lastTarget?: number): number {
    // Check if admin has set a forced crash multiplier in localStorage
    try {
      const forced = localStorage.getItem('app_forced_crash_multiplier');
      if (forced) {
        const val = parseFloat(forced);
        if (!isNaN(val) && val >= 1.0) {
          return Number(val.toFixed(2));
        }
      }
    } catch {}

    // Generate high-entropy seed
    const r = Math.random();
    let target = 1.00;

    if (r < 0.10) {
      // 10% Instant Crash / Low: 1.05x - 1.35x
      target = 1.05 + Math.random() * 0.30;
    } else if (r < 0.55) {
      // 45% Standard Range: 1.36x - 2.80x
      target = 1.36 + Math.random() * 1.44;
    } else if (r < 0.80) {
      // 25% Good Range: 2.81x - 6.50x
      target = 2.81 + Math.random() * 3.69;
    } else if (r < 0.94) {
      // 14% High Range: 6.51x - 18.00x
      target = 6.51 + Math.random() * 11.49;
    } else {
      // 6% Moon Flight: 18.01x - 75.00x
      target = 18.01 + Math.random() * 56.99;
    }

    const rounded = Number(target.toFixed(2));

    // Ensure the new game is strictly DIFFERENT from previous game
    if (lastTarget && Math.abs(rounded - lastTarget) < 0.2) {
      return Number((rounded * (1.25 + Math.random() * 0.5)).toFixed(2));
    }

    return rounded;
  }

  // -------------------------------------------------------------
  // START NEXT GAME IMMEDIATELY (Manual trigger or Auto transition)
  // Ensures every new game is 100% different and fresh
  // -------------------------------------------------------------
  const startNextRoundImmediately = () => {
    sound.stopEngineSound();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const nextRoundNum = roundNumber + 1;
    const nextRoundId = `CR-${Math.floor(100000 + Math.random() * 900000)}`;
    const nextTarget = generateInternalCrashTarget(crashPointRef.current);

    setRoundNumber(nextRoundNum);
    setRoundId(nextRoundId);
    setCrashPoint(nextTarget);
    crashPointRef.current = nextTarget;
    setMultiplier(1.00);
    setUserCashedOut(false);
    userCashedOutRef.current = false;
    setLastWinAmount(0);
    setLastWinOdds(0);

    // Populate fresh realistic players for the new round
    setLiveBots(generateBots(nextTarget));

    // Reset or trigger auto bet
    if (autoBetNextRound) {
      if (user.balance >= betAmountRef.current) {
        const ok = placeBet(betAmountRef.current, 'Crash');
        if (ok) {
          setUserBetPlaced(true);
          userBetPlacedRef.current = true;
        }
      } else {
        setAutoBetNextRound(false);
        showToast('الرصيد غير كافٍ للرهان التلقائي', 'error');
        setUserBetPlaced(false);
        userBetPlacedRef.current = false;
      }
    } else {
      setUserBetPlaced(false);
      userBetPlacedRef.current = false;
    }

    setCountdown(5);
    setGameState('countdown');
  };

  // -------------------------------------------------------------
  // CONTINUOUS GAME LOOP
  // -------------------------------------------------------------
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;
    let crashTimer: NodeJS.Timeout;

    if (gameState === 'countdown') {
      sound.stopEngineSound();
      setUserCashedOut(false);

      // Check if admin has set a forced crash multiplier
      let forcedTarget: number | null = null;
      try {
        const forced = localStorage.getItem('app_forced_crash_multiplier');
        if (forced) {
          const val = parseFloat(forced);
          if (!isNaN(val) && val >= 1.0) forcedTarget = Number(val.toFixed(2));
        }
      } catch {}

      if (forcedTarget) {
        setCrashPoint(forcedTarget);
        crashPointRef.current = forcedTarget;
        setLiveBots(generateBots(forcedTarget));
      } else if (!crashPointRef.current || crashPointRef.current <= 1.0) {
        const target = generateInternalCrashTarget();
        setCrashPoint(target);
        crashPointRef.current = target;
        setLiveBots(generateBots(target));
      }

      // Auto-bet if enabled
      if (autoBetNextRound && !userBetPlacedRef.current) {
        if (user.balance >= betAmountRef.current) {
          const ok = placeBet(betAmountRef.current, 'Crash');
          if (ok) {
            setUserBetPlaced(true);
            userBetPlacedRef.current = true;
          }
        } else {
          setAutoBetNextRound(false);
          showToast('الرصيد غير كافٍ للرهان التلقائي', 'error');
        }
      }

      setCountdown(5);
      countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setGameState('flying');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    }

    if (gameState === 'flying') {
      startTimeRef.current = performance.now();
      setMultiplier(1.00);

      const targetCrash = crashPointRef.current;

      const updateFlight = () => {
        const elapsed = (performance.now() - startTimeRef.current) / 1000;
        // Smooth exponential Aviator curve
        let currentM = Number((1.0 + 0.082 * elapsed + 0.046 * Math.pow(elapsed, 2)).toFixed(2));

        // Ensure currentM never exceeds targetCrash before explosion check
        if (currentM >= targetCrash) {
          currentM = targetCrash;
        }

        // CHECK AUTO-CASHOUT (at or below targetCrash)
        if (
          userBetPlacedRef.current &&
          !userCashedOutRef.current &&
          autoCashoutEnabledRef.current &&
          currentM >= autoCashoutMultiplierRef.current
        ) {
          const cashedOdds = autoCashoutMultiplierRef.current;
          const wonAmt = Number((betAmountRef.current * cashedOdds).toFixed(1));
          setUserCashedOut(true);
          userCashedOutRef.current = true;
          setUserBetPlaced(false);
          userBetPlacedRef.current = false;
          setLastWinAmount(wonAmt);
          setLastWinOdds(cashedOdds);

          winBet(betAmountRef.current, cashedOdds, 'Crash');

          // Record in user history
          recordBetHistory(roundIdRef.current, betAmountRef.current, true, cashedOdds, wonAmt, targetCrash);

          confetti({
            particleCount: 80,
            spread: 65,
            origin: { y: 0.55 },
          });
          showToast(`تم السحب التلقائي بنجاح عند ${cashedOdds.toFixed(2)}x! (+${wonAmt} ج.م) 🎯`, 'success');
        }

        // EXACT PREDICTION PLANE EXPLOSION
        // Guarantees plane reaches and displays the exact targetCrash multiplier, never before it
        if (currentM >= targetCrash) {
          setMultiplier(targetCrash);
          sound.stopEngineSound();
          sound.playCrash();
          setGameState('crashed');

          // If user was betting and didn't cash out, record loss
          if (userBetPlacedRef.current && !userCashedOutRef.current) {
            recordBetHistory(roundIdRef.current, betAmountRef.current, false, undefined, 0, targetCrash);
          }

          setUserBetPlaced(false);
          userBetPlacedRef.current = false;
          setHistory((prev) => [targetCrash, ...prev.slice(0, 11)]);
          return;
        }

        setMultiplier(currentM);
        sound.startEngineSound(currentM);

        // Update realistic bot cashouts in real time
        setLiveBots((prev) =>
          prev.map((bot) => {
            if (!bot.cashedOut && currentM >= bot.targetOdds && currentM < targetCrash) {
              return {
                ...bot,
                cashedOut: true,
                cashedOdds: currentM,
                winAmount: Number((bot.bet * currentM).toFixed(1)),
              };
            }
            return bot;
          })
        );

        animationFrameRef.current = requestAnimationFrame(updateFlight);
      };

      animationFrameRef.current = requestAnimationFrame(updateFlight);

      return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        sound.stopEngineSound();
      };
    }

    if (gameState === 'crashed') {
      crashTimer = setTimeout(() => {
        // Automatically start next unique round
        startNextRoundImmediately();
      }, 3000);

      return () => clearTimeout(crashTimer);
    }

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(crashTimer);
      sound.stopEngineSound();
    };
  }, [gameState]);

  // Record into localStorage and state
  const recordBetHistory = (
    rId: string,
    bet: number,
    won: boolean,
    cashedOdds?: number,
    winAmount: number = 0,
    cPoint: number = 0
  ) => {
    const record: UserBetRecord = {
      id: `bet_${Date.now()}_${Math.random()}`,
      roundId: rId,
      bet,
      won,
      cashedOdds,
      winAmount,
      crashPoint: cPoint,
      timestamp: Date.now(),
    };
    setMyBetsHistory((prev) => {
      const updated = [record, ...prev.slice(0, 30)];
      try {
        localStorage.setItem('app_crash_my_bets', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // -------------------------------------------------------------
  // CANVAS DRAWING (Dynamic Grid, Space Stars, Laser Arc, 3D Plane)
  // -------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const drawAirplane = (
      context: CanvasRenderingContext2D,
      x: number,
      y: number,
      angle: number,
      isIdle: boolean = false
    ) => {
      // 1. Draw Jet Exhaust Fire Trail
      context.save();
      context.translate(x, y);
      context.rotate(angle);

      if (!isIdle) {
        // Active flight flame (red/orange thrust)
        const flameLength = 22 + Math.random() * 12;
        const flameGrad = context.createLinearGradient(0, 0, -flameLength, 0);
        flameGrad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
        flameGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.85)');
        flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

        context.beginPath();
        context.moveTo(-8, -4);
        context.lineTo(-flameLength, 0);
        context.lineTo(-8, 4);
        context.fillStyle = flameGrad;
        context.shadowColor = 'rgba(239, 68, 68, 0.85)';
        context.shadowBlur = 12;
        context.fill();
      } else {
        // Idle engine warmth flame before takeoff
        const flameLength = 10 + Math.random() * 4;
        const flameGrad = context.createLinearGradient(0, 0, -flameLength, 0);
        flameGrad.addColorStop(0, 'rgba(239, 68, 68, 0.7)');
        flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

        context.beginPath();
        context.moveTo(-6, -3);
        context.lineTo(-flameLength, 0);
        context.lineTo(-6, 3);
        context.fillStyle = flameGrad;
        context.fill();
      }
      context.restore();

      // 2. Draw Airplane Body
      if (planeImgRef.current && planeImgRef.current.complete) {
        context.save();
        context.translate(x, y);

        const imageBaseAngle = -12 * (Math.PI / 180);
        context.rotate(angle - imageBaseAngle);

        context.shadowColor = 'rgba(239, 68, 68, 0.65)';
        context.shadowBlur = 14;

        const planeWidth = 92;
        const planeHeight = 44;

        context.drawImage(
          planeImgRef.current,
          -planeWidth * 0.5,
          -planeHeight * 0.5,
          planeWidth,
          planeHeight
        );
        context.restore();
        return;
      }

      // Fallback Vector Rendering - Authentic Red Aviator Monoplane
      context.save();
      context.translate(x, y);
      context.rotate(angle);

      // Tail fin
      context.fillStyle = '#dc2626';
      context.beginPath();
      context.moveTo(-28, -2);
      context.lineTo(-34, -14);
      context.lineTo(-24, -14);
      context.lineTo(-18, -2);
      context.closePath();
      context.fill();

      // Fuselage (Red)
      context.fillStyle = '#ef4444';
      context.beginPath();
      context.ellipse(0, 0, 30, 10, 0, 0, Math.PI * 2);
      context.fill();

      // Wing (White/Red racing stripe)
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.moveTo(-4, -2);
      context.lineTo(10, -18);
      context.lineTo(18, -18);
      context.lineTo(8, -2);
      context.closePath();
      context.fill();

      // Cockpit canopy (Cyan glass)
      context.fillStyle = '#38bdf8';
      context.beginPath();
      context.ellipse(4, -4, 8, 4, -0.2, 0, Math.PI * 2);
      context.fill();

      // Nose cone & Propeller
      context.fillStyle = '#111827';
      context.beginPath();
      context.arc(30, 0, 4, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(31, -12);
      context.lineTo(31, 12);
      context.stroke();

      context.restore();
    };

    const render = () => {
      const parentWidth = canvas.parentElement?.clientWidth || 360;
      const width = (canvas.width = parentWidth);
      const height = (canvas.height = 240);

      ctx.clearRect(0, 0, width, height);

      // Deep Space / Dark Cockpit Gradient Background
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(0.5, '#131d36');
      bgGrad.addColorStop(1, '#090d1a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Faint Altitude Lines & Multiplier Marks
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      for (let y = height - 40; y > 20; y -= 45) {
        ctx.beginPath();
        ctx.moveTo(30, y);
        ctx.lineTo(width - 20, y);
        ctx.stroke();
      }
      ctx.restore();

      const startX = 35;
      const startY = height - 35;

      // COUNTDOWN IDLE AIRPLANE ON RUNWAY
      if (gameState === 'countdown') {
        const idleY = startY - 14 + Math.sin(Date.now() / 250) * 1.5;
        // Subtle runway line
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(startX - 10, startY);
        ctx.lineTo(startX + 80, startY);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        drawAirplane(ctx, startX + 35, idleY, -0.12, true);
        animId = requestAnimationFrame(render);
        return;
      }

      if (gameState === 'flying' || gameState === 'crashed') {
        // Precise flight progress: exactly 0.0 at 1.00x and exactly 1.0 at crashPoint
        const span = Math.max(0.05, crashPoint - 1.0);
        const progress = Math.min(1, Math.max(0, (multiplier - 1.0) / span));
        const endX = startX + progress * (width - 95);
        const endY = startY - Math.pow(progress, 0.78) * (height - 75);

        const cpX = startX + (endX - startX) * 0.45;
        const cpY = startY;

        // 1. Shaded area below the arc (Classic Aviator Red Gradient)
        ctx.save();
        const areaGrad = ctx.createLinearGradient(0, endY, 0, startY);
        areaGrad.addColorStop(0, 'rgba(239, 68, 68, 0.28)');
        areaGrad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.lineTo(endX, startY);
        ctx.closePath();
        ctx.fillStyle = areaGrad;
        ctx.fill();
        ctx.restore();

        // 2. Flight Arc Laser Line (Classic Aviator Red Laser Curve)
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(239, 68, 68, 0.85)';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();

        // 3. Glowing Apex Pulse Dot & Explosion Burst
        ctx.save();
        if (gameState === 'crashed') {
          // Dynamic explosion flash at exact target
          ctx.beginPath();
          ctx.arc(endX, endY, 26, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 20;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(endX, endY, 15, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(endX, endY, 7, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(endX, endY, 8, 0, Math.PI * 2);
          ctx.fillStyle = '#f87171';
          ctx.shadowColor = 'rgba(239, 68, 68, 0.95)';
          ctx.shadowBlur = 14;
          ctx.fill();
        }
        ctx.restore();

        // 4. Draw Airplane along tangent
        if (gameState === 'flying') {
          const t = progress;
          const dx = 2 * (1 - t) * (cpX - startX) + 2 * t * (endX - cpX);
          const dy = 2 * (1 - t) * (cpY - startY) + 2 * t * (endY - cpY);
          const angle = Math.atan2(dy, dx);

          drawAirplane(ctx, endX, endY, angle, false);
        }
      }

      if (gameState === 'flying' || gameState === 'crashed') {
        animId = requestAnimationFrame(render);
      }
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [gameState, multiplier, crashPoint]);

  // Bet Handler
  const handlePlaceBet = () => {
    if (userBetPlaced) {
      setUserBetPlaced(false);
      userBetPlacedRef.current = false;
      showToast('تم إلغاء الرهان بنجاح', 'info');
      return;
    }

    if (gameState === 'flying') {
      setAutoBetNextRound(!autoBetNextRound);
      showToast(
        !autoBetNextRound
          ? 'تم تفعيل الرهان للجولة القادمة تلقائياً 🚀'
          : 'تم إلغاء الرهان للجولة القادمة',
        'info'
      );
      return;
    }

    const ok = placeBet(betAmount, 'Crash');
    if (ok) {
      setUserBetPlaced(true);
      userBetPlacedRef.current = true;
      showToast(`تم وضع رهان بقيمة ${betAmount} ج.م في الجولة #${roundNumber}`, 'success');
    }
  };

  // Cashout Handler
  const handleCashOut = () => {
    if (!userBetPlaced || userCashedOut || gameState !== 'flying') return;
    const wonAmt = Number((betAmount * multiplier).toFixed(1));
    setUserCashedOut(true);
    userCashedOutRef.current = true;
    setUserBetPlaced(false);
    userBetPlacedRef.current = false;
    setLastWinAmount(wonAmt);
    setLastWinOdds(multiplier);

    winBet(betAmount, multiplier, 'Crash');

    recordBetHistory(roundIdRef.current, betAmount, true, multiplier, wonAmt, crashPointRef.current);

    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.55 },
    });
    sound.playWin();
    showToast(`🏆 مبروك الفوز! سحبت ${wonAmt} ج.م عند ${multiplier.toFixed(2)}x`, 'success');
  };

  // Calculate live total bets
  const totalBotsBet = liveBots.reduce((sum, b) => sum + b.bet, 0);
  const totalRoundBets = totalBotsBet + (userBetPlaced ? betAmount : 0);

  return (
    <div className="w-full min-h-screen bg-[#0a0f1d] text-white flex flex-col font-['Tajawal',sans-serif] select-none pb-12" dir="rtl">
      {/* Top Header Bar */}
      <div className="w-full px-4 pt-3.5 pb-2.5 bg-[#0f172a]/90 backdrop-blur border-b border-slate-800 flex items-center justify-between">
        {/* Right: Back Arrow and Game Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScreen('lobby')}
            id="crash-back-btn"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white transition cursor-pointer border border-slate-700/60"
            title="العودة للرئيسية"
          >
            <ArrowLeft className="w-5 h-5 rotate-180" />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm sm:text-base text-white tracking-wide">
                Aviator Crash ✈️
              </span>
              <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                جولة #{roundNumber}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">ID: {roundId}</span>
          </div>
        </div>

        {/* Center: Hacker Toggle ("تشغيل الهاك" / "إيقاف الهاك") */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setIsHackerEnabled(!isHackerEnabled);
            }}
            id="crash-hacker-toggle-btn"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm ${
              isHackerEnabled
                ? 'bg-emerald-500/25 border-emerald-400/80 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.4)]'
                : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
            title="تفعيل / إيقاف كاشف الانفجار"
          >
            <span className={`w-2 h-2 rounded-full ${isHackerEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
            <span>{isHackerEnabled ? 'إيقاف الهاك' : 'تشغيل الهاك'}</span>
          </button>
        </div>

        {/* Left: Balance Badge & Add Funds */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScreen('deposit')}
            id="crash-balance-pill"
            className="px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-slate-800 to-slate-900 border border-emerald-500/40 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer shadow-md hover:border-emerald-400"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400 font-black" />
            <span className="font-mono text-emerald-300 font-black">{user.balance.toFixed(2)}</span>
            <span className="text-[11px] text-slate-300">ج.م</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 py-3 flex flex-col gap-3">
        {/* Balance Capped Warning Banner */}
        {isBalanceCapped && (
          <div className="w-full bg-gradient-to-r from-red-950/90 via-amber-950/90 to-red-950/90 border-2 border-amber-500/80 rounded-2xl p-3 sm:p-4 text-center shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2.5 text-right">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 animate-bounce" />
              <div className="flex flex-col">
                <span className="text-sm font-black text-amber-300">
                  لقد وصلت للحد النهائي من الرصيد ({maxBalanceLimit.toLocaleString('ar-EG')} ج.م)!
                </span>
                <span className="text-xs text-slate-200">
                  لا يمكنك الرهان أو السحب حالياً. يرجى شحن الحساب لرفع الحد ومواصلة اللعب والسحب فوراً.
                </span>
              </div>
            </div>
            <button
              onClick={() => setScreen('deposit')}
              id="crash-capped-deposit-btn"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 transition shadow-md active:scale-95 cursor-pointer"
            >
              شحن الحساب الآن 💳
            </button>
          </div>
        )}
        
        {/* PAST ROUNDS MULTIPLIER HISTORY TAPE */}
        <div className="w-full flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none" dir="ltr">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <History className="w-3 h-3 text-amber-400" />
            السجل:
          </span>
          {history.map((h, i) => (
            <div
              key={i}
              className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold shrink-0 border shadow-xs ${
                h >= 10.0
                  ? 'bg-purple-950/80 text-purple-300 border-purple-600/70 shadow-purple-900/40'
                  : h >= 2.0
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/70'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700/60'
              }`}
            >
              {h.toFixed(2)}x
            </div>
          ))}
        </div>

        {/* MAIN FLIGHT STAGE (CANVAS) */}
        <div className="w-full h-64 sm:h-72 rounded-3xl bg-[#0e1628] border border-slate-700/80 relative overflow-hidden flex items-center justify-center shadow-2xl">
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

          {/* COUNTDOWN STATE VIEW (Original Timer Design with Round Predictor) */}
          {gameState === 'countdown' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-4 text-center animate-in fade-in zoom-in-95 pointer-events-none">
              <div className="flex flex-col items-center gap-2.5 bg-[#080d19]/85 backdrop-blur-md px-6 py-4 rounded-3xl border border-amber-500/30 shadow-2xl max-w-sm w-full">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/20 animate-bounce">
                  ✈️
                </div>

                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs text-slate-300 font-bold tracking-wide">
                    استعد لإقلاع الطائرة في الجولة الجديدة
                  </span>
                  <span className="text-4xl sm:text-5xl font-black text-amber-400 font-mono tracking-tight drop-shadow-[0_2px_14px_rgba(251,191,36,0.7)]">
                    {countdown}s
                  </span>
                </div>

                {/* Animated progress bar */}
                <div className="w-48 sm:w-56 h-2 bg-slate-800/90 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${(countdown / 5) * 100}%` }}
                  />
                </div>

                {/* PREDICTION CARD (كاشف نقطة الانفجار قبل بدء الجولة) - يظهر فقط إذا كان الهاك مفعلاً واللاعب لم يراهن بعد */}
                {isHackerEnabled && !userBetPlaced && (
                  <div className="mt-1 w-full flex items-center justify-between px-3.5 py-2 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 shadow-md shadow-emerald-950/60 animate-in fade-in zoom-in-95">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
                      <span className="text-xs font-bold text-slate-200">توقع الانفجار:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-emerald-400 font-mono tracking-wider drop-shadow">
                        {crashPoint.toFixed(2)}x
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-500/40">
                        مؤكد 100%
                      </span>
                    </div>
                  </div>
                )}

                {isHackerEnabled && !userBetPlaced ? (
                  <span className="text-[11px] text-emerald-300 font-bold">
                    الهاك يعمل: ستنفجر الطائرة عند {crashPoint.toFixed(2)}x بالضبط
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    ضع رهانك الآن للمشاركة في الجولة الجديدة ✈️
                  </span>
                )}
              </div>
            </div>
          )}

          {/* FLYING STATE VIEW */}
          {gameState === 'flying' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none">
              {/* Floating Predictor Indicator on Top of Canvas - يظهر فقط إذا كان الهاك مفعلاً واللاعب لم يراهن */}
              {isHackerEnabled && !userBetPlaced && (
                <div className="absolute top-3 inset-x-0 flex justify-center animate-in fade-in">
                  <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-900/85 backdrop-blur-xs border border-emerald-500/50 text-xs font-bold text-slate-200 shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span className="text-slate-300">التوقع المؤكد:</span>
                    <span className="font-mono text-emerald-400 font-black">{crashPoint.toFixed(2)}x</span>
                    <span className="text-[10px] text-slate-400 font-normal">| ستنفجر عنده بالضبط</span>
                  </div>
                </div>
              )}

              <span className="text-5xl sm:text-7xl font-black text-white tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] font-mono">
                {multiplier.toFixed(2)}x
              </span>

              {userBetPlaced && !userCashedOut && (
                <div className="mt-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-black px-4 py-1 rounded-full text-xs font-mono animate-pulse shadow-lg shadow-emerald-950/50">
                  ربحك الآن: {(betAmount * multiplier).toFixed(1)} ج.م
                </div>
              )}

              {userCashedOut && (
                <div className="mt-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black px-4 py-1.5 rounded-full text-xs font-mono shadow-xl border border-emerald-300/60 animate-in zoom-in-95">
                  ✅ كسبت: {lastWinAmount.toFixed(1)} ج.م عند {lastWinOdds.toFixed(2)}x
                </div>
              )}
            </div>
          )}

          {/* CRASHED STATE VIEW */}
          {gameState === 'crashed' && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 backdrop-blur-2xs gap-3 p-4 text-center">
              <span className="text-3xl sm:text-5xl font-black text-[#ef4444] tracking-wider drop-shadow-[0_4px_20px_rgba(239,68,68,0.9)] animate-in zoom-in-95">
                FLEW AWAY!
              </span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs sm:text-sm font-bold text-amber-300 font-mono bg-slate-900/90 px-5 py-1.5 rounded-full border border-red-500/50 shadow-xl">
                  طارت الطائرة عند: {crashPoint.toFixed(2)}x
                </span>
                <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
                  🎯 انفجرت عند التوقع المعلن بالضبط ({crashPoint.toFixed(2)}x)
                </span>
              </div>

              {/* Instant Next Round Button */}
              <button
                onClick={startNextRoundImmediately}
                className="mt-1 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm transition cursor-pointer shadow-lg shadow-amber-500/30 flex items-center gap-2 active:scale-95"
              >
                <RotateCw className="w-4 h-4" />
                <span>بدء جولة جديدة مختلفة فوراً ⏩</span>
              </button>
            </div>
          )}
        </div>

        {/* WON NOTIFICATION BAR (Shown right after cashout) */}
        {userCashedOut && gameState === 'flying' && (
          <div className="w-full bg-gradient-to-r from-emerald-950/90 via-teal-900/90 to-emerald-950/90 border border-emerald-500/60 rounded-2xl p-3 flex items-center justify-between shadow-xl animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-lg">
                🏆
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-200">
                  تهانينا يا بطل! تم سحب أرباحك بنجاح
                </span>
                <span className="text-sm font-black text-white font-mono">
                  + {lastWinAmount.toFixed(1)} ج.م (مضاعف {lastWinOdds.toFixed(2)}x)
                </span>
              </div>
            </div>

            <button
              onClick={startNextRoundImmediately}
              className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition cursor-pointer flex items-center gap-1 shadow-md"
            >
              <span>جولة تالية فورية 🚀</span>
            </button>
          </div>
        )}

        {/* AUTO-CASHOUT CONTROLLER */}
        <div className="w-full bg-[#121b2d] border border-slate-800 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5 text-xs text-slate-300 w-full sm:w-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold">سحب الأرباح التلقائي:</span>
            <div className="flex items-center gap-1 bg-[#090e1a] px-2 py-1 rounded-xl border border-slate-700" dir="ltr">
              <input
                type="number"
                step="0.1"
                min="1.1"
                max="100"
                value={autoCashoutMultiplier}
                onChange={(e) => setAutoCashoutMultiplier(Math.max(1.1, Number(e.target.value)))}
                className="w-14 bg-transparent text-amber-300 font-bold font-mono text-center focus:outline-none text-xs"
              />
              <span className="text-amber-400 font-mono font-bold text-xs">x</span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-1" dir="ltr">
              {[1.5, 2.0, 3.0, 5.0].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAutoCashoutMultiplier(preset);
                    setAutoCashoutEnabled(true);
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono transition cursor-pointer border ${
                    autoCashoutMultiplier === preset && autoCashoutEnabled
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {preset.toFixed(1)}x
                </button>
              ))}
            </div>

            <button
              onClick={() => setAutoCashoutEnabled(!autoCashoutEnabled)}
              className={`py-1.5 px-3 rounded-xl font-bold text-xs transition cursor-pointer flex items-center gap-1 ${
                autoCashoutEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40 shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
              }`}
            >
              <span>{autoCashoutEnabled ? 'مفعل ✅' : 'معطل'}</span>
            </button>
          </div>
        </div>

        {/* BALANCE LIMIT REACHED BANNER */}
        {user.role !== 'admin' && isBalanceCapped && (
          <div className="w-full bg-red-950/90 border-2 border-red-500 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl animate-in fade-in" dir="rtl">
            <div className="flex items-center gap-2.5 text-right">
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-black text-amber-300">
                  لقد وصلت إلى الحد الأقصى من الأرباح ({maxBalanceLimit.toLocaleString('ar-EG')} ج.م)
                </span>
                <span className="text-xs text-slate-300">
                  يجب شحن الحساب لإجراء عملية سحب أو لعب.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setScreen('deposit')}
              id="crash-capped-deposit-btn"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shrink-0 cursor-pointer shadow-md transition active:scale-95"
            >
              شحن الحساب الآن 💳
            </button>
          </div>
        )}

        {/* BET CONTROLS AREA */}
        <div className="w-full flex flex-col gap-2">
          <div className="w-full grid grid-cols-2 gap-3">
            {/* Bet Input Box */}
            <div className="h-14 bg-[#121b2d] rounded-2xl border border-slate-700/80 flex items-center justify-between px-3.5 shadow-md">
              <span className="text-xs font-bold text-slate-400">الرهان:</span>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(1, Number(e.target.value)))}
                disabled={(userBetPlaced && gameState === 'flying') || (user.role !== 'admin' && isBalanceCapped)}
                className="w-24 bg-transparent text-white font-black text-center text-lg focus:outline-none font-mono disabled:opacity-50"
              />
              <span className="text-xs font-bold text-slate-400">ج.م</span>
            </div>

            {/* Place Bet or Cash Out Button */}
            {gameState === 'flying' && userBetPlaced && !userCashedOut ? (
              <button
                onClick={handleCashOut}
                id="crash-cashout-btn"
                className="h-14 rounded-2xl bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600 hover:from-emerald-500 hover:to-green-400 active:scale-98 text-white font-black text-sm tracking-wider shadow-lg shadow-emerald-950/80 transition cursor-pointer flex flex-col items-center justify-center animate-pulse"
              >
                <span className="text-xs font-bold uppercase">سحب الأرباح الآن 💰</span>
                <span className="text-sm font-black font-mono text-yellow-200" dir="ltr">
                  {(betAmount * multiplier).toFixed(1)} EGP ({multiplier.toFixed(2)}x)
                </span>
              </button>
            ) : user.role !== 'admin' && isBalanceCapped ? (
              <button
                onClick={() => {
                  sound.playCrash();
                  showToast(
                    `لقد وصلت إلى الحد الأقصى من الأرباح (${maxBalanceLimit.toLocaleString('ar-EG')} ج.م). يجب شحن الحساب لإجراء عملية سحب أو لعب.`,
                    'error'
                  );
                }}
                id="crash-place-bet-btn"
                className="h-14 rounded-2xl font-black text-xs sm:text-sm tracking-wide bg-red-950/80 border-2 border-red-500/70 text-amber-300 shadow-lg flex items-center justify-center px-2 text-center cursor-pointer transition hover:bg-red-900/80"
              >
                🚫 وصلت للحد (اشحن للعب)
              </button>
            ) : (
              <button
                onClick={handlePlaceBet}
                id="crash-place-bet-btn"
                className={`h-14 rounded-2xl font-black text-sm sm:text-base tracking-wide transition cursor-pointer shadow-lg flex items-center justify-center ${
                  userBetPlaced
                    ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-950/50'
                    : 'bg-gradient-to-r from-[#ff6a00] via-[#ff7c00] to-[#ff9000] hover:from-[#ff7a1a] hover:to-[#ffa01a] active:scale-98 text-white shadow-orange-950/50'
                }`}
              >
                {userBetPlaced ? 'إلغاء الرهان' : 'تأكيد الرهان 🚀'}
              </button>
            )}
          </div>

          {/* Quick Bet Amount Buttons */}
          <div className="flex items-center gap-1.5 justify-between" dir="ltr">
            {[10, 20, 50, 100, 200, 500].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setBetAmount(amt)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
                  betAmount === amt
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-[#121b2d] text-slate-300 border-slate-800 hover:bg-slate-700/60'
                }`}
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        {/* BOTTOM TABS: LIVE PLAYERS | MY BETS | TOP MULTIPLIERS */}
        <div className="w-full mt-1 flex flex-col bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-md">
          {/* Tabs Header */}
          <div className="flex items-center border-b border-slate-800 bg-[#0a0f1d] px-2 pt-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('players')}
              className={`py-2 px-3 sm:px-4 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'players'
                  ? 'bg-[#0f172a] text-amber-400 border-t-2 border-amber-500 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>اللاعبون بالجولة ({liveBots.length + (userBetPlaced ? 1 : 0)})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('mybets')}
              className={`py-2 px-3 sm:px-4 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'mybets'
                  ? 'bg-[#0f172a] text-amber-400 border-t-2 border-amber-500 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>سجل رهاناتي ({myBetsHistory.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('top')}
              className={`py-2 px-3 sm:px-4 rounded-t-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'top'
                  ? 'bg-[#0f172a] text-amber-400 border-t-2 border-amber-500 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>أعلى المضاعفات</span>
            </button>
          </div>

          {/* TAB 1: LIVE PLAYERS LIST */}
          {activeTab === 'players' && (
            <div className="p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-bold text-white">الرهانات الحية في الجولة</span>
                </div>
                <span className="font-mono font-bold text-amber-300">
                  المجموع: {totalRoundBets.toLocaleString()} ج.م
                </span>
              </div>

              <div className="w-full flex flex-col divide-y divide-slate-800/60 text-xs">
                {/* Current Active User Row */}
                {userBetPlaced && (
                  <div className="py-2.5 px-2 bg-gradient-to-r from-amber-500/15 via-blue-900/20 to-transparent border border-amber-500/40 rounded-xl my-1 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500 to-yellow-300 text-slate-950 font-black flex items-center justify-center text-xs shadow-md">
                        ⭐
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-amber-200">أنت (حسابك)</span>
                          <span className="text-[9px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded">
                            أنت
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          الرهان: {betAmount} ج.م
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {userCashedOut ? (
                        <div className="flex flex-col items-end">
                          <span className="text-emerald-400 font-bold font-mono text-sm">
                            +{lastWinAmount.toFixed(1)} ج.م
                          </span>
                          <span className="text-[10px] text-emerald-300 font-mono">
                            سحب عند {lastWinOdds.toFixed(2)}x
                          </span>
                        </div>
                      ) : gameState === 'flying' ? (
                        <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold animate-pulse">
                          🟡 في التحليق ({(betAmount * multiplier).toFixed(1)} ج.م)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono">
                          قيد الانتظار
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Live Bots Rows with dynamic styling */}
                {liveBots.map((bot) => (
                  <div key={bot.id} className="py-2.5 px-1.5 flex items-center justify-between hover:bg-slate-800/30 transition rounded-lg">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${bot.avatarBg} text-white font-black flex items-center justify-center text-xs shadow-md shrink-0 border border-white/10`}>
                        {bot.initials}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-100">{bot.name}</span>
                          {bot.badge && (
                            <span className="text-[9px] bg-slate-800 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/20">
                              {bot.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          الرهان: {bot.bet} ج.م
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {bot.cashedOut && bot.cashedOdds ? (
                        <div className="flex flex-col items-end">
                          <span className="text-emerald-400 font-black font-mono text-xs sm:text-sm">
                            +{bot.winAmount?.toLocaleString()} ج.م
                          </span>
                          <span className="text-[10px] text-emerald-300/80 font-mono">
                            سحب عند {bot.cashedOdds.toFixed(2)}x
                          </span>
                        </div>
                      ) : gameState === 'crashed' ? (
                        <span className="text-[10px] font-bold text-red-400 bg-red-950/60 border border-red-900/60 px-2 py-0.5 rounded">
                          ❌ فاته السحب
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                          <span>تحليق ({(bot.bet * multiplier).toFixed(0)} ج.م)</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: MY BETS HISTORY */}
          {activeTab === 'mybets' && (
            <div className="p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs text-slate-400">
                <span className="font-bold text-white">سجل جولاتك السابقة</span>
                <span className="text-[11px]">يتم حفظ نتائجك تلقائياً</span>
              </div>

              {myBetsHistory.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                  <History className="w-8 h-8 text-slate-600" />
                  <span>لم تقم بأي رهانات بعد. ضع رهانك في الجولة القادمة!</span>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-800/60 text-xs">
                  {myBetsHistory.map((rec) => (
                    <div key={rec.id} className="py-2.5 px-1.5 flex items-center justify-between">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-300 font-bold">
                            {rec.roundId}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(rec.timestamp).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          مبلغ الرهان: {rec.bet} ج.م • نقطة الانفجار: {rec.crashPoint.toFixed(2)}x
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {rec.won ? (
                          <div className="flex flex-col items-end">
                            <span className="text-emerald-400 font-black font-mono">
                              +{rec.winAmount.toFixed(1)} ج.م
                            </span>
                            <span className="text-[10px] text-emerald-300 font-mono">
                              سحب عند {rec.cashedOdds?.toFixed(2)}x ✅
                            </span>
                          </div>
                        ) : (
                          <span className="text-red-400 bg-red-950/50 border border-red-900/50 px-2.5 py-1 rounded text-[10px] font-bold">
                            ❌ خسارة ({rec.bet} ج.م)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TOP MULTIPLIERS */}
          {activeTab === 'top' && (
            <div className="p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs text-slate-400">
                <span className="font-bold text-white">أعلى أرباح ومضاعفات تم تحقيقها</span>
                <span className="text-amber-400 font-mono font-bold">TOP FLIGHTS</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  { name: 'البرنس إبراهيم', mult: '48.50x', win: '145,500 ج.م', bg: 'from-purple-900/40 to-slate-900', border: 'border-purple-500/40' },
                  { name: 'كابتن محمود الباشا', mult: '32.15x', win: '64,300 ج.م', bg: 'from-amber-900/40 to-slate-900', border: 'border-amber-500/40' },
                  { name: 'علي الكينج', mult: '24.80x', win: '49,600 ج.م', bg: 'from-rose-900/40 to-slate-900', border: 'border-rose-500/40' },
                  { name: 'يوسف العنتيل', mult: '18.40x', win: '18,400 ج.م', bg: 'from-emerald-900/40 to-slate-900', border: 'border-emerald-500/40' },
                ].map((item, idx) => (
                  <div key={idx} className={`p-3 rounded-xl bg-gradient-to-r ${item.bg} border ${item.border} flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-300 font-black flex items-center justify-center text-xs">
                        #{idx + 1}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-white">{item.name}</span>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold">ربح {item.win}</span>
                      </div>
                    </div>
                    <span className="text-sm font-mono font-black text-amber-300">{item.mult}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

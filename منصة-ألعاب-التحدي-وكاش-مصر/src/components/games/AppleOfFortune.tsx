import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { sound } from '../../utils/sound';
import { AppleRowState } from '../../types';
import {
  ArrowRight,
  Info,
  Sparkles,
  Volume2,
  VolumeX,
  Plus,
  RotateCcw,
  Zap,
  CheckCircle2,
  X,
  Trophy,
  Target,
  Bot,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

// Multipliers and rotten apple count for each of the 10 rows (Matching exact numbers and labels from video 00:20)
const ROW_CONFIGS = [
  { row: 1, multiplier: 1.23, displayLabel: '1.00', rottenCount: 1 },
  { row: 2, multiplier: 1.54, displayLabel: 'x1.23', rottenCount: 1 },
  { row: 3, multiplier: 1.93, displayLabel: 'x1.54', rottenCount: 1 },
  { row: 4, multiplier: 2.41, displayLabel: 'x1.93', rottenCount: 1 },
  { row: 5, multiplier: 4.33, displayLabel: 'x2.41', rottenCount: 2 },
  { row: 6, multiplier: 8.66, displayLabel: 'x4.33', rottenCount: 2 },
  { row: 7, multiplier: 17.3, displayLabel: 'x8.66', rottenCount: 2 },
  { row: 8, multiplier: 34.6, displayLabel: 'x17.3', rottenCount: 3 },
  { row: 9, multiplier: 69.3, displayLabel: 'x34.6', rottenCount: 3 },
  { row: 10, multiplier: 138.6, displayLabel: 'x69.3', rottenCount: 4 },
];

export const AppleOfFortune: React.FC = () => {
  const { user, placeBet, winBet, setScreen, showToast, soundEnabled, setSoundEnabled, isHackerEnabled, setIsHackerEnabled, isBalanceCapped, maxBalanceLimit } = useApp();

  // Bet settings
  const [betAmount, setBetAmount] = useState<number>(20);
  const [inputBetStr, setInputBetStr] = useState<string>('20');
  const [oneClickMode, setOneClickMode] = useState<boolean>(false);

  // Game state: 'idle' | 'playing' | 'lost' | 'won'
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'lost' | 'won'>('idle');
  const [currentRowIndex, setCurrentRowIndex] = useState<number>(0); // 0 = Row 1 (bottom), 9 = Row 10 (top)
  const [rows, setRows] = useState<AppleRowState[]>([]);
  const [lastWinnings, setLastWinnings] = useState<number>(0);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);

  // Initialize board generator
  const generateNewBoard = (): AppleRowState[] => {
    return ROW_CONFIGS.map((cfg) => {
      // Pick `rottenCount` unique random indices out of 0..4
      const indices = [0, 1, 2, 3, 4];
      const rotten: number[] = [];
      for (let i = 0; i < cfg.rottenCount; i++) {
        const randIdx = Math.floor(Math.random() * indices.length);
        rotten.push(indices[randIdx]);
        indices.splice(randIdx, 1);
      }

      return {
        multiplier: cfg.multiplier,
        selectedColumn: null,
        rottenIndex: rotten,
        revealed: [false, false, false, false, false],
        status: 'locked',
      };
    });
  };

  // Reset or initialize
  useEffect(() => {
    const initialBoard = generateNewBoard();
    setRows(initialBoard);
  }, []);

  // Handle start game / place bet
  const handleStartGame = () => {
    const amount = Number(inputBetStr);
    if (isNaN(amount) || amount < 10) {
      showToast('الحد الأدنى للرهان هو 10 جنيه', 'error');
      return;
    }
    if (amount > user.balance) {
      showToast('رصيدك غير كافٍ لإتمام الرهان', 'error');
      return;
    }

    const success = placeBet(amount, 'تفاحة الحظ (Apple of Fortune)');
    if (!success) return;

    sound.playClick();
    setBetAmount(amount);

    const newBoard = generateNewBoard();
    newBoard[0].status = 'active'; // Row 1 is active
    setRows(newBoard);
    setCurrentRowIndex(0);
    setGameState('playing');
    setLastWinnings(0);
  };

  // Handle player selecting a disc in the active row
  const handleSelectColumn = (colIndex: number) => {
    if (gameState !== 'playing') return;

    const activeRow = rows[currentRowIndex];
    if (!activeRow || activeRow.status !== 'active') return;

    sound.playClick();

    const isRotten = activeRow.rottenIndex.includes(colIndex);

    if (isRotten) {
      // LOST!
      sound.playAppleReveal(false);
      sound.playCrash();

      // Reveal everything on the entire board
      const updatedRows = rows.map((r, rIdx) => {
        if (rIdx === currentRowIndex) {
          return {
            ...r,
            selectedColumn: colIndex,
            revealed: [true, true, true, true, true],
            status: 'failed' as const,
          };
        }
        return {
          ...r,
          revealed: [true, true, true, true, true],
          status: rIdx < currentRowIndex ? ('passed' as const) : ('locked' as const),
        };
      });

      setRows(updatedRows);
      setGameState('lost');
    } else {
      // SUCCESS!
      sound.playAppleReveal(true);

      const currentMult = activeRow.multiplier;
      const currentWin = Number((betAmount * currentMult).toFixed(2));
      setLastWinnings(currentWin);

      if (currentRowIndex === 9) {
        // Player reached the summit (Row 10) -> Jackpot Win!
        sound.playWin();
        winBet(currentWin, currentMult, 'تفاحة الحظ (Apple of Fortune)');

        const updatedRows = rows.map((r, rIdx) => ({
          ...r,
          selectedColumn: rIdx === 9 ? colIndex : r.selectedColumn,
          revealed: [true, true, true, true, true],
          status: 'passed' as const,
        }));

        setRows(updatedRows);
        setGameState('won');
        showToast(`🎉 مبروك! وصلت للقمة وفزت بمبلغ ${currentWin} جنيه!`, 'success');
      } else {
        // Advance to next row
        const nextIndex = currentRowIndex + 1;
        const updatedRows = rows.map((r, rIdx) => {
          if (rIdx === currentRowIndex) {
            const rev = [...r.revealed];
            rev[colIndex] = true;
            return {
              ...r,
              selectedColumn: colIndex,
              revealed: rev,
              status: 'passed' as const,
            };
          }
          if (rIdx === nextIndex) {
            return {
              ...r,
              status: 'active' as const,
            };
          }
          return r;
        });

        setRows(updatedRows);
        setCurrentRowIndex(nextIndex);
      }
    }
  };

  // Cashout / Take Winnings
  const handleCashout = () => {
    if (gameState !== 'playing' || currentRowIndex === 0 && rows[0].selectedColumn === null) return;

    // Previous completed row multiplier
    const completedRowIndex = currentRowIndex - 1;
    if (completedRowIndex < 0) return;

    const winMultiplier = rows[completedRowIndex].multiplier;
    const winAmount = Number((betAmount * winMultiplier).toFixed(2));

    sound.playWin();
    winBet(winAmount, winMultiplier, 'تفاحة الحظ (Apple of Fortune)');

    // Reveal the rest of the board for transparency
    const updatedRows = rows.map((r) => ({
      ...r,
      revealed: [true, true, true, true, true],
    }));

    setRows(updatedRows);
    setLastWinnings(winAmount);
    setGameState('won');
    showToast(`✅ تم سحب الأرباح بنجاح: ${winAmount} جنيه!`, 'success');
  };

  // Quick bet helpers
  const handleMinBet = () => {
    setInputBetStr('10');
    sound.playClick();
  };

  const handleDoubleBet = () => {
    const curr = Number(inputBetStr) || 10;
    const doubled = Math.min(curr * 2, user.balance, 50000);
    setInputBetStr(doubled.toFixed(0));
    sound.playClick();
  };

  const handleHalfBet = () => {
    const curr = Number(inputBetStr) || 10;
    const halved = Math.max(Math.floor(curr / 2), 10);
    setInputBetStr(halved.toFixed(0));
    sound.playClick();
  };

  const handleMaxBet = () => {
    const max = Math.min(Math.floor(user.balance), 50000);
    setInputBetStr(Math.max(max, 10).toString());
    sound.playClick();
  };

  const handleResetForNewBet = () => {
    sound.playClick();
    const fresh = generateNewBoard();
    setRows(fresh);
    setGameState('idle');
    setCurrentRowIndex(0);
    setLastWinnings(0);
  };

  // Current profit preview during gameplay
  const currentProfit =
    currentRowIndex > 0 && rows[currentRowIndex - 1]?.selectedColumn !== null
      ? Number((betAmount * rows[currentRowIndex - 1].multiplier).toFixed(2))
      : 0;

  return (
    <div
      className="w-full min-h-[calc(100vh-60px)] flex flex-col items-center justify-between text-white relative select-none overflow-x-hidden"
      style={{
        backgroundImage: `radial-gradient(circle at center top, rgba(16, 40, 24, 0.4), rgba(4, 18, 10, 0.88)), url('/apple-jungle-bg.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Ambient Forest Glow Filter */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80 pointer-events-none z-0"></div>

      {/* Main Container constrained to mobile app dimensions like the screenshots */}
      <div className="w-full max-w-md mx-auto flex flex-col justify-between flex-1 relative z-10 px-2 sm:px-3 pt-1.5 pb-4">
        {/* 1. TOP HEADER (Matching Video 00:19 - 00:22) */}
        <div className="w-full flex items-center justify-between gap-2 py-1">
          {/* Left: Sound & Hacker Bot Quick Toggle */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              id="apple-sound-toggle-btn"
              className="w-8 h-8 rounded-lg border border-white/20 bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition cursor-pointer"
              title="كتم / تشغيل الصوت"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-400" />}
            </button>
            {/* Hacker Toggle Button: Always visible before and during game */}
            <button
              type="button"
              onClick={() => {
                sound.playClick();
                setIsHackerEnabled(!isHackerEnabled);
                showToast(
                  !isHackerEnabled
                    ? '⚡ تم تشغيل الهاك: جاري كشف التفاح السليم والمقسوم!'
                    : 'تم إيقاف الهاك',
                  !isHackerEnabled ? 'success' : 'info'
                );
              }}
              id="apple-hacker-toggle-btn"
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                isHackerEnabled
                  ? 'bg-emerald-500/25 border-emerald-400/80 text-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.7)] ring-1 ring-emerald-400'
                  : 'bg-black/50 border-slate-700 text-slate-300 hover:bg-white/10'
              }`}
              title="تشغيل أو إيقاف الهاك"
            >
              <span className={`w-2 h-2 rounded-full ${isHackerEnabled ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`}></span>
              <span>{isHackerEnabled ? 'الهاك نشط 🍏' : 'تشغيل الهاك ⚡'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowRulesModal(true)}
              id="apple-rules-btn"
              className="w-8 h-8 rounded-lg border border-white/20 bg-black/40 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition cursor-pointer"
              title="شرح وقواعد اللعبة"
            >
              <Info className="w-4 h-4" />
            </button>
          </div>

          {/* Center: Floating Dark Pill with Balance & Green + (matching video 00:19) */}
          <button
            type="button"
            onClick={() => setScreen('deposit')}
            id="apple-header-deposit-btn"
            className="bg-black/70 border border-slate-700/80 hover:border-emerald-500/60 rounded-full py-1 px-3 flex items-center gap-1.5 shadow-lg backdrop-blur cursor-pointer active:scale-95 transition"
          >
            <div className="w-4 h-4 rounded-full bg-[#22c55e] text-slate-950 flex items-center justify-center font-bold text-xs">
              <Plus className="w-3 h-3 stroke-[3]" />
            </div>
            <div className="flex items-baseline gap-1 text-xs sm:text-sm font-bold text-white font-mono" dir="rtl">
              <span>{user.balance.toFixed(2)}</span>
              <span className="text-slate-300 text-[10px]">ج.م</span>
            </div>
          </button>

          {/* Right: Green Square Button with White Right Arrow to Exit (matching video 00:19) */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setScreen('lobby');
            }}
            id="apple-exit-game-btn"
            className="w-8 h-8 rounded-lg bg-[#22c55e] hover:bg-[#16a34a] active:scale-95 flex items-center justify-center text-white shadow-md transition cursor-pointer"
            title="الرجوع للرئيسية"
          >
            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Hacker Active Radar Banner */}
        {isHackerEnabled && (
          <div className="w-full my-1 bg-gradient-to-r from-emerald-950/95 via-[#082a16] to-emerald-950/95 border border-emerald-400/90 rounded-xl px-3 py-1.5 flex items-center justify-between shadow-[0_0_16px_rgba(52,211,153,0.35)] animate-in fade-in" dir="rtl">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs font-black text-emerald-300">
                ⚡ رادار الهاك نشط: تم كشف جميع التفاحات السليمة 🍏 والمقسومة 🍎❌
              </span>
            </div>
            <span className="text-[10px] font-bold bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full font-mono shadow-sm">
              دقة 100% مضمونة
            </span>
          </div>
        )}

        {/* Balance Capped Warning Banner */}
        {isBalanceCapped && (
          <div className="w-full my-1 bg-red-950/90 border-2 border-amber-500/80 rounded-xl p-2 text-center shadow-lg flex items-center justify-between gap-2 animate-in fade-in" dir="rtl">
            <div className="flex items-center gap-2 text-right">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-amber-300">
                  تم بلوغ الحد النهائي ({maxBalanceLimit.toLocaleString('ar-EG')} ج.م)
                </span>
                <span className="text-[9px] text-slate-200">
                  اشحن حسابك لرفع الحد ومواصلة اللعب والسحب.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setScreen('deposit')}
              id="apple-capped-deposit-btn"
              className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-[10px] shrink-0 cursor-pointer hover:bg-amber-400"
            >
              شحن 💳
            </button>
          </div>
        )}

        {/* 2. THE 10-ROW GAME BOARD (With Multipliers on Left) */}
        <div className="w-full relative my-auto py-1.5 flex items-center justify-center">
          {/* Centered Loss Banner with rotten apple */}
          {gameState === 'lost' && (
            <div
              className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-30 bg-black/90 border border-red-500/80 backdrop-blur-md rounded-2xl p-4 text-center shadow-2xl flex flex-col items-center gap-2 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-red-500 shadow-lg shadow-red-900/60 bg-[#2a0e0e]">
                <img src="/apple-rotten.png" alt="تفاحة خاسرة" className="w-full h-full object-cover select-none" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-red-400 drop-shadow-[0_2px_8px_rgba(239,68,68,0.8)] tracking-wide">
                حظ أوفر في المرة القادمة!
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-300">
                حاول مرة أخرى 🍎
              </span>
            </div>
          )}

          {/* Centered Win Banner with ripe apple */}
          {gameState === 'won' && (
            <div
              className="absolute inset-x-4 top-1/2 -translate-y-1/2 z-30 bg-emerald-950/95 border-2 border-emerald-400/90 backdrop-blur-md rounded-2xl p-5 text-center shadow-2xl flex flex-col items-center gap-2 pointer-events-none animate-in fade-in zoom-in-95 duration-200"
            >
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-400 shadow-lg shadow-emerald-900/60 bg-[#0e3b1c]">
                <img src="/apple-ripe.png" alt="تفاحة رابحة" className="w-full h-full object-cover select-none" />
              </div>
              <span className="text-xl sm:text-2xl font-black text-amber-300 drop-shadow">
                مبروك! تم حصد الأرباح!
              </span>
              <span className="text-lg sm:text-xl font-mono font-bold text-white">
                +{lastWinnings.toFixed(2)} ج.م
              </span>
            </div>
          )}

          {/* Vertical Grid: 10 rows rendered from Top (Row 10, index 9) down to Bottom (Row 1, index 0) */}
          <div className="w-full flex flex-col gap-1 sm:gap-1.5" dir="ltr">
            {[...rows].reverse().map((row, revIdx) => {
              const actualRowIndex = 9 - revIdx; // 9 down to 0
              const rowCfg = ROW_CONFIGS[actualRowIndex];
              const isCurrentActive = gameState === 'playing' && actualRowIndex === currentRowIndex;
              const isPassed = (gameState === 'playing' && actualRowIndex < currentRowIndex) || (gameState === 'won' && actualRowIndex <= currentRowIndex);
              const isFailed = actualRowIndex === currentRowIndex && gameState === 'lost';

              return (
                <div
                  key={actualRowIndex}
                  className={`flex items-center justify-between gap-1.5 sm:gap-2 px-1 transition-all duration-300 ${
                    isCurrentActive
                      ? 'scale-[1.02] -translate-y-0.5'
                      : 'opacity-95'
                  }`}
                >
                  {/* 5 Discs for this Row (Left / Center) */}
                  <div className="flex-1 grid grid-cols-5 gap-1.5 sm:gap-2">
                    {[0, 1, 2, 3, 4].map((colIdx) => {
                      const isRevealed = row.revealed[colIdx];
                      const isRotten = row.rottenIndex.includes(colIdx);
                      const isSelected = row.selectedColumn === colIdx;

                      return (
                        <button
                          key={colIdx}
                          type="button"
                          disabled={!isCurrentActive || isRevealed}
                          onClick={() => handleSelectColumn(colIdx)}
                          className={`aspect-square rounded-full flex items-center justify-center relative transition-all duration-200 group ${
                            isCurrentActive
                              ? 'cursor-pointer hover:scale-105 active:scale-95 ring-2 ring-amber-400/80 hover:ring-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                              : 'cursor-default'
                          } ${isSelected ? 'ring-2 ring-white' : ''}`}
                        >
                          {/* 1. If revealed as RIPE APPLE (Good Apple - Win) */}
                          {isRevealed && !isRotten && (
                            <div className="w-full h-full rounded-full overflow-hidden border-2 border-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.9)] relative bg-[#0e3b1c] animate-in zoom-in-95 duration-200">
                              <img
                                src="/apple-ripe.png"
                                alt="مكسب - تفاحة طازجة"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover transform transition-transform group-hover:scale-105 select-none drop-shadow-md"
                              />
                              <div className="absolute inset-0 bg-emerald-400/10 pointer-events-none"></div>
                            </div>
                          )}

                          {/* 2. If revealed as ROTTEN APPLE (Loss) */}
                          {isRevealed && isRotten && (
                            <div className={`w-full h-full rounded-full overflow-hidden border-2 ${
                              isSelected ? 'border-red-500 ring-4 ring-red-500/80 shadow-[0_0_20px_rgba(239,68,68,1)] animate-pulse' : 'border-red-800/80 opacity-80'
                            } relative bg-[#2a0e0e] animate-in zoom-in-95 duration-200`}>
                              <img
                                src="/apple-rotten.png"
                                alt="خسارة - تفاحة مأكولة"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover transform transition-transform select-none drop-shadow-md"
                              />
                              <div className="absolute inset-0 bg-red-600/15 pointer-events-none"></div>
                            </div>
                          )}

                          {/* 3. If Covered (Locked or Active awaiting pick) */}
                          {!isRevealed && (
                            <>
                              {isHackerEnabled ? (
                                /* HACK MODE ACTIVE: Reveal Safe (Ripe) vs Split (Rotten) */
                                !isRotten ? (
                                  /* 🍏 SAFE APPLE (تفاحة سليمة مضمونة) */
                                  <div
                                    className={`w-full h-full rounded-full overflow-hidden border-2 relative flex items-center justify-center transition-all animate-pulse ${
                                      isCurrentActive
                                        ? 'border-emerald-400 ring-4 ring-emerald-400/90 shadow-[0_0_20px_rgba(52,211,153,1)] bg-[#0c3a1b] scale-105'
                                        : 'border-emerald-500/80 ring-2 ring-emerald-500/50 shadow-[0_0_12px_rgba(52,211,153,0.7)] bg-[#082913]'
                                    }`}
                                  >
                                    <img
                                      src="/apple-ripe.png"
                                      alt="تفاحة سليمة رابحة"
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover scale-105 select-none drop-shadow-md"
                                    />
                                    <div className="absolute inset-0 bg-emerald-500/20 pointer-events-none"></div>
                                    <div className="absolute -bottom-1 inset-x-0 flex justify-center pointer-events-none z-10">
                                      <span className="bg-emerald-500 text-slate-950 font-black text-[8px] sm:text-[9px] px-1 py-0.5 rounded-full shadow-lg border border-emerald-300 whitespace-nowrap">
                                        سليمة 🍏
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  /* 🍎❌ SPLIT / ROTTEN APPLE (تفاحة مقسومة مأكولة) */
                                  <div
                                    className={`w-full h-full rounded-full overflow-hidden border-2 relative flex items-center justify-center transition-all ${
                                      isCurrentActive
                                        ? 'border-red-500 ring-4 ring-red-500/80 shadow-[0_0_18px_rgba(239,68,68,0.9)] bg-[#350a0a]'
                                        : 'border-red-800/80 ring-1 ring-red-700/50 bg-[#250808] opacity-75'
                                    }`}
                                  >
                                    <img
                                      src="/apple-rotten.png"
                                      alt="تفاحة مقسومة خاسرة"
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover scale-95 select-none drop-shadow-md"
                                    />
                                    <div className="absolute inset-0 bg-red-600/30 pointer-events-none"></div>
                                    <div className="absolute -bottom-1 inset-x-0 flex justify-center pointer-events-none z-10">
                                      <span className="bg-red-600 text-white font-black text-[8px] sm:text-[9px] px-1 py-0.5 rounded-full shadow-lg border border-red-400 whitespace-nowrap">
                                        مقسومة ❌
                                      </span>
                                    </div>
                                  </div>
                                )
                              ) : (
                                /* NORMAL COVERED DISC */
                                <div
                                  className={`w-full h-full rounded-full overflow-hidden border relative flex items-center justify-center transition-all ${
                                    isCurrentActive
                                      ? 'border-amber-400 ring-2 ring-amber-400/80 shadow-[0_0_12px_rgba(251,191,36,0.7)] bg-[#2b170e]'
                                      : 'border-amber-950/60 bg-[#1e1009]/90 opacity-90'
                                  }`}
                                >
                                  <img
                                    src={actualRowIndex === 0 || isCurrentActive ? '/apple-pouch.png' : '/apple-locked.png'}
                                    alt="قرص مغطى"
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover select-none"
                                  />
                                  {isCurrentActive && (
                                    <div className="absolute inset-0 bg-amber-400/10 animate-pulse pointer-events-none rounded-full"></div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Multiplier Pill (Matching exact green pills on the right in video 00:20) */}
                  <div
                    className={`w-14 sm:w-16 h-6 sm:h-7 rounded-md flex items-center justify-center font-mono text-[10px] sm:text-xs font-bold transition-all shadow-xs shrink-0 ${
                      isCurrentActive || isPassed
                        ? 'bg-[#5db448] text-white shadow-[0_0_12px_rgba(93,180,72,0.6)] ring-1 ring-emerald-300'
                        : isFailed
                        ? 'bg-red-800 text-red-200 border border-red-500/50'
                        : 'bg-[#1b3822]/80 text-[#85ba8e] border border-[#2e5938]/60'
                    }`}
                  >
                    {rowCfg.displayLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. BOTTOM CONTROLS (Screenshots & Video 00:20) */}
        <div className="w-full flex flex-col gap-2 pt-1">
          {/* CASE A: During active gameplay (Take Winnings / Cashout - Screenshot 6) */}
          {gameState === 'playing' && (
            <div className="w-full flex flex-col gap-2">
              {/* Current Profits Display */}
              <div className="w-full text-center">
                <span className="text-xs sm:text-sm font-bold text-slate-200">
                  {currentProfit > 0 ? (
                    <>الأرباح الحالية: <span className="text-amber-400 font-mono font-black text-sm sm:text-base">{currentProfit.toFixed(2)}</span> ج.م</>
                  ) : (
                    'اختر تفاحة واحدة من الصف الأول 🍎'
                  )}
                </span>
              </div>

              {/* Big Golden "خذ الأرباح" Button */}
              <button
                type="button"
                onClick={handleCashout}
                disabled={currentProfit <= 0}
                id="apple-take-winnings-btn"
                className={`w-full py-3.5 rounded-xl font-bold text-base sm:text-lg shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  currentProfit > 0
                    ? 'bg-gradient-to-b from-[#e5a824] via-[#f59e0b] to-[#b45309] hover:from-[#f5b331] hover:to-[#c45d0c] active:scale-98 text-slate-950 shadow-amber-500/25'
                    : 'bg-amber-800/40 text-amber-200/50 cursor-not-allowed border border-amber-500/20'
                }`}
              >
                <span>خذ الأرباح</span>
                {currentProfit > 0 && <span className="font-mono text-sm sm:text-base">({currentProfit.toFixed(2)} ج.م)</span>}
              </button>
            </div>
          )}

          {/* CASE B: Post-game (Lost or Won - Screenshot 1) */}
          {(gameState === 'lost' || gameState === 'won') && (
            <div className="w-full flex flex-col gap-2">
              {/* Play Again with same bet */}
              {user.role !== 'admin' && isBalanceCapped ? (
                <button
                  type="button"
                  onClick={() => {
                    sound.playCrash();
                    showToast(
                      `لقد وصلت إلى الحد الأقصى من الأرباح (${maxBalanceLimit.toLocaleString('ar-EG')} ج.م). يجب شحن الحساب لإجراء عملية سحب أو لعب.`,
                      'error'
                    );
                  }}
                  id="apple-play-again-btn"
                  className="w-full py-3 rounded-xl bg-red-950/80 border border-red-500/70 text-amber-300 font-black text-xs sm:text-sm shadow-lg transition active:scale-98 cursor-pointer text-center"
                >
                  🚫 وصلت للحد الأقصى ({maxBalanceLimit.toLocaleString('ar-EG')} ج.م) - اشحن للعب
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    handleStartGame();
                  }}
                  id="apple-play-again-btn"
                  className="w-full py-3 rounded-xl bg-gradient-to-b from-[#f59e0b] to-[#d97706] hover:from-[#fbbf24] hover:to-[#b45309] text-slate-950 font-black text-sm sm:text-base shadow-lg transition active:scale-98 cursor-pointer text-center"
                >
                  العب مرة أخرى ({betAmount} ج.م)
                </button>
              )}

              {/* New Bet button */}
              <button
                type="button"
                onClick={handleResetForNewBet}
                id="apple-new-bet-btn"
                className="w-full py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm border border-slate-700 shadow-md transition active:scale-98 cursor-pointer text-center"
              >
                رهان جديد
              </button>
            </div>
          )}

          {/* CASE C: Pre-game Bet Setup (Matching Video 00:20: MAX, X/2, X2, MIN and STAKE) */}
          {gameState === 'idle' && (
            <div className="w-full flex flex-col gap-2">
              {/* 4 Quick Bet Buttons matching video 00:20: MAX | X/2 | X2 | MIN */}
              <div className="grid grid-cols-4 gap-1.5" dir="ltr">
                <button
                  type="button"
                  onClick={handleMaxBet}
                  id="apple-quick-max-btn"
                  className="py-2 rounded-lg bg-[#12253a] hover:bg-[#18324f] border border-slate-700/80 text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer text-center"
                >
                  MAX
                </button>
                <button
                  type="button"
                  onClick={handleHalfBet}
                  id="apple-quick-half-btn"
                  className="py-2 rounded-lg bg-[#12253a] hover:bg-[#18324f] border border-slate-700/80 text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer text-center"
                >
                  X/2
                </button>
                <button
                  type="button"
                  onClick={handleDoubleBet}
                  id="apple-quick-double-btn"
                  className="py-2 rounded-lg bg-[#12253a] hover:bg-[#18324f] border border-slate-700/80 text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer text-center"
                >
                  X2
                </button>
                <button
                  type="button"
                  onClick={handleMinBet}
                  id="apple-quick-min-btn"
                  className="py-2 rounded-lg bg-[#12253a] hover:bg-[#18324f] border border-slate-700/80 text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer text-center"
                >
                  MIN
                </button>
              </div>

              {/* Main Bet Row: STAKE / Place Bet Button + Amount Input */}
              <div className="w-full bg-[#13273d] p-1.5 sm:p-2 rounded-xl border border-slate-700/90 flex items-center justify-between gap-2 shadow-lg">
                {/* Place Bet / STAKE Button on Left */}
                {user.role !== 'admin' && isBalanceCapped ? (
                  <button
                    type="button"
                    onClick={() => {
                      sound.playCrash();
                      showToast(
                        `لقد وصلت إلى الحد الأقصى من الأرباح (${maxBalanceLimit.toLocaleString('ar-EG')} ج.م). يجب شحن الحساب لإجراء عملية سحب أو لعب.`,
                        'error'
                      );
                    }}
                    id="apple-place-bet-btn"
                    className="py-2.5 px-3 rounded-lg bg-red-950/80 border border-red-500/70 text-amber-300 font-black text-xs shadow-md transition cursor-pointer"
                  >
                    🚫 وصلت للحد
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartGame}
                    id="apple-place-bet-btn"
                    className="py-2.5 px-6 rounded-lg bg-[#1976d2] hover:bg-[#1565c0] active:scale-95 text-white font-black text-sm sm:text-base shadow-md transition cursor-pointer"
                  >
                    الرهان
                  </button>
                )}

                {/* Amount display & input on Right */}
                <div className="flex flex-col items-end flex-1 pr-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-bold text-slate-400">ج.م</span>
                    <input
                      type="number"
                      value={inputBetStr}
                      onChange={(e) => setInputBetStr(e.target.value)}
                      min={10}
                      max={50000}
                      id="apple-bet-input"
                      className="w-24 text-right bg-transparent text-white font-mono font-black text-base sm:text-lg focus:outline-none focus:border-b border-blue-400"
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium">
                    min 10 ج.م - max {Math.min(user.balance, 50000).toFixed(2)} ج.م
                  </span>
                </div>
              </div>

              {/* Bottom Quick Bar: بنقرة واحدة | إعدادات */}
              <div className="flex items-center justify-between px-2 pt-0.5 text-xs text-slate-400 font-medium">
                <button
                  type="button"
                  onClick={() => {
                    sound.playClick();
                    setOneClickMode(!oneClickMode);
                  }}
                  id="apple-oneclick-toggle-btn"
                  className={`flex items-center gap-1 hover:text-white transition cursor-pointer ${
                    oneClickMode ? 'text-amber-400' : ''
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>بنقرة واحدة</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowRulesModal(true)}
                  id="apple-settings-info-btn"
                  className="flex items-center gap-1 hover:text-white transition cursor-pointer"
                >
                  <span>قواعد اللعبة</span>
                  <Info className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RULES & PAYOUT MODAL */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-right animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="text-slate-400 hover:text-white transition p-1"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-base font-bold text-amber-400">قواعد لعبة تفاحة الحظ 🍎</h3>
            </div>

            <div className="text-xs text-slate-300 leading-relaxed flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto">
              <p>
                <strong>الهدف:</strong> التسلق عبر 10 صفوف واختيار التفاحات السليمة دون الوقوع في التفاحة المأكولة (المعفنة).
              </p>

              {/* Visual Tokens in Rules */}
              <div className="grid grid-cols-2 gap-2 my-1">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40">
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-emerald-400">
                    <img src="/apple-ripe.png" alt="مكسب" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-emerald-300 text-[11px]">تفاحة سليمة (مكسب)</span>
                    <span className="text-[9px] text-slate-400">تصعد بك للصف التالي</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-xl bg-red-950/60 border border-red-500/40">
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-red-400">
                    <img src="/apple-rotten.png" alt="خسارة" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-red-300 text-[11px]">تفاحة مأكولة (خسارة)</span>
                    <span className="text-[9px] text-slate-400">تنتهي الجولة بخسارة</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl flex flex-col gap-1.5 border border-slate-700">
                <span className="font-bold text-emerald-400">• الصفوف 1 إلى 4:</span>
                <span>4 تفاحات سليمة وتفاحة واحدة معفنة (نسبة الفوز 80%).</span>

                <span className="font-bold text-emerald-400 mt-1">• الصفوف 5 إلى 7:</span>
                <span>3 تفاحات سليمة وتفاحتان معفنتان (نسبة الفوز 60%).</span>

                <span className="font-bold text-emerald-400 mt-1">• الصفوف 8 إلى 9:</span>
                <span>تفاحتان سليمتان و 3 تفاحات معفنة (نسبة الفوز 40%).</span>

                <span className="font-bold text-amber-400 mt-1">• الصف 10 (القمة):</span>
                <span>تفاحة واحدة سليمة و 4 معفنة بمضاعف أسطوري x 349.68!</span>
              </div>
              <p>
                <strong>سحب الأرباح:</strong> يمكنك سحب أرباحك في أي لحظة بعد اجتياز أي صف بالضغط على زر <strong>"خذ الأرباح"</strong> دون إكمال التسلق.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition"
            >
              فهمت، ابدأ اللعب
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

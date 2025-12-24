import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, Users, User, Cpu, Check, Delete, Github, Clipboard } from 'lucide-react';
import clsx from 'clsx';
import type { AiLevel } from '../types';

interface WelcomeScreenProps {
  onCreate: (name: string, gridSize: number, winCondition: number) => void;
  onJoin: (code: string, name: string) => void;
  onStartAi: (name: string, gridSize: number, winCondition: number, difficulty: AiLevel) => void;
  isConnecting: boolean;
  error: string | null;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onCreate, onJoin, onStartAi, isConnecting, error }) => {
  const GRID_SIZES = [3, 4, 5, 6, 7] as const;
  const WIN_CONDITIONS = [3, 4, 5, 6, 7] as const;
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'ai'>('create');
  const isJoinTab = activeTab === 'join';
  const isAiTab = activeTab === 'ai';
  const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
  
  // Persisted State Initialization
  const [name, setName] = useState(() => {
    try { return localStorage.getItem('peer_tactoe_name') || ''; } catch { return ''; }
  });
  
  const [gridSize, setGridSize] = useState<number>(() => {
    try { return Number(localStorage.getItem('peer_tactoe_pref_grid')) || 3; } catch { return 3; }
  });

  const [winCondition, setWinCondition] = useState<number>(() => {
    try { return Number(localStorage.getItem('peer_tactoe_pref_win')) || 3; } catch { return 3; }
  });

  const [aiDifficulty, setAiDifficulty] = useState<AiLevel>(() => {
    try {
      const raw = localStorage.getItem('peer_tactoe_pref_ai_level');
      return raw === 'easy' || raw === 'medium' || raw === 'hard' || raw === 'extreme' ? raw : 'medium';
    } catch {
      return 'medium';
    }
  });
  
  const [roomCode, setRoomCode] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Auto-adjust win condition if grid size becomes smaller than current win condition
  useEffect(() => {
    if (winCondition > gridSize) {
      setWinCondition(gridSize);
    }
  }, [gridSize, winCondition]);

  const savePreferences = () => {
    try {
      localStorage.setItem('peer_tactoe_name', name.trim());
      localStorage.setItem('peer_tactoe_pref_grid', gridSize.toString());
      localStorage.setItem('peer_tactoe_pref_win', winCondition.toString());
      localStorage.setItem('peer_tactoe_pref_ai_level', aiDifficulty);
    } catch (e) {
      console.error('Failed to save preferences', e);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      savePreferences();
      onCreate(name.trim(), gridSize, winCondition);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    doJoin();
  };

  const handleStartAi = (e: React.FormEvent) => {
    e.preventDefault();
    doStartAi();
  };

  const doStartAi = () => {
    if (name.trim() && !isConnecting) {
      savePreferences();
      onStartAi(name.trim(), gridSize, winCondition, aiDifficulty);
    }
  };

  const doJoin = () => {
    if (name.trim() && roomCode.trim()) {
      // Only save name for joiners
      try { localStorage.setItem('peer_tactoe_name', name.trim()); } catch {}
      onJoin(roomCode.trim(), name.trim());
    }
  };

  const handlePaste = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setPasteError(null);

    const activeEl = document.activeElement as HTMLElement | null;
    const activeElDesc = activeEl
      ? `${activeEl.tagName.toLowerCase()}${activeEl.id ? `#${activeEl.id}` : ''}${activeEl.className ? `.${String(activeEl.className).split(' ').filter(Boolean).slice(0, 2).join('.')}` : ''}`
      : 'none';

    if (isDev) {
      console.groupCollapsed('[clipboard] Paste button clicked');
      console.log('isSecureContext:', (globalThis as any).isSecureContext);
      console.log('navigator.clipboard available:', !!navigator.clipboard);
      console.log('navigator.clipboard.readText available:', !!navigator.clipboard?.readText);
      console.log('activeElement before:', activeElDesc);
      console.groupEnd();
    }

    // Always keep focus on the code field so Ctrl+V goes to the right place
    codeInputRef.current?.focus({ preventScroll: true });
    codeInputRef.current?.select();

    // Best effort: read clipboard directly (only works when browser allows it)
    try {
      if (!navigator.clipboard?.readText) {
        throw Object.assign(new Error('Clipboard API not available'), { name: 'ClipboardUnavailable' });
      }

      const text = await navigator.clipboard.readText();
      if (isDev) console.log('[clipboard] readText result:', { text });

      const digits = text.trim().replace(/\D/g, '');
      if (!/^\d{3}$/.test(digits)) {
        setPasteError('Code must be exactly 3 digits (e.g., "123")');
        setTimeout(() => setPasteError(null), 3000);
        return;
      }

      setRoomCode(digits);
      setPasteError(null);
    } catch (err: any) {
      const name = err?.name || 'UnknownError';
      const message = err?.message || String(err);

      if (isDev) {
        console.groupCollapsed('[clipboard] readText FAILED');
        console.log('name:', name);
        console.log('message:', message);
        console.log('error:', err);
        console.log('activeElement after focus:', document.activeElement);
        console.groupEnd();
      }

      // We cannot programmatically paste without clipboard read permission.
      // Keep focus on the code field and show a precise reason instead of a vague "timed out".
      setPasteError(`Clipboard blocked (${name}). Click the code field and press Ctrl+V.`);
      setTimeout(() => setPasteError(null), 4000);
    }
  };

  const canJoin = !!name.trim() && roomCode.length === 3 && !isConnecting;
  const canStartAi = !!name.trim() && !isConnecting;

  return (
    <div className={clsx(
      // Important: keep this wrapper free of CSS transforms so the mobile fixed Join CTA
      // remains truly viewport-sticky (transformed ancestors break position: fixed).
      "w-full max-w-md flex flex-col gap-4 sm:gap-6",
      // Make room for the fixed mobile Join CTA bar (join tab only)
      (isJoinTab || isAiTab) && "pb-24 sm:pb-0"
    )}>
      
      {/* Header */}
      <div className="text-center space-y-1.5 sm:space-y-2 mb-1 sm:mb-2">
        <h1 className="text-3xl font-black tracking-tight flex items-center justify-center gap-3">
          <Gamepad2 className="w-8 h-8 text-indigo-400" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
          Albin's Tic Tac Toe
          </span>
          <span className="text-[10px] font-semibold text-slate-400/60 tracking-normal translate-y-[2px] select-none">
            v{__APP_VERSION__}
          </span>
        </h1>
        <a 
          href="https://github.com/ajnaduvil/albins-tic-tac-toe" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-indigo-400 transition-colors"
          title="View source code on GitHub"
        >
          <Github className="w-3.5 h-3.5" />
          <span>View on GitHub</span>
        </a>
      </div>

      <div className="relative rounded-3xl p-[1px] bg-gradient-to-br from-white/15 via-white/5 to-white/10 shadow-2xl animate-scale-in">
        <div className="relative bg-slate-950/45 backdrop-blur-xl p-4 sm:p-6 rounded-3xl border border-white/10 overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent" />
          <div className="relative">
            {/* Name Input - Always Visible */}
            <div className="mb-4 sm:mb-6">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1.5 block">Your Name</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-300 transition-colors" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your nickname"
                  className="w-full bg-slate-950/40 border border-white/10 focus:border-indigo-400/70 focus:ring-2 focus:ring-indigo-500/20 rounded-xl py-3 sm:py-3.5 pl-12 pr-4 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all"
                  maxLength={12}
                />
              </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-slate-950/40 rounded-xl mb-6 border border-white/10">
              <button
                onClick={() => setActiveTab('create')}
                className={clsx(
                  "flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2",
                  activeTab === 'create'
                    ? "bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <Gamepad2 className="w-4 h-4" />
                <span className="sm:hidden">Create</span>
                <span className="hidden sm:inline">Create Room</span>
              </button>
              <button
                onClick={() => setActiveTab('join')}
                className={clsx(
                  "flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2",
                  activeTab === 'join'
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <Users className="w-4 h-4" />
                <span className="sm:hidden">Join</span>
                <span className="hidden sm:inline">Join Room</span>
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={clsx(
                  "flex-1 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 sm:gap-2",
                  activeTab === 'ai'
                    ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <Cpu className="w-4 h-4" />
                <span className="sm:hidden">AI</span>
                <span className="hidden sm:inline">Vs AI</span>
              </button>
            </div>

        {/* Create Tab Content */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreate} className="space-y-5 animate-fade-in">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Grid Size</label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {GRID_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setGridSize(size)}
                    className={clsx(
                      "flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 transition-all relative overflow-hidden",
                      gridSize === size 
                        ? "border-indigo-500 bg-indigo-500/20 text-indigo-300" 
                        : "border-slate-700 bg-slate-900/30 text-slate-500 hover:border-slate-600 hover:bg-slate-800"
                    )}
                  >
                    {gridSize === size && <div className="absolute top-1 right-1"><Check className="w-3 h-3" /></div>}
                    <span className="text-lg font-bold leading-none">{size}x{size}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center justify-between">
                <span>Win Condition</span>
                <span className="text-[10px] text-slate-500 normal-case bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                  Target to win
                </span>
              </label>
              <div className="flex justify-center gap-2">
                {WIN_CONDITIONS.filter((num) => num <= gridSize).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setWinCondition(num)}
                    className={clsx(
                      "w-12 sm:w-14 flex items-center justify-center py-2 rounded-xl border-2 transition-all",
                      winCondition === num
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-slate-700 bg-slate-900/30 text-slate-500 hover:border-slate-600 hover:bg-slate-800"
                    )}
                  >
                    <span className="text-sm font-bold">{num}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isConnecting || !name.trim()}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 mt-4"
            >
              {isConnecting ? 'Creating...' : 'Create Room & Play'}
            </button>
          </form>
        )}

        {/* Join Tab Content */}
        {activeTab === 'join' && (
          <form onSubmit={handleJoin} className="animate-fade-in flex flex-col gap-3 sm:gap-5">
            {/* Content area (can scroll on very small heights) */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3 pb-6 sm:pb-0">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Room Code</label>
              
              {/* Code Display with Inline Paste Button */}
              <div className="relative group">
                <Gamepad2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors z-10" />
                {/* Hidden input for paste functionality */}
                <input
                  ref={codeInputRef}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={roomCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 3);
                    setRoomCode(val);
                    setPasteError(null);
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 3);
                    if (isDev) console.log('[clipboard] input onPaste:', { pasted });
                    if (pasted.length === 3) {
                      setRoomCode(pasted);
                      setPasteError(null);
                    } else if (pasted.length > 0) {
                      setPasteError('Code must be exactly 3 digits');
                      setTimeout(() => setPasteError(null), 2000);
                    }
                  }}
                  onFocus={(e) => {
                    e.target.select();
                  }}
                  onClick={(e) => {
                    e.target.select();
                  }}
                  className="absolute inset-0 w-full h-full bg-transparent border-none outline-none text-transparent caret-transparent cursor-text z-[1]"
                  placeholder=""
                  maxLength={3}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  tabIndex={0}
                />
                <div className="w-full bg-slate-900/50 border-2 border-slate-700 group-focus-within:border-emerald-500 rounded-xl py-3 sm:py-4 pl-12 pr-12 text-slate-100 font-mono tracking-[0.25em] sm:tracking-[0.3em] text-xl sm:text-2xl text-center min-h-[52px] sm:min-h-[60px] flex items-center justify-center pointer-events-none relative z-0">
                  {roomCode.padEnd(3, '•').split('').map((char, idx) => (
                    <span key={idx} className={clsx(
                      "inline-block w-8",
                      idx < roomCode.length ? "text-emerald-400" : "text-slate-600"
                    )}>
                      {char}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    // Critical: prevent the button from stealing focus so Ctrl+V pastes into the code field.
                    e.preventDefault();
                    e.stopPropagation();
                    codeInputRef.current?.focus({ preventScroll: true });
                    codeInputRef.current?.select();
                  }}
                  onClick={handlePaste}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 hover:border-slate-600 rounded-lg text-slate-400 hover:text-slate-300 transition-all active:scale-95 z-10"
                  title="Paste from clipboard"
                >
                  <Clipboard className="w-4 h-4" />
                </button>
              </div>

              {/* Paste Error */}
              {pasteError && (
                <div className="text-center text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {pasteError}
                </div>
              )}

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      if (roomCode.length < 3) {
                        setRoomCode(roomCode + num.toString());
                      }
                    }}
                    disabled={roomCode.length >= 3}
                    className={clsx(
                      "py-3 sm:py-4 rounded-xl border-2 font-bold text-lg transition-all",
                      "bg-slate-800/50 border-slate-700 text-slate-200",
                      "hover:bg-emerald-600/20 hover:border-emerald-500/50 hover:text-emerald-300",
                      "active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-800/50 disabled:hover:border-slate-700"
                    )}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    if (roomCode.length > 0) {
                      setRoomCode(roomCode.slice(0, -1));
                    }
                  }}
                  disabled={roomCode.length === 0}
                  className={clsx(
                    "py-3 sm:py-4 rounded-xl border-2 font-bold transition-all",
                    "bg-slate-800/50 border-slate-700 text-slate-400",
                    "hover:bg-red-600/20 hover:border-red-500/50 hover:text-red-300",
                    "active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-800/50"
                  )}
                  aria-label="Delete"
                >
                  <Delete className="w-5 h-5 mx-auto" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (roomCode.length < 3) {
                      setRoomCode(roomCode + '0');
                    }
                  }}
                  disabled={roomCode.length >= 3}
                  className={clsx(
                    "py-3 sm:py-4 rounded-xl border-2 font-bold text-lg transition-all",
                    "bg-slate-800/50 border-slate-700 text-slate-200",
                    "hover:bg-emerald-600/20 hover:border-emerald-500/50 hover:text-emerald-300",
                    "active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-slate-800/50 disabled:hover:border-slate-700"
                  )}
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setRoomCode('')}
                  disabled={roomCode.length === 0}
                  className={clsx(
                    "py-3 sm:py-4 rounded-xl border-2 font-bold text-xs sm:text-sm transition-all",
                    "bg-slate-800/50 border-slate-700 text-slate-400",
                    "hover:bg-slate-700/50 hover:border-slate-600 hover:text-slate-300",
                    "active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                  )}
                >
                  Clear
                </button>
              </div>
              
              <p className="text-[10px] sm:text-xs text-slate-500 ml-1 text-center">Ask your friend for the code shown in their room.</p>
            </div>

            {/* Desktop Join button (mobile uses fixed bottom bar below) */}
            <button
              type="submit"
              disabled={!canJoin}
              className="hidden sm:block w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
            >
              {isConnecting ? 'Connecting...' : 'Join Game'}
            </button>
          </form>
        )}

        {/* AI Tab Content */}
        {activeTab === 'ai' && (
          <form onSubmit={handleStartAi} className="space-y-5 animate-fade-in">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Grid Size</label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {GRID_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setGridSize(size)}
                    className={clsx(
                      "flex flex-col items-center justify-center gap-1 py-3 rounded-xl border-2 transition-all relative overflow-hidden",
                      gridSize === size
                        ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                        : "border-slate-700 bg-slate-900/30 text-slate-500 hover:border-slate-600 hover:bg-slate-800"
                    )}
                  >
                    {gridSize === size && <div className="absolute top-1 right-1"><Check className="w-3 h-3" /></div>}
                    <span className="text-lg font-bold leading-none">{size}x{size}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 flex items-center justify-between">
                <span>Win Condition</span>
                <span className="text-[10px] text-slate-500 normal-case bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                  Target to win
                </span>
              </label>
              <div className="flex justify-center gap-2">
                {WIN_CONDITIONS.filter((num) => num <= gridSize).map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setWinCondition(num)}
                    className={clsx(
                      "w-12 sm:w-14 flex items-center justify-center py-2 rounded-xl border-2 transition-all",
                      winCondition === num
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-slate-700 bg-slate-900/30 text-slate-500 hover:border-slate-600 hover:bg-slate-800"
                    )}
                  >
                    <span className="text-sm font-bold">{num}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Difficulty</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['easy', 'medium', 'hard', 'extreme'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setAiDifficulty(lvl)}
                    className={clsx(
                      "py-3 rounded-xl border-2 font-bold text-xs sm:text-sm transition-all",
                      aiDifficulty === lvl
                        ? "border-amber-500 bg-amber-500/20 text-amber-200"
                        : "border-slate-700 bg-slate-900/30 text-slate-500 hover:border-slate-600 hover:bg-slate-800"
                    )}
                  >
                    {lvl.toUpperCase()}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 ml-1">
                Hard is unbeatable on 3x3. Extreme thinks longer on larger boards for tougher play.
              </p>
            </div>

            <button
              type="submit"
              disabled={!canStartAi}
              className="hidden sm:block w-full py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-amber-500/20 mt-4"
            >
              Start Vs AI
            </button>
          </form>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center font-medium animate-pulse">
            {error}
          </div>
        )}
          </div>
        </div>
      </div>

      {/* Mobile fixed Join CTA (always visible, no cut-off) */}
      {isJoinTab && (
        <div className="sm:hidden fixed left-0 right-0 bottom-0 z-[9999] px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-slate-950/95 backdrop-blur border-t border-white/10">
          <button
            type="button"
            onClick={doJoin}
            disabled={!canJoin}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl font-black transition-all shadow-xl shadow-emerald-500/20"
          >
            {isConnecting ? 'Connecting...' : 'Join Game'}
          </button>
        </div>
      )}

      {/* Mobile fixed Vs AI CTA (sticky) */}
      {isAiTab && (
        <div className="sm:hidden fixed left-0 right-0 bottom-0 z-[9999] px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-slate-950/95 backdrop-blur border-t border-white/10">
          <button
            type="button"
            onClick={doStartAi}
            disabled={!canStartAi}
            className="w-full py-3.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white rounded-xl font-black transition-all shadow-xl shadow-amber-500/20"
          >
            Start Vs AI
          </button>
        </div>
      )}
    </div>
  );
};

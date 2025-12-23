import React, { useState, useEffect } from 'react';
import { Gamepad2, Users, User, Grid3x3, Grid, LayoutGrid, Trophy, Check, Delete, Github } from 'lucide-react';
import clsx from 'clsx';

interface WelcomeScreenProps {
  onCreate: (name: string, gridSize: number, winCondition: number) => void;
  onJoin: (code: string, name: string) => void;
  isConnecting: boolean;
  error: string | null;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onCreate, onJoin, isConnecting, error }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');
  
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
  
  const [roomCode, setRoomCode] = useState('');

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
    if (name.trim() && roomCode.trim()) {
      // Only save name for joiners
      try { localStorage.setItem('peer_tactoe_name', name.trim()); } catch {}
      onJoin(roomCode.trim(), name.trim());
    }
  };

  return (
    <div className="w-full max-w-md flex flex-col gap-4 sm:gap-6 animate-scale-in">
      
      {/* Header */}
      <div className="text-center space-y-1.5 sm:space-y-2 mb-1 sm:mb-2">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300 tracking-tight flex items-center justify-center gap-3">
          <Gamepad2 className="w-8 h-8 text-indigo-400" />
          Albin's Tic Tac Toe
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

      <div className="bg-slate-800/50 backdrop-blur-xl p-4 sm:p-6 rounded-3xl border border-slate-700 shadow-2xl">
        {/* Name Input - Always Visible */}
        <div className="mb-4 sm:mb-6">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1.5 block">Your Name</label>
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your nickname"
              className="w-full bg-slate-900/50 border border-slate-700 focus:border-indigo-500 rounded-xl py-3 sm:py-3.5 pl-12 pr-4 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all"
              maxLength={12}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-slate-900/50 rounded-xl mb-6 border border-slate-700/50">
          <button
            onClick={() => setActiveTab('create')}
            className={clsx(
              "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
              activeTab === 'create' ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Gamepad2 className="w-4 h-4" /> Create Room
          </button>
          <button
            onClick={() => setActiveTab('join')}
            className={clsx(
              "flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2",
              activeTab === 'join' ? "bg-emerald-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Users className="w-4 h-4" /> Join Room
          </button>
        </div>

        {/* Create Tab Content */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreate} className="space-y-5 animate-fade-in">
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Grid Size</label>
              <div className="grid grid-cols-4 gap-2">
                {[3, 4, 5, 6].map((size) => (
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
              <div className="flex gap-2">
                {[3, 4, 5, 6].map((num) => {
                  if (num > gridSize) return null;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setWinCondition(num)}
                      className={clsx(
                        "flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-xl border-2 transition-all",
                        winCondition === num
                          ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                          : "border-slate-700 bg-slate-900/30 text-slate-500 hover:border-slate-600 hover:bg-slate-800"
                      )}
                    >
                      <span className="text-sm font-bold">{num}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isConnecting || !name.trim()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20 mt-4"
            >
              {isConnecting ? 'Creating...' : 'Create Room & Play'}
            </button>
          </form>
        )}

        {/* Join Tab Content */}
        {activeTab === 'join' && (
          <form onSubmit={handleJoin} className="animate-fade-in flex flex-col gap-3 sm:gap-5">
            {/* Content area (can scroll on very small heights) */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Room Code</label>
              
              {/* Code Display */}
              <div className="relative group">
                <Gamepad2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                <div className="w-full bg-slate-900/50 border-2 border-slate-700 focus-within:border-emerald-500 rounded-xl py-3 sm:py-4 pl-12 pr-4 text-slate-100 font-mono tracking-[0.25em] sm:tracking-[0.3em] text-xl sm:text-2xl text-center min-h-[52px] sm:min-h-[60px] flex items-center justify-center">
                  {roomCode.padEnd(3, '•').split('').map((char, idx) => (
                    <span key={idx} className={clsx(
                      "inline-block w-8",
                      idx < roomCode.length ? "text-emerald-400" : "text-slate-600"
                    )}>
                      {char}
                    </span>
                  ))}
                </div>
              </div>

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

            {/* Sticky CTA (always visible on mobile) */}
            <div className="sticky bottom-0 pt-2 bg-gradient-to-t from-slate-800/95 via-slate-800/70 to-transparent backdrop-blur">
              <button
                type="submit"
                disabled={isConnecting || !name.trim() || roomCode.length !== 3}
                className="w-full py-3.5 sm:py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20"
              >
                {isConnecting ? 'Connecting...' : 'Join Game'}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center font-medium animate-pulse">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { Gamepad2, Users, User, Grid3x3, Grid, LayoutGrid, Trophy, Check } from 'lucide-react';
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
    <div className="w-full max-w-md flex flex-col gap-6 animate-scale-in">
      
      {/* Header */}
      <div className="text-center space-y-2 mb-2">
        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300 tracking-tight flex items-center justify-center gap-3">
          <Gamepad2 className="w-8 h-8 text-indigo-400" />
          Albin's Tic Tac Toe
        </h1>
      </div>

      <div className="bg-slate-800/50 backdrop-blur-xl p-6 rounded-3xl border border-slate-700 shadow-2xl">
        {/* Name Input - Always Visible */}
        <div className="mb-6">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1.5 block">Your Name</label>
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your nickname"
              className="w-full bg-slate-900/50 border border-slate-700 focus:border-indigo-500 rounded-xl py-3.5 pl-12 pr-4 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all"
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
          <form onSubmit={handleJoin} className="space-y-5 animate-fade-in">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Room Code</label>
              <div className="relative group">
                <Gamepad2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                <input
                  type="number"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="e.g. 123"
                  className="w-full bg-slate-900/50 border border-slate-700 focus:border-emerald-500 rounded-xl py-3.5 pl-12 pr-4 text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all font-mono tracking-wider text-lg"
                  maxLength={4}
                  required
                />
              </div>
              <p className="text-xs text-slate-500 ml-1">Ask your friend for the code shown in their room.</p>
            </div>

            <button
              type="submit"
              disabled={isConnecting || !name.trim() || !roomCode.trim()}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 mt-4"
            >
              {isConnecting ? 'Connecting...' : 'Join Game'}
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
  );
};
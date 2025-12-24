import React, { useEffect, useMemo, useRef } from 'react';
import type { AiLevel, GameState, Player } from '../types';
import { X, Circle, RefreshCw, LogOut } from 'lucide-react';
import clsx from 'clsx';
import confetti from 'canvas-confetti';

interface SinglePlayerBoardProps {
  gameState: GameState;
  playerName: string;
  aiName: string;
  scores: { X: number; O: number };
  difficulty: AiLevel;
  aiThinking: boolean;
  onMove: (index: number) => void;
  onReset: () => void;
  onLeave: () => void;
}

export const SinglePlayerBoard: React.FC<SinglePlayerBoardProps> = ({
  gameState,
  playerName,
  aiName,
  scores,
  difficulty,
  aiThinking,
  onMove,
  onReset,
  onLeave,
}) => {
  const { board, currentPlayer, status, winner, winningLine, gridSize, winCondition } = gameState;
  const isGameOver = status === 'winner' || status === 'draw';
  const endCelebrationRef = useRef(false);

  const statusText = useMemo(() => {
    if (status === 'winner') return winner === 'X' ? 'You Won!' : 'You Lost!';
    if (status === 'draw') {
      const boardIsFull = board.every((cell) => cell !== null);
      return boardIsFull ? "🤝 It's a Draw!" : "🤝 No one can win from here — Draw!";
    }
    if (currentPlayer === 'X') return 'Your Turn';
    return aiThinking ? 'AI thinking…' : "AI's Turn";
  }, [aiThinking, board, currentPlayer, status, winner]);

  // Confetti: only when player wins (X) or when game is a draw.
  useEffect(() => {
    if (status === 'playing') {
      endCelebrationRef.current = false;
      return;
    }

    if (endCelebrationRef.current) return;

    if (status === 'winner' && winner === 'X') {
      endCelebrationRef.current = true;
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#818cf8', '#a78bfa', '#f472b6', '#60a5fa', '#38bdf8'],
      });
      return;
    }

    if (status === 'draw') {
      endCelebrationRef.current = true;
      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d', '#fde047'],
      });
    }
  }, [status, winner]);

  const PlayerBadge = ({ player, name, score }: { player: Player; name: string; score: number }) => {
    const isCurrent = status === 'playing' && currentPlayer === player;
    const isWinner = status === 'winner' && winner === player;
    const theme = player === 'X'
      ? {
          border: 'border-indigo-400/55',
          bg: 'bg-indigo-500/22',
          ring: 'ring-indigo-300/60',
          icon: 'text-indigo-300',
        }
      : {
          border: 'border-emerald-400/55',
          bg: 'bg-emerald-500/22',
          ring: 'ring-emerald-300/60',
          icon: 'text-emerald-300',
        };

    return (
      <div
        className={clsx(
          'relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-500 flex-1 min-w-0 overflow-hidden',
          theme.border,
          theme.bg,
          isCurrent && 'scale-[1.02] ring-2',
          isCurrent && theme.ring,
          isWinner && clsx(
            'opacity-100 scale-[1.06]',
            'border-amber-400/60 bg-gradient-to-br from-amber-500/20 via-yellow-500/25 to-amber-600/20',
            'shadow-2xl shadow-amber-500/30',
            'animate-winner-celebration'
          )
        )}
      >
        {isWinner && (
          <div className="absolute inset-0 rounded-xl opacity-60 animate-badge-highlight-sweep bg-gradient-to-r from-transparent via-amber-400/80 to-transparent" />
        )}

        <div
          className={clsx(
            'relative z-10 w-8 h-8 rounded-lg bg-slate-950/40 border border-white/10 flex items-center justify-center transition-all duration-500',
            isWinner && 'scale-110 bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 border-amber-300 shadow-lg shadow-amber-400/50 animate-winner-avatar'
          )}
        >
          {player === 'X' ? (
            <X className={clsx('w-5 h-5', theme.icon)} strokeWidth={2.5} />
          ) : (
            <Circle className={clsx('w-5 h-5', theme.icon)} strokeWidth={2.5} />
          )}
        </div>
        <div className="relative z-10 min-w-0">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {player === 'X' ? 'YOU' : 'AI'}
          </div>
          <div className="text-sm font-semibold text-white truncate">{name}</div>
        </div>
        <div className="relative z-10 ml-auto text-xl font-black text-slate-200">{score}</div>
      </div>
    );
  };

  const iconSizeClass = gridSize === 3 ? 'w-16 h-16' : gridSize === 4 ? 'w-10 h-10' : 'w-6 h-6';

  return (
    <div className="relative w-full max-w-lg">
      <div
        className={clsx(
          'flex flex-col items-center gap-3 p-3 rounded-3xl border border-white/10 bg-slate-950/40 backdrop-blur-xl shadow-2xl ring-1 ring-white/5 overflow-hidden',
          isGameOver && 'pb-24 sm:pb-3'
        )}
      >
        {/* Top bar */}
        <div className="w-full flex items-center justify-between bg-slate-950/45 backdrop-blur-sm p-2.5 rounded-xl border border-white/10 shadow-xl ring-1 ring-white/5">
          <div className="min-w-0">
            <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-0.5">Vs AI</div>
            <div className="text-sm font-bold text-white truncate">
              Difficulty: <span className="text-amber-300">{difficulty.toUpperCase()}</span>
            </div>
          </div>

          <button
            onClick={onLeave}
            className="p-2 bg-white/5 hover:bg-red-500/15 text-slate-400 hover:text-red-300 rounded-lg transition-colors border border-white/10 hover:border-red-500/30"
            title="Back to menu"
            aria-label="Back to menu"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Players */}
        <div className="w-full grid grid-cols-2 gap-2">
          <PlayerBadge player="X" name={playerName} score={scores.X} />
          <PlayerBadge player="O" name={aiName} score={scores.O} />
        </div>

        {/* Status */}
        <div
          className={clsx(
            'w-full py-2 rounded-lg font-semibold text-sm sm:text-base transition-all duration-300 flex items-center justify-center border',
            status === 'winner' && winner === 'X' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
            status === 'winner' && winner === 'O' ? 'bg-red-500/10 text-red-300 border-red-500/30' :
            status === 'draw' ? 'bg-amber-500/15 text-amber-300 border-amber-400/40' :
            currentPlayer === 'X' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' :
            'bg-slate-800/30 text-slate-400 border-slate-700/30'
          )}
        >
          {statusText}
        </div>

        {/* Grid */}
        <div className="w-full max-w-[400px] aspect-square relative">
          <div
            className={clsx(
              'absolute inset-0 bg-slate-700/50 border shadow-2xl transition-all duration-500',
              currentPlayer === 'X' && status === 'playing' && !aiThinking
                ? 'border-indigo-300/55 ring-2 ring-indigo-300/55'
                : 'border-white/10'
            )}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              gridTemplateRows: `repeat(${gridSize}, 1fr)`,
              gap: '3px',
              padding: '3px',
            }}
          >
            {board.map((cell, index) => {
              const isWinningCell = winningLine?.includes(index);
              const canClick = !cell && status === 'playing' && currentPlayer === 'X' && !aiThinking;
              const winnerIsX = winner === 'X';

              return (
                <button
                  key={index}
                  onClick={() => onMove(index)}
                  disabled={!canClick}
                  className={clsx(
                    'relative flex items-center justify-center transition-all duration-200 w-full h-full overflow-hidden',
                    isWinningCell ? 'bg-slate-950/70' : 'bg-slate-950/80',
                    canClick ? 'hover:bg-slate-900/50 cursor-pointer' : 'cursor-default',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/5',
                    canClick && 'ring-indigo-300/45 hover:ring-indigo-200/70 focus-visible:outline-none focus-visible:ring-2'
                  )}
                >
                  {isWinningCell && (
                    <div className="pointer-events-none absolute inset-0">
                      <div
                        className={clsx(
                          'absolute inset-0 bg-gradient-to-br',
                          winnerIsX
                            ? 'from-indigo-500/35 via-purple-500/18 to-fuchsia-500/12'
                            : 'from-emerald-500/30 via-teal-500/16 to-cyan-500/12'
                        )}
                      />
                      <div
                        className={clsx(
                          'absolute inset-0 ring-2',
                          winnerIsX ? 'ring-indigo-200/65' : 'ring-emerald-200/65'
                        )}
                      />
                    </div>
                  )}

                  <div className={clsx('relative z-10 transition-all duration-300 transform scale-0', cell && 'scale-100')}>
                    {cell === 'X' && <X className={clsx(iconSizeClass, isWinningCell ? 'text-indigo-200' : 'text-indigo-400')} strokeWidth={2.5} />}
                    {cell === 'O' && <Circle className={clsx(iconSizeClass, isWinningCell ? 'text-emerald-200' : 'text-emerald-400')} strokeWidth={2.5} />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Winning line connector */}
          {status === 'winner' && winner && winningLine && winningLine.length >= 2 && (() => {
            const first = winningLine[0]!;
            const last = winningLine[winningLine.length - 1]!;
            const rowCol = (i: number) => ({ r: Math.floor(i / gridSize), c: i % gridSize });
            const a = rowCol(first);
            const b = rowCol(last);
            const x1 = ((a.c + 0.5) / gridSize) * 100;
            const y1 = ((a.r + 0.5) / gridSize) * 100;
            const x2 = ((b.c + 0.5) / gridSize) * 100;
            const y2 = ((b.r + 0.5) / gridSize) * 100;
            const id = winner === 'X' ? 'ai-win-line-x' : 'ai-win-line-o';

            return (
              <svg
                className="absolute inset-[3px] pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id={`${id}-grad`} x1={x1} y1={y1} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
                    {winner === 'X' ? (
                      <>
                        <stop offset="0%" stopColor="rgba(99,102,241,0.95)" />
                        <stop offset="50%" stopColor="rgba(168,85,247,0.95)" />
                        <stop offset="100%" stopColor="rgba(236,72,153,0.92)" />
                      </>
                    ) : (
                      <>
                        <stop offset="0%" stopColor="rgba(16,185,129,0.92)" />
                        <stop offset="55%" stopColor="rgba(20,184,166,0.92)" />
                        <stop offset="100%" stopColor="rgba(6,182,212,0.90)" />
                      </>
                    )}
                  </linearGradient>
                  <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="1.6" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Glow */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={`url(#${id}-grad)`}
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity="0.28"
                  filter={`url(#${id}-glow)`}
                />
                {/* Crisp connector */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={`url(#${id}-grad)`}
                  strokeWidth="3.25"
                  strokeLinecap="round"
                  opacity="0.78"
                />
              </svg>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="w-full flex items-center justify-between text-xs text-slate-500">
          <span>Goal: {winCondition} in a row</span>
          <span>{gridSize}x{gridSize}</span>
        </div>

        {isGameOver && (
          <button
            onClick={onReset}
            className={clsx(
              'hidden sm:flex w-full items-center justify-center rounded-xl font-bold mt-2 group relative overflow-hidden',
              'px-8 py-3',
              'text-white bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500',
              'hover:from-amber-400 hover:via-orange-400 hover:to-rose-400',
              'border border-white/10 ring-1 ring-white/10',
              'shadow-xl shadow-amber-500/20 transition-all active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70'
            )}
          >
            <span className="relative z-10 flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Play Again
            </span>
          </button>
        )}
      </div>

      {/* Mobile: sticky Play Again bar (outside containers so position: fixed stays viewport-sticky) */}
      {isGameOver && (
        <div className="sm:hidden fixed left-0 right-0 bottom-0 z-[9999] px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-slate-950/95 backdrop-blur border-t border-white/10">
          <button
            type="button"
            onClick={onReset}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 hover:from-amber-400 hover:via-orange-400 hover:to-rose-400 text-white rounded-xl font-black transition-all shadow-xl shadow-amber-500/20 border border-white/10 ring-1 ring-white/10"
          >
            <span className="flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Play Again
            </span>
          </button>
        </div>
      )}
    </div>
  );
};



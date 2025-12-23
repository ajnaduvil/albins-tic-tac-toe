import React, { useState, useEffect, useRef } from 'react';
import { GameState, Player } from '../types';
import { X, Circle, RefreshCw, Copy, LogOut, Trophy, BellRing, MessageSquare, Send, Plus, Trash2, MessageCircle } from 'lucide-react';
import clsx from 'clsx';
import confetti from 'canvas-confetti';

interface GameBoardProps {
  gameState: GameState;
  myPlayer: Player | null;
  roomCode: string;
  isHost: boolean;
  myName: string;
  opponentName: string;
  scores: { X: number; O: number };
  onMove: (index: number) => void;
  onReset: () => void;
  onLeave: () => void;
  incomingEmoji: string | null;
  myEmoji: string | null;
  onSendEmoji: (emoji: string) => void;
  onSendNudge: () => void;
  isNudged: boolean;
  incomingMessage: string | null;
  onSendChat: (text: string) => void;
}

const EMOJIS = ['😂', '😎', '😡', '😭', '🤔', '👋'];
const DEFAULT_PRESETS = ['Nice move!', 'GG', 'Unlucky', 'Rematch?', 'Hurry up!'];

export const GameBoard: React.FC<GameBoardProps> = ({ 
  gameState, 
  myPlayer, 
  roomCode,
  myName,
  opponentName,
  scores, 
  onMove, 
  onReset,
  onLeave,
  incomingEmoji,
  myEmoji,
  onSendEmoji,
  onSendNudge,
  isNudged,
  incomingMessage,
  onSendChat
}) => {
  const { board, currentPlayer, status, winner, winningLine, gridSize, winCondition } = gameState;
  const isMyTurn = status === 'playing' && currentPlayer === myPlayer;
  const isOpponentTurn = status === 'playing' && currentPlayer !== myPlayer;
  const [justNudged, setJustNudged] = useState(false);
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [presets, setPresets] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('peer_tactoe_presets');
      return saved ? JSON.parse(saved) : DEFAULT_PRESETS;
    } catch {
      return DEFAULT_PRESETS;
    }
  });

  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'winner' && winner === myPlayer) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [status, winner, myPlayer]);

  useEffect(() => {
    if (isChatOpen && chatInputRef.current) {
        chatInputRef.current.focus();
    }
  }, [isChatOpen]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  const handleNudge = () => {
    if (!justNudged) {
        onSendNudge();
        setJustNudged(true);
        setTimeout(() => setJustNudged(false), 5000); // Cooldown
    }
  };

  const handleSendChat = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) {
        onSendChat(trimmed.slice(0, 50)); // Max 50 chars
        setIsChatOpen(false);
        setChatInput('');
    }
  };

  const addPreset = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (trimmed && !presets.includes(trimmed)) {
        const newPresets = [...presets, trimmed];
        setPresets(newPresets);
        localStorage.setItem('peer_tactoe_presets', JSON.stringify(newPresets));
        setChatInput('');
    }
  };

  const deletePreset = (index: number) => {
      const newPresets = presets.filter((_, i) => i !== index);
      setPresets(newPresets);
      localStorage.setItem('peer_tactoe_presets', JSON.stringify(newPresets));
  };

  const getStatusMessage = () => {
    if (status === 'winner') return winner === myPlayer ? 'You Won!' : `${opponentName} Won!`;
    if (status === 'draw') return "It's a Draw!";
    if (isMyTurn) return "Your Turn";
    return `${opponentName}'s Turn`;
  };

  const PlayerBadge = ({ player, name, score, isMe, emoji, message }: { player: Player, name: string, score: number, isMe: boolean, emoji: string | null, message?: string | null }) => (
    <div className={clsx(
      "relative flex items-center gap-3 px-4 py-2 rounded-xl border transition-all duration-300 flex-1 min-w-0",
      player === 'X' ? "border-indigo-500/30 bg-indigo-500/10" : "border-emerald-500/30 bg-emerald-500/10",
      currentPlayer === player && status === 'playing' ? "ring-2 ring-offset-2 ring-offset-slate-900 ring-slate-400 opacity-100 scale-105 shadow-lg" : "opacity-70"
    )}>
      
      {/* Emoji Overlay */}
      {emoji && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 animate-[bounce_1s_infinite] z-30 pointer-events-none">
          <span className="text-5xl drop-shadow-xl filter">{emoji}</span>
        </div>
      )}

      {/* Message Bubble */}
      {message && (
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-40 w-max max-w-[150px] animate-[fade-in-up_0.3s_ease-out]">
            <div className="bg-white text-slate-900 px-3 py-2 rounded-xl rounded-bl-none shadow-xl font-bold text-sm break-words relative">
                {message}
                <div className="absolute bottom-[-6px] left-2 w-0 h-0 border-l-[6px] border-l-transparent border-t-[6px] border-t-white border-r-[6px] border-r-transparent"></div>
            </div>
        </div>
      )}

      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800">
        {player === 'X' ? <X className="w-5 h-5 text-indigo-400" /> : <Circle className="w-5 h-5 text-emerald-400" />}
      </div>
      <div className="flex flex-col min-w-0">
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
           {isMe ? 'YOU' : 'OPPONENT'} 
           {winner === player && <Trophy className="w-3 h-3 text-amber-400" />}
         </span>
         <span className="text-sm font-semibold text-white truncate">{name}</span>
      </div>
      <div className="ml-auto text-xl font-bold text-slate-200">{score}</div>
    </div>
  );

  return (
    <div className={clsx("w-full max-w-lg flex flex-col items-center gap-6 p-4", isNudged && "animate-shake")}>
      
      {/* Top Bar */}
      <div className="w-full flex items-center justify-between bg-slate-800/80 backdrop-blur-sm p-3 rounded-xl border border-slate-700 shadow-xl">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-0.5">Room Code</span>
          <div className="flex items-center gap-2 group cursor-pointer" onClick={copyCode}>
            <span className="text-xl font-mono font-bold text-white tracking-widest group-hover:text-indigo-400 transition-colors">{roomCode}</span>
            <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </div>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end mr-2">
                 <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Goal</span>
                 <span className="text-xs font-bold text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">{winCondition} in a row</span>
            </div>
            
            <button 
                onClick={() => setIsChatOpen(true)}
                className="p-2 bg-slate-700/50 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors border border-transparent hover:border-indigo-500/30"
            >
                <MessageSquare className="w-4 h-4" />
            </button>
            <button onClick={onLeave} className="p-2 bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-500/30">
               <LogOut className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* Players & Score */}
      <div className="w-full flex items-center justify-between gap-3">
         <PlayerBadge 
            player="X" 
            name={myPlayer === 'X' ? myName : opponentName} 
            score={scores.X} 
            isMe={myPlayer === 'X'} 
            emoji={myPlayer === 'X' ? myEmoji : incomingEmoji}
            message={myPlayer === 'X' ? null : incomingMessage}
         />
         <div className="text-slate-600 font-bold text-lg shrink-0">VS</div>
         <PlayerBadge 
            player="O" 
            name={myPlayer === 'O' ? myName : opponentName} 
            score={scores.O} 
            isMe={myPlayer === 'O'} 
            emoji={myPlayer === 'O' ? myEmoji : incomingEmoji}
            message={myPlayer === 'O' ? null : incomingMessage}
         />
      </div>

      {/* Status Bar */}
      <div className="w-full relative z-10">
        <div className={clsx("w-full py-3 px-6 rounded-xl text-center font-bold text-lg transition-all duration-300 shadow-lg",
          status === 'winner' && winner === myPlayer ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-emerald-500/20" :
          status === 'winner' && winner !== myPlayer ? "bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-red-500/20" :
          status === 'draw' ? "bg-slate-700 text-slate-200" :
          isMyTurn ? "bg-indigo-500 text-white shadow-indigo-500/20 scale-105" : "bg-slate-800 text-slate-400"
        )}>
          {getStatusMessage()}
        </div>
        
        {/* Nudge Button */}
        {isOpponentTurn && (
            <button 
                onClick={handleNudge}
                disabled={justNudged}
                className={clsx(
                    "absolute top-1/2 -translate-y-1/2 right-[-10px] sm:right-[-12px] p-2 rounded-full shadow-lg transition-all z-20",
                    justNudged ? "bg-slate-700 text-slate-500 cursor-not-allowed" : "bg-amber-500 text-white hover:bg-amber-400 hover:scale-110 animate-bounce"
                )}
                title="Nudge opponent"
            >
                <BellRing className="w-5 h-5" />
            </button>
        )}
      </div>

      {/* The Grid */}
      <div className="w-full max-w-[400px] aspect-square relative">
        <div 
            className="absolute inset-0 bg-slate-700 rounded-xl overflow-hidden shadow-2xl"
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                gridTemplateRows: `repeat(${gridSize}, 1fr)`,
                gap: '2px', 
                padding: '2px' 
            }}
        >
            {board.map((cell, index) => {
              const isWinningCell = winningLine?.includes(index);
              const canClick = !cell && isMyTurn && status === 'playing';
              const iconSizeClass = gridSize === 3 ? "w-16 h-16" : gridSize === 4 ? "w-10 h-10" : "w-6 h-6";

              return (
                <button
                  key={index}
                  onClick={() => onMove(index)}
                  disabled={!canClick}
                  className={clsx(
                    "relative flex items-center justify-center transition-all duration-200 w-full h-full",
                    isWinningCell ? "bg-amber-900/50" : "bg-slate-900",
                    canClick ? "hover:bg-slate-800 cursor-pointer" : "cursor-default",
                    !cell && !canClick && "opacity-100", 
                  )}
                >
                    {isWinningCell && (
                        <div className="absolute inset-0 border-4 border-amber-400 opacity-50 animate-pulse"></div>
                    )}

                  <div className={clsx("transition-all duration-300 transform scale-0", cell && "scale-100")}>
                    {cell === 'X' && <X className={clsx(iconSizeClass, isWinningCell ? "text-amber-400" : "text-indigo-400")} strokeWidth={2.5} />}
                    {cell === 'O' && <Circle className={clsx(iconSizeClass, isWinningCell ? "text-amber-400" : "text-emerald-400")} strokeWidth={2.5} />}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
       <div className="sm:hidden flex items-center justify-center mt-[-10px]">
            <span className="text-xs font-bold text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">Goal: {winCondition} in a row</span>
      </div>

      {/* Emoji Bar */}
      <div className="w-full flex justify-center gap-2 pt-2">
        <div className="flex bg-slate-800/80 backdrop-blur rounded-full p-2 gap-1 border border-slate-700 shadow-xl overflow-x-auto max-w-full no-scrollbar">
            {EMOJIS.map(emoji => (
                <button
                    key={emoji}
                    onClick={() => {
                        onSendEmoji(emoji);
                    }}
                    className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-xl hover:bg-slate-700 rounded-full transition-transform hover:scale-110 active:scale-95"
                >
                    {emoji}
                </button>
            ))}
        </div>
      </div>

      {/* Game Over Actions */}
      {(status === 'winner' || status === 'draw') && (
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-8 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg animate-fade-in-up mt-2"
        >
          <RefreshCw className="w-5 h-5" />
          Play Again
        </button>
      )}

      {/* Chat Modal */}
      {isChatOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsChatOpen(false)}>
              <div className="bg-slate-800 w-full max-w-sm rounded-t-2xl sm:rounded-2xl border border-slate-700 shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                  <div className="p-4 border-b border-slate-700 flex items-center justify-between bg-slate-800/50">
                      <div className="flex items-center gap-2">
                          <MessageCircle className="w-5 h-5 text-indigo-400" />
                          <h3 className="font-bold text-white">Quick Chat</h3>
                      </div>
                      <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-white">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="p-4 overflow-y-auto space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                          {presets.map((msg, idx) => (
                              <div key={idx} className="group flex gap-1">
                                <button 
                                    onClick={() => handleSendChat(msg)}
                                    className="flex-1 bg-slate-700/50 hover:bg-indigo-600/20 hover:border-indigo-500/50 border border-slate-600 rounded-lg p-3 text-sm font-medium text-slate-200 text-left transition-all truncate"
                                >
                                    {msg}
                                </button>
                                <button onClick={() => deletePreset(idx)} className="px-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                          ))}
                      </div>
                  </div>

                  <div className="p-4 bg-slate-900 border-t border-slate-700">
                      <form onSubmit={e => { e.preventDefault(); handleSendChat(chatInput); }} className="flex gap-2">
                          <input 
                              ref={chatInputRef}
                              value={chatInput}
                              onChange={e => setChatInput(e.target.value)}
                              placeholder="Type a message..."
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                              maxLength={50}
                          />
                          {chatInput.trim() && !presets.includes(chatInput.trim()) ? (
                              <button 
                                type="button" 
                                onClick={addPreset}
                                className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                                title="Save as preset"
                              >
                                  <Plus className="w-5 h-5" />
                              </button>
                          ) : (
                              <button 
                                type="submit"
                                disabled={!chatInput.trim()}
                                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                  <Send className="w-5 h-5" />
                              </button>
                          )}
                      </form>
                      <p className="text-[10px] text-slate-500 mt-2 text-center">Tap 'Plus' to save message as quick reply.</p>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
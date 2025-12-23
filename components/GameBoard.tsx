import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, GameState, Player } from '../types';
import { X, Circle, RefreshCw, Copy, LogOut, Trophy, BellRing, MessageSquare, Send, Plus, Trash2 } from 'lucide-react';
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
  chatMessages: ChatMessage[];
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
  chatMessages,
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
  const chatWidgetRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevChatLenRef = useRef<number>(chatMessages.length);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastBubble, setLastBubble] = useState<{ X: string | null; O: string | null }>({ X: null, O: null });
  const bubbleTimeoutRef = useRef<{ X: number | null; O: number | null }>({ X: null, O: null });

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

  useEffect(() => {
    const prevLen = prevChatLenRef.current;
    const nextLen = chatMessages.length;
    if (nextLen > prevLen) {
      // Only count messages from opponent as unread, and only when popover is closed
      if (!isChatOpen) {
        const newMessages = chatMessages.slice(prevLen);
        const newUnread = myPlayer ? newMessages.filter(m => m.from !== myPlayer).length : newMessages.length;
        if (newUnread > 0) setUnreadCount(c => c + newUnread);
      }
      // Update "last message" bubble for the sender, and auto-hide after a short time
      const newest = chatMessages[nextLen - 1];
      if (newest) {
        const from = newest.from;
        setLastBubble(prev => ({ ...prev, [from]: newest.text }));
        const existing = bubbleTimeoutRef.current[from];
        if (existing) window.clearTimeout(existing);
        bubbleTimeoutRef.current[from] = window.setTimeout(() => {
          setLastBubble(prev => ({ ...prev, [from]: null }));
          bubbleTimeoutRef.current[from] = null;
        }, 5000);
      }
      prevChatLenRef.current = nextLen;
    }
  }, [chatMessages, isChatOpen, myPlayer]);

  useEffect(() => {
    return () => {
      if (bubbleTimeoutRef.current.X) window.clearTimeout(bubbleTimeoutRef.current.X);
      if (bubbleTimeoutRef.current.O) window.clearTimeout(bubbleTimeoutRef.current.O);
    };
  }, []);

  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
      // Scroll to bottom when opening
      requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ block: 'end' }));
    }
  }, [isChatOpen]);

  useEffect(() => {
    if (!isChatOpen) return;
    // Auto-scroll to bottom when new messages arrive while open
    requestAnimationFrame(() => chatEndRef.current?.scrollIntoView({ block: 'end' }));
  }, [chatMessages.length, isChatOpen]);

  useEffect(() => {
    if (!isChatOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!chatWidgetRef.current) return;
      if (chatWidgetRef.current.contains(e.target as Node)) return;
      setIsChatOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
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
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 animate-[bounce_1s_infinite] z-[9998] pointer-events-none">
          <span className="text-5xl drop-shadow-xl filter">{emoji}</span>
        </div>
      )}

      {/* Latest Chat Bubble - Fancy Design */}
      {message && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-[9999] w-max max-w-[180px] animate-[fade-in-up_0.3s_ease-out] animate-float pointer-events-none">
          <div className={clsx(
            "relative px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-2xl font-semibold text-xs break-words",
            "backdrop-blur-md border-2",
            isMe 
              ? "bg-gradient-to-br from-indigo-500/90 via-indigo-600/90 to-purple-600/90 text-white border-indigo-400/50 shadow-indigo-500/30"
              : "bg-gradient-to-br from-slate-700/90 via-slate-800/90 to-slate-900/90 text-slate-100 border-slate-600/50 shadow-slate-700/30"
          )}>
            {/* Glow effect */}
            <div className={clsx(
              "absolute inset-0 rounded-2xl rounded-bl-sm blur-sm opacity-50 -z-10",
              isMe ? "bg-indigo-400" : "bg-slate-500"
            )}></div>
            
            {/* Message content */}
            <div className="relative z-10 leading-relaxed">{message}</div>
            
            {/* Speech bubble tail */}
            <div className={clsx(
              "absolute bottom-[-8px] left-4 w-0 h-0",
              isMe 
                ? "border-l-[8px] border-l-transparent border-t-[8px] border-t-indigo-500/90 border-r-[8px] border-r-transparent"
                : "border-l-[8px] border-l-transparent border-t-[8px] border-t-slate-800/90 border-r-[8px] border-r-transparent"
            )}></div>
            
            {/* Animated pulse ring */}
            <div className={clsx(
              "absolute inset-0 rounded-2xl rounded-bl-sm animate-ping opacity-20",
              isMe ? "bg-indigo-400" : "bg-slate-400"
            )}></div>
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
      <div className="relative z-20 w-full flex items-center justify-between bg-slate-800/80 backdrop-blur-sm p-3 rounded-xl border border-slate-700 shadow-xl">
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
            <button onClick={onLeave} className="p-2 bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-500/30">
               <LogOut className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* Players & Score */}
      <div className="relative z-30 w-full flex items-center justify-between gap-3">
         <PlayerBadge 
            player="X" 
            name={myPlayer === 'X' ? myName : opponentName} 
            score={scores.X} 
            isMe={myPlayer === 'X'} 
            emoji={myPlayer === 'X' ? myEmoji : incomingEmoji}
            message={lastBubble.X}
         />
         <div className="text-slate-600 font-bold text-lg shrink-0">VS</div>
         <PlayerBadge 
            player="O" 
            name={myPlayer === 'O' ? myName : opponentName} 
            score={scores.O} 
            isMe={myPlayer === 'O'} 
            emoji={myPlayer === 'O' ? myEmoji : incomingEmoji}
            message={lastBubble.O}
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

      {/* Floating Chat Widget (bottom-right, agent-style) */}
      <div className="fixed bottom-4 right-4 z-[9999]" ref={chatWidgetRef}>
        {isChatOpen && (
          <div className="mb-3 w-[calc(100vw-2rem)] max-w-sm sm:w-80">
            <div className="bg-slate-800/95 backdrop-blur border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-indigo-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white leading-tight">Chat</div>
                    <div className="text-[10px] text-slate-400 truncate leading-tight">{opponentName}</div>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-white" aria-label="Close chat">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 max-h-[55vh] overflow-y-auto space-y-2">
                {chatMessages.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-6">No messages yet. Say hi!</div>
                ) : (
                  chatMessages.map((m) => {
                    const isMe = m.from === myPlayer;
                    return (
                      <div key={m.id} className={clsx("flex", isMe ? "justify-end" : "justify-start")}>
                        <div className={clsx(
                          "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow border",
                          isMe
                            ? "bg-indigo-500/20 border-indigo-500/30 text-slate-100 rounded-tr-md"
                            : "bg-slate-900/60 border-slate-700 text-slate-200 rounded-tl-md"
                        )}>
                          <div className={clsx("text-[10px] font-bold mb-1", isMe ? "text-indigo-200" : "text-slate-400")}>
                            {isMe ? "You" : m.name}
                          </div>
                          <div className="break-words">{m.text}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="px-3 pb-3 overflow-x-hidden">
                <div className="max-h-24 overflow-y-auto mb-3 pr-1">
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((msg, idx) => (
                      <div key={`${msg}-${idx}`} className="group flex gap-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleSendChat(msg)}
                          className="flex-1 bg-slate-700/40 hover:bg-indigo-600/20 hover:border-indigo-500/50 border border-slate-600 rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 text-left transition-all truncate"
                          title={msg}
                        >
                          {msg}
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePreset(idx)}
                          className="px-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Delete preset"
                          title="Delete preset"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <form onSubmit={e => { e.preventDefault(); handleSendChat(chatInput); }} className="flex gap-1.5 items-center w-full min-w-0">
                  <input 
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1 min-w-0 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    maxLength={50}
                  />
                  <button 
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-600/20 flex-shrink-0"
                    aria-label="Send message"
                    title="Send message"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                  <button 
                    type="button" 
                    onClick={addPreset}
                    disabled={!chatInput.trim() || presets.includes(chatInput.trim())}
                    className="p-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                    title={!chatInput.trim() ? "Type a message to save as preset" : presets.includes(chatInput.trim()) ? "Already saved as preset" : "Save as preset"}
                    aria-label="Save as preset"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </form>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-slate-500">Press Enter to send. Max 50 chars. Use + to save.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setIsChatOpen(o => !o)}
          className="relative w-14 h-14 rounded-full bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-500 transition-colors flex items-center justify-center border border-indigo-400/20"
          aria-label={isChatOpen ? "Close chat" : "Open chat"}
        >
          <MessageSquare className="w-6 h-6" />
          {unreadCount > 0 && !isChatOpen && (
            <span className="absolute -top-1 -right-1 min-w-6 h-6 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border border-slate-900">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

    </div>
  );
};
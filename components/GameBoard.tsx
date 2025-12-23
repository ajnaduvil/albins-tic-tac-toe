import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, GameState, Player } from '../types';
import { X, Circle, RefreshCw, Copy, LogOut, Trophy, BellRing, MessageSquare, Send, Plus, Trash2, Github } from 'lucide-react';
import { emojiData } from 'liveemoji/dist/emojiData';
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

const EMOJIS = ['😂', '😎', '😡', '😭', '🤔', '👋', '🖕'];

const LIVE_EMOJI_MAP = {
  '😂': 'FaceWithTearsOfJoy',
  '😎': 'SmilingFaceWithSunglasses',
  '😡': 'AngryFace',
  '😭': 'LoudlyCryingFace',
  '🤔': 'ThinkingFace',
  '👋': 'WavingHand',
  '🖕': 'MiddleFinger',
} satisfies Record<(typeof EMOJIS)[number], keyof typeof emojiData>;

// Helper to render emoji with animation (LiveEmoji; fallback to Unicode)
const renderEmoji = (emoji: string | null, size: number = 40) => {
  if (!emoji) return null;
  const liveIcon = (LIVE_EMOJI_MAP as Record<string, keyof typeof emojiData | undefined>)[emoji];

  if (liveIcon) {
    const src = emojiData[liveIcon];
    return (
      <img
        src={src}
        alt={liveIcon}
        className="inline-block transition-transform duration-150 hover:scale-110"
        style={{ width: `${size}px`, height: `${size}px` }}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    );
  }

  return (
    <span 
      className="inline-block transition-transform duration-150 hover:scale-110"
      style={{ fontSize: `${size}px`, lineHeight: 1 }}
    >
      {emoji}
    </span>
  );
};
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
  const isGameOver = status === 'winner' || status === 'draw';
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
      "relative flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 rounded-xl border transition-all duration-300 flex-1 min-w-0",
      player === 'X' ? "border-indigo-500/30 bg-indigo-500/10" : "border-emerald-500/30 bg-emerald-500/10",
      // On very small screens, scaling can cause clipping; keep scale for sm+
      currentPlayer === player && status === 'playing'
        ? "ring-2 ring-offset-2 ring-offset-slate-900 ring-slate-400 opacity-100 sm:scale-105 shadow-lg"
        : "opacity-70"
    )}>
      
      {/* Emoji Overlay */}
      {emoji && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 animate-[bounce_1s_infinite] z-[9998] pointer-events-none">
          {renderEmoji(emoji, 64)}
        </div>
      )}

      {/* Latest Chat Bubble - Fancy Design */}
      {message && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-[9999] w-max max-w-[180px] animate-[fade-in-up_0.3s_ease-out] animate-float pointer-events-none">
          <div className={clsx(
            "relative px-4 py-2.5 rounded-2xl rounded-bl-sm shadow-2xl font-semibold text-xs break-words",
            "backdrop-blur-md border-2",
            player === 'X'
              ? "bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white border-indigo-300/90 shadow-indigo-500/50 saturate-125"
              : "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white border-emerald-300/90 shadow-emerald-500/50 saturate-125"
          )}>
            {/* Glow effect */}
            <div className={clsx(
              "absolute inset-0 rounded-2xl rounded-bl-sm blur-sm opacity-50 -z-10",
              player === 'X' ? "bg-indigo-500" : "bg-emerald-500"
            )}></div>
            
            {/* Message content */}
            <div className="relative z-10 leading-relaxed">{message}</div>
            
            {/* Speech bubble tail */}
            <div className={clsx(
              "absolute bottom-[-8px] left-4 w-0 h-0",
              player === 'X'
                ? "border-l-[8px] border-l-transparent border-t-[8px] border-t-indigo-600 border-r-[8px] border-r-transparent"
                : "border-l-[8px] border-l-transparent border-t-[8px] border-t-emerald-600 border-r-[8px] border-r-transparent"
            )}></div>
            
            {/* Animated pulse ring */}
            <div className={clsx(
              "absolute inset-0 rounded-2xl rounded-bl-sm animate-ping opacity-20",
              player === 'X' ? "bg-indigo-400" : "bg-emerald-400"
            )}></div>
          </div>
        </div>
      )}

      <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-800">
        {player === 'X' ? <X className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" /> : <Circle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />}
      </div>
      <div className="flex flex-col min-w-0">
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
           {isMe ? 'YOU' : 'OPPONENT'} 
           {winner === player && <Trophy className="w-3 h-3 text-amber-400" />}
         </span>
         <span className="text-xs sm:text-sm font-semibold text-white truncate">{name}</span>
      </div>
      <div className="ml-auto text-base sm:text-xl font-bold text-slate-200">{score}</div>
    </div>
  );

  return (
    <div className={clsx(
      // Slightly tighter vertical rhythm on mobile; keep roomy layout on sm+
      "w-full max-w-lg flex flex-col items-center gap-4 sm:gap-6 px-3 pb-3 pt-2 sm:p-4",
      // Make room for the mobile fixed Play Again bar so it doesn't cover content
      isGameOver && "pb-28 sm:pb-4",
      isNudged && "animate-shake"
    )}>
      
      {/* Top Bar */}
      <div className="relative z-20 w-full flex items-center justify-between bg-slate-800/80 backdrop-blur-sm p-2.5 sm:p-3 rounded-xl border border-slate-700 shadow-xl">
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
            <a 
              href="https://github.com/ajnaduvil/albins-tic-tac-toe" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 bg-slate-700/50 hover:bg-slate-600/50 text-slate-400 hover:text-white rounded-lg transition-colors border border-transparent hover:border-slate-600"
              title="View on GitHub"
              aria-label="View source code on GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
            <button onClick={onLeave} className="p-2 bg-slate-700/50 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-500/30">
               <LogOut className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* Players & Score */}
      <div className="relative z-30 w-full grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between sm:gap-3">
         <PlayerBadge 
            player="X" 
            name={myPlayer === 'X' ? myName : opponentName} 
            score={scores.X} 
            isMe={myPlayer === 'X'} 
            emoji={myPlayer === 'X' ? myEmoji : incomingEmoji}
            message={lastBubble.X}
         />
         <div className="hidden sm:block text-slate-600 font-bold text-lg shrink-0">VS</div>
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
        <div className={clsx("w-full py-2.5 sm:py-3 px-5 sm:px-6 rounded-xl text-center font-bold text-base sm:text-lg transition-all duration-300 shadow-lg",
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
       <div className="sm:hidden flex items-center justify-center mt-[-8px]">
            <span className="text-xs font-bold text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">Goal: {winCondition} in a row</span>
      </div>

      {/* Emoji Bar */}
      <div className="w-full flex justify-center gap-1 pt-1">
        <div className="flex flex-wrap justify-center bg-slate-800/80 backdrop-blur rounded-2xl sm:rounded-full p-1.5 sm:p-2 gap-0.5 sm:gap-1 border border-slate-700 shadow-xl max-w-full">
            {EMOJIS.map(emoji => (
                <button
                    key={emoji}
                    onClick={() => {
                        onSendEmoji(emoji);
                    }}
                    className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-slate-700 rounded-full transition-all hover:scale-110 active:scale-95"
                    title={emoji}
                >
                    {renderEmoji(emoji, 22)}
                </button>
            ))}
        </div>
      </div>

      {/* Game Over Actions */}
      {isGameOver && (
        <>
          {/* Desktop / larger screens: keep the inline button */}
          <button
            onClick={onReset}
            className="hidden sm:flex items-center gap-2 px-8 py-3 bg-white text-slate-900 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg animate-fade-in-up mt-2"
          >
            <RefreshCw className="w-5 h-5" />
            Play Again
          </button>

          {/* Mobile: fixed bottom action bar (no scroll needed) */}
          <div className="sm:hidden fixed left-0 right-0 bottom-0 z-[9998] px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-slate-900/80 backdrop-blur border-t border-slate-700">
            <button
              onClick={onReset}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white text-slate-900 rounded-xl font-black hover:bg-indigo-50 transition-colors shadow-xl"
            >
              <RefreshCw className="w-5 h-5" />
              Play Again
            </button>
          </div>
        </>
      )}

      {/* Floating Chat Widget (bottom-right, agent-style) */}
      <div
        className={clsx(
          "fixed right-4 z-[9999] flex flex-col items-end",
          isGameOver ? "bottom-24 sm:bottom-4" : "bottom-4"
        )}
        ref={chatWidgetRef}
      >
        {isChatOpen && (
          <div className="mb-3 w-[calc(100vw-2rem)] max-w-sm sm:w-80">
            <div className="bg-slate-800/95 backdrop-blur border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '70vh' }}>
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

              {/* Chat Messages Section */}
              <div className="p-3 flex-1 overflow-y-auto space-y-2 bg-slate-900/30" style={{ minHeight: 0 }}>
                {chatMessages.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-8">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <div>No messages yet. Say hi!</div>
                  </div>
                ) : (
                  chatMessages.map((m) => {
                    const isMe = m.from === myPlayer;
                    const senderTheme =
                      m.from === 'X'
                        ? {
                            bubble:
                              'bg-gradient-to-br from-indigo-500/75 via-indigo-600/75 to-purple-600/75 border-indigo-300/80 text-white shadow-indigo-500/40',
                            label: 'text-indigo-200',
                          }
                        : {
                            bubble:
                              'bg-gradient-to-br from-emerald-500/75 via-emerald-600/75 to-teal-600/75 border-emerald-300/80 text-white shadow-emerald-500/40',
                            label: 'text-emerald-200',
                          };
                    return (
                      <div key={m.id} className={clsx("flex", isMe ? "justify-end" : "justify-start")}>
                        <div className={clsx(
                          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-lg border-2",
                          senderTheme.bubble
                        )}>
                          <div className={clsx("text-[10px] font-bold mb-1.5 uppercase tracking-wider", senderTheme.label)}>
                            {isMe ? "You" : m.name}
                          </div>
                          <div className="break-words leading-relaxed">{m.text}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Quick Replies Section - Separated */}
              <div className="px-3 pt-3 pb-3 overflow-x-hidden border-t border-slate-700/50 bg-slate-800/20 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 bg-indigo-500/50 rounded-full"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Replies</span>
                </div>
                <div className="max-h-20 overflow-y-auto mb-3 pr-1">
                  <div className="grid grid-cols-2 gap-2">
                    {presets.map((msg, idx) => (
                      <div key={`${msg}-${idx}`} className="group flex gap-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleSendChat(msg)}
                          className="flex-1 bg-slate-700/60 hover:bg-indigo-600/30 hover:border-indigo-500/70 border-2 border-slate-600/50 rounded-lg px-3 py-2 text-xs font-medium text-slate-200 text-left transition-all truncate shadow-sm"
                          title={msg}
                        >
                          <span className="opacity-70">⚡</span> {msg}
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
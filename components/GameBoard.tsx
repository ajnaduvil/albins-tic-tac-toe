import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, GameState, Player, CellValue } from '../types';
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

const EMOJIS = ['😂', '😎', '😡', '😭', '😏', '🖕', '😉', '🍌', '👌'];

const LIVE_EMOJI_MAP = {
  '😂': 'FaceWithTearsOfJoy',
  '😎': 'SmilingFaceWithSunglasses',
  '😡': 'AngryFace',
  '😭': 'LoudlyCryingFace',
  '😏': 'SmirkingFace',
  '🖕': 'MiddleFinger',
  '😉': 'WinkingFace',
  '🍌': 'Banana',
  '👌': 'OkHand',
} satisfies Record<(typeof EMOJIS)[number], keyof typeof emojiData>;

// Plain unicode emoji (for the emoji bar; non-distracting)
const renderUnicodeEmoji = (emoji: string, size: number = 22) => (
  <span style={{ fontSize: `${size}px`, lineHeight: 1 }}>{emoji}</span>
);

// Animated emoji (only for the "selected/sent" overlay above avatars)
const renderAnimatedEmoji = (emoji: string | null, size: number = 40) => {
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

  // If we don't have an animated asset, fall back to unicode
  return renderUnicodeEmoji(emoji, size);
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
  const prevIsNudgedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [lastMoveIndex, setLastMoveIndex] = useState<number | null>(null);
  const prevBoardRef = useRef<CellValue[]>(board);
  
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

  // Track last move by comparing board changes
  useEffect(() => {
    if (prevBoardRef.current.length === board.length) {
      // Find the cell that changed from null to a value
      for (let i = 0; i < board.length; i++) {
        if (prevBoardRef.current[i] === null && board[i] !== null) {
          setLastMoveIndex(i);
          // Clear highlight after 10 seconds
          setTimeout(() => setLastMoveIndex(null), 10000);
          break;
        }
      }
    }
    prevBoardRef.current = [...board];
  }, [board]);

  // Clear last move highlight on game reset
  useEffect(() => {
    if (status === 'idle' || (status === 'playing' && board.every(cell => cell === null))) {
      setLastMoveIndex(null);
    }
  }, [status, board]);

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

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  
  const copyCode = async () => {
    setCopyError(null);
    
    // Always try fallback first for better compatibility
    const fallbackCopy = (): boolean => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = roomCode;
        textArea.style.position = 'fixed';
        textArea.style.left = '0';
        textArea.style.top = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        textArea.style.opacity = '0';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 99999); // For mobile devices
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      } catch (err) {
        console.error('Fallback copy failed:', err);
        return false;
      }
    };

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(roomCode);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          return;
        } catch (clipboardErr) {
          console.warn('Clipboard API failed, trying fallback:', clipboardErr);
          // Fall through to fallback
        }
      }
      
      // Use fallback method
      if (fallbackCopy()) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        throw new Error('Both clipboard methods failed');
      }
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopyError('Failed to copy. Please copy manually.');
      setTimeout(() => setCopyError(null), 3000);
      // Still show copied state briefly to indicate attempt
      setCopied(true);
      setTimeout(() => setCopied(false), 500);
    }
  };

  const playNudgeFeedback = async (kind: 'send' | 'receive') => {
    // Vibration (best-effort; may be ignored on some browsers/devices)
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(kind === 'receive' ? [35, 40, 35] : 25);
      }
    } catch {
      // ignore
    }

    // Sound (best-effort; may be blocked until user interaction)
    try {
      const AnyWindow = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctx = window.AudioContext || AnyWindow.webkitAudioContext;
      if (!Ctx) return;

      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const now = ctx.currentTime;
      const base = kind === 'receive' ? 740 : 880; // receive a bit lower

      osc.type = 'sine';
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 1.15, now + 0.08);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    // Trigger only on rising edge
    if (isNudged && !prevIsNudgedRef.current) {
      void playNudgeFeedback('receive');
    }
    prevIsNudgedRef.current = isNudged;
  }, [isNudged]);

  const handleNudge = () => {
    if (!justNudged) {
        void playNudgeFeedback('send');
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

  const PlayerBadge = ({ player, name, score, isMe, emoji, message }: { player: Player, name: string, score: number, isMe: boolean, emoji: string | null, message?: string | null }) => {
    const isCurrentPlayerTurn = currentPlayer === player && status === 'playing';
    const playerTheme = player === 'X'
      ? {
          border: "border-indigo-500/40",
          bg: "bg-indigo-500/15",
          glow: "shadow-indigo-500/60",
          ring: "ring-indigo-400",
          avatarGlow: "shadow-indigo-400/80",
          avatarBg: "bg-indigo-500/20",
          avatarBorder: "border-indigo-400/60"
        }
      : {
          border: "border-emerald-500/40",
          bg: "bg-emerald-500/15",
          glow: "shadow-emerald-500/60",
          ring: "ring-emerald-400",
          avatarGlow: "shadow-emerald-400/80",
          avatarBg: "bg-emerald-500/20",
          avatarBorder: "border-emerald-400/60"
        };

    return (
      <div className={clsx(
        "relative flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 rounded-xl border transition-all duration-500 flex-1 min-w-0 overflow-hidden",
        playerTheme.border,
        playerTheme.bg,
        // Enhanced glow and animation when it's the player's turn
        isCurrentPlayerTurn
          ? clsx(
              "opacity-100 scale-105",
              "border-opacity-80 bg-opacity-25",
              // Contained glow effect
              "animate-badge-glow-contained",
              player === 'X'
                ? "bg-gradient-to-br from-indigo-500/20 via-indigo-600/30 to-purple-600/20"
                : "bg-gradient-to-br from-emerald-500/20 via-emerald-600/30 to-teal-600/20"
            )
          : "opacity-70 hover:opacity-85"
      )}>

        {/* Internal highlight animation when it's the player's turn */}
        {isCurrentPlayerTurn && (
          <div className={clsx(
            "absolute inset-0 rounded-xl opacity-40",
            "animate-badge-highlight-sweep",
            player === 'X'
              ? "bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent"
              : "bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
          )} />
        )}

      {/* Emoji Overlay */}
      {emoji && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-[9998] pointer-events-none">
          {renderAnimatedEmoji(emoji, 64)}
        </div>
      )}

      {/* Latest Chat Bubble - Fancy Design */}
      {message && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-[9999] w-max max-w-[180px] animate-[fade-in-up_0.3s_ease-out] animate-float pointer-events-none">
          <div className="relative">
            {/* Soft aura */}
            <div
              className={clsx(
                "absolute -inset-1 rounded-2xl blur-lg opacity-60",
                isMe
                  ? "bg-gradient-to-br from-indigo-500/70 via-purple-500/60 to-fuchsia-500/50"
                  : "bg-gradient-to-br from-emerald-500/70 via-teal-500/60 to-cyan-500/50"
              )}
            />

            {/* Gradient border */}
            <div
              className={clsx(
                "relative rounded-2xl p-[1.5px]",
                isMe
                  ? "bg-gradient-to-br from-indigo-300/90 via-purple-300/80 to-fuchsia-300/70"
                  : "bg-gradient-to-br from-emerald-300/90 via-teal-300/80 to-cyan-300/70"
              )}
            >
              {/* Glass body */}
              <div className="relative rounded-2xl bg-slate-950/70 backdrop-blur-md border border-white/10 px-4 py-2.5 shadow-2xl">
                {/* Message */}
                <div className="text-xs font-semibold text-white/95 leading-snug break-words">
                  {message}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={clsx(
        "flex-shrink-0 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg border-2 transition-all duration-500 relative overflow-hidden",
        isCurrentPlayerTurn
          ? clsx(
              "scale-110",
              player === 'X'
                ? "bg-gradient-to-br from-indigo-500/40 via-indigo-600/60 to-purple-600/40 border-indigo-400/80"
                : "bg-gradient-to-br from-emerald-500/40 via-emerald-600/60 to-teal-600/40 border-emerald-400/80",
              // Contained glow effect
              "animate-avatar-glow-contained"
            )
          : "bg-slate-800 border-slate-600"
      )}>
        {player === 'X' ? (
          <X className={clsx(
            "w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 relative z-10",
            isCurrentPlayerTurn ? "text-indigo-200 scale-110" : "text-indigo-400"
          )} strokeWidth={2.5} />
        ) : (
          <Circle className={clsx(
            "w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 relative z-10",
            isCurrentPlayerTurn ? "text-emerald-200 scale-110" : "text-emerald-400"
          )} strokeWidth={2.5} />
        )}
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
  };

  return (
    <div className={clsx(
      // Tighter vertical rhythm for better space utilization
      "w-full max-w-lg flex flex-col items-center gap-2 sm:gap-4 px-2 pb-2 pt-1 sm:px-3 sm:pb-3 sm:pt-2",
      // Make room for the mobile fixed Play Again bar so it doesn't cover content
      isGameOver && "pb-24 sm:pb-3",
      isNudged && "animate-shake"
    )}>
      
      {/* Top Bar */}
      <div className="relative z-20 w-full flex items-center justify-between bg-slate-800/80 backdrop-blur-sm p-2 sm:p-2.5 rounded-xl border border-slate-700 shadow-xl">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase mb-0.5">Room Code</span>
          <div className="flex items-center gap-2 group">
            <span className="text-xl font-mono font-bold text-white tracking-widest group-hover:text-indigo-400 transition-colors">{roomCode}</span>
            <div className="relative">
              <button
                onClick={copyCode}
                className={clsx(
                  "p-1.5 rounded-lg transition-all duration-200",
                  copied 
                    ? "bg-emerald-500/30 text-emerald-300 ring-2 ring-emerald-400/60 shadow-lg shadow-emerald-500/20" 
                    : "text-slate-500 hover:text-indigo-400 hover:bg-slate-700/50",
                  copyError && "bg-red-500/20 text-red-400 ring-2 ring-red-500/50"
                )}
                title={copyError ? copyError : copied ? "Copied!" : "Copy room code"}
              >
                <Copy className={clsx("w-3.5 h-3.5 transition-all duration-200", copied && "scale-125")} />
              </button>
              {copied && !copyError && (
                <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-md whitespace-nowrap pointer-events-none z-50 shadow-lg animate-pulse">
                  ✓ Copied!
                </span>
              )}
            </div>
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
      <div className="relative z-30 w-full grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:justify-between sm:gap-2">
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
        <div className={clsx(
          "w-full py-2 sm:py-2.5 rounded-xl font-bold text-base sm:text-lg transition-all duration-300 shadow-lg",
          "flex items-center justify-center relative",
          // Only hide overflow when button is not present
          !isOpponentTurn && "overflow-hidden",
          status === 'winner' && winner === myPlayer ? "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-emerald-500/20" :
          status === 'winner' && winner !== myPlayer ? "bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-red-500/20" :
          status === 'draw' ? "bg-slate-700 text-slate-200" :
          isMyTurn ? "bg-indigo-500 text-white shadow-indigo-500/20 scale-105" : "bg-slate-800 text-slate-400"
        )}>
          <span className="flex-1 text-center">{getStatusMessage()}</span>
          
          {/* Nudge Button - Integrated within status bar */}
          {isOpponentTurn && (
            <button 
              onClick={handleNudge}
              disabled={justNudged}
              className={clsx(
                "absolute right-2 sm:right-3 p-2 sm:p-2.5 rounded-lg transition-all duration-300 z-20",
                "backdrop-blur-sm border shadow-lg flex items-center justify-center",
                justNudged 
                  ? "bg-slate-700/80 text-slate-500 cursor-not-allowed border-slate-600/50" 
                  : clsx(
                      "bg-gradient-to-br from-amber-500 to-amber-600 text-white",
                      "border-amber-400/30 shadow-amber-500/30",
                      "hover:from-amber-400 hover:to-amber-500 hover:scale-105 hover:shadow-xl hover:shadow-amber-500/40",
                      "active:scale-95"
                    )
              )}
              title={justNudged ? "Cooldown active" : "Nudge opponent"}
              aria-label="Nudge opponent"
            >
              <BellRing className={clsx(
                "w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300",
                !justNudged && "animate-bell-ring hover:rotate-12"
              )} />
            </button>
          )}
        </div>
      </div>

      {/* The Grid */}
      <div className="w-full max-w-[400px] aspect-square relative">
        <div
            className={clsx(
              "absolute inset-0 bg-slate-700 shadow-2xl transition-all duration-500",
              // Grid glow effect when it's the player's turn
              isMyTurn && status === 'playing' && (
                myPlayer === 'X' ? "animate-grid-glow-indigo ring-2 ring-indigo-400/30" : "animate-grid-glow-emerald ring-2 ring-emerald-400/30"
              )
            )}
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
              const isLastMove = lastMoveIndex === index;
              const canClick = !cell && isMyTurn && status === 'playing';
              const iconSizeClass = gridSize === 3 ? "w-16 h-16" : gridSize === 4 ? "w-10 h-10" : "w-6 h-6";

              return (
                <button
                  key={index}
                  onClick={() => onMove(index)}
                  disabled={!canClick}
                  className={clsx(
                    "relative flex items-center justify-center transition-all duration-200 w-full h-full",
                    isWinningCell ? "bg-amber-900/50" : 
                    isLastMove ? "bg-cyan-500/20" : "bg-slate-900",
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
       <div className="sm:hidden flex items-center justify-center mt-[-6px]">
            <span className="text-xs font-bold text-slate-500 bg-slate-800/50 px-2.5 py-0.5 rounded-full">Goal: {winCondition} in a row</span>
      </div>

      {/* Emoji Bar */}
      <div className="w-full flex justify-center gap-1 pt-0.5">
        <div className="flex flex-wrap justify-center bg-slate-800/80 backdrop-blur rounded-2xl sm:rounded-full p-1 sm:p-1.5 gap-0.5 sm:gap-1 border border-slate-700 shadow-xl max-w-full">
            {EMOJIS.map(emoji => (
                <button
                    key={emoji}
                    onClick={() => {
                        onSendEmoji(emoji);
                    }}
                    className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-slate-700 rounded-full transition-all hover:scale-110 active:scale-95"
                    title={emoji}
                >
                    {renderUnicodeEmoji(emoji, 18)}
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
          <div className="sm:hidden fixed left-0 right-0 bottom-0 z-[9998] px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-slate-900/80 backdrop-blur border-t border-slate-700">
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
                    <div>No messages yet.</div>
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
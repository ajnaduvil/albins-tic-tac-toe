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
  const endSoundPlayedRef = useRef(false);
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

  // End-of-match sound (play once per match)
  useEffect(() => {
    if (!myPlayer) return;
    if (!isGameOver) return;
    if (endSoundPlayedRef.current) return;

    endSoundPlayedRef.current = true;

    if (status === 'draw') {
      void playEndSound('draw');
    } else if (status === 'winner') {
      void playEndSound(winner === myPlayer ? 'win' : 'lose');
    }
  }, [isGameOver, myPlayer, status, winner]);

  // Track last move by comparing board changes
  useEffect(() => {
    if (prevBoardRef.current.length === board.length) {
      // Find the cell that changed from null to a value
      for (let i = 0; i < board.length; i++) {
        if (prevBoardRef.current[i] === null && board[i] !== null) {
          setLastMoveIndex(i);
          // Play move sound
          if (board[i] && status === 'playing') {
            void playMoveSound(board[i]);
          }
          // Clear highlight after 10 seconds
          setTimeout(() => setLastMoveIndex(null), 10000);
          break;
        }
      }
    }
    prevBoardRef.current = [...board];
  }, [board, status]);

  // Clear last move highlight on game reset
  useEffect(() => {
    if (status === 'idle' || (status === 'playing' && board.every(cell => cell === null))) {
      setLastMoveIndex(null);
      endSoundPlayedRef.current = false;
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

  const playMoveSound = async (player: Player) => {
    // Move sound (best-effort; may be blocked until user interaction)
    try {
      const AnyWindow = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctx = window.AudioContext || AnyWindow.webkitAudioContext;
      if (!Ctx) return;

      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      const duration = 0.15;

      if (player === 'X') {
        // X sound - higher pitch, crisp tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.05);
        osc.frequency.exponentialRampToValueAtTime(600, now + duration);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
      } else {
        // O sound - lower pitch, rounder tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.05);
        osc.frequency.exponentialRampToValueAtTime(400, now + duration);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + duration);
      }
    } catch {
      // ignore
    }
  };

  const playEndSound = async (kind: 'win' | 'lose' | 'draw') => {
    // End-of-match sound (best-effort; may be blocked until user interaction)
    try {
      const AnyWindow = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctx = window.AudioContext || AnyWindow.webkitAudioContext;
      if (!Ctx) return;

      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;

      const beep = (freq: number, startOffset: number, duration: number, volume: number, type: OscillatorType = 'sine') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + startOffset);

        // Gentle envelope to avoid clicks
        gain.gain.setValueAtTime(0, now + startOffset);
        gain.gain.linearRampToValueAtTime(volume, now + startOffset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration);
      };

      if (kind === 'win') {
        // Bright ascending triad
        beep(523.25, 0.00, 0.14, 0.12); // C5
        beep(659.25, 0.12, 0.14, 0.12); // E5
        beep(783.99, 0.24, 0.18, 0.12); // G5
      } else if (kind === 'lose') {
        // Soft descending tones
        beep(440.0, 0.00, 0.16, 0.10); // A4
        beep(349.23, 0.14, 0.16, 0.10); // F4
        beep(261.63, 0.28, 0.20, 0.10); // C4
      } else {
        // Neutral double-beep
        beep(392.0, 0.00, 0.14, 0.10); // G4
        beep(392.0, 0.20, 0.16, 0.10); // G4
      }
    } catch {
      // ignore
    }
  };

  const playNudgeFeedback = async (kind: 'send' | 'receive') => {
    // Vibration (best-effort; may be ignored on some browsers/devices)
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(kind === 'receive' ? [50, 30, 50, 30, 50] : [30, 20, 30]);
      }
    } catch {
      // ignore
    }

    // Ring/Buzz Sound (best-effort; may be blocked until user interaction)
    try {
      const AnyWindow = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctx = window.AudioContext || AnyWindow.webkitAudioContext;
      if (!Ctx) return;

      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      const duration = kind === 'receive' ? 0.3 : 0.2;
      
      if (kind === 'receive') {
        // Ring sound - multiple frequencies for a bell-like effect
        const frequencies = [800, 1000, 1200]; // Harmonic frequencies
        const oscillators: OscillatorNode[] = [];
        const gains: GainNode[] = [];

        frequencies.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          
          // Create a ring pattern with different timing for each frequency
          const delay = index * 0.02;
          gain.gain.setValueAtTime(0, now + delay);
          gain.gain.linearRampToValueAtTime(0.12 / frequencies.length, now + delay + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.06 / frequencies.length, now + delay + 0.15);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          oscillators.push(osc);
          gains.push(gain);
          
          osc.start(now + delay);
          osc.stop(now + delay + duration);
        });
      } else {
        // Buzz sound - lower frequency with slight modulation
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const lfo = ctx.createOscillator(); // Low frequency oscillator for buzz effect
        const lfoGain = ctx.createGain();

        // Main oscillator
        osc.type = 'square'; // Square wave for buzzy sound
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.1);

        // LFO for buzz modulation
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(8, now); // 8Hz modulation
        lfoGain.gain.setValueAtTime(20, now); // Modulation depth
        
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        lfo.start(now);
        lfo.stop(now + duration);
        osc.start(now);
        osc.stop(now + duration);
      }
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
    if (status === 'winner') return winner === myPlayer ? 'You Won!' : 'You Lost!';
    if (status === 'draw') {
      const boardIsFull = board.every((cell) => cell !== null);
      return boardIsFull ? "🤝 It's a Draw!" : "🤝 No one can win from here — Draw!";
    }
    if (isMyTurn) return "Your Turn";
    return `${opponentName}'s Turn`;
  };

  const PlayerBadge = ({ player, name, score, isMe, emoji, message }: { player: Player, name: string, score: number, isMe: boolean, emoji: string | null, message?: string | null }) => {
    const isCurrentPlayerTurn = currentPlayer === player && status === 'playing';
    const isWinner = status === 'winner' && winner === player;
    const badgeRef = useRef<HTMLDivElement>(null);
    const playerTheme = player === 'X'
      ? {
          border: "border-indigo-400/55",
          bg: "bg-indigo-500/22",
          glow: "shadow-indigo-500/60",
          ring: "ring-indigo-400",
          avatarGlow: "shadow-indigo-400/80",
          avatarBg: "bg-indigo-500/20",
          avatarBorder: "border-indigo-400/60"
        }
      : {
          border: "border-emerald-400/55",
          bg: "bg-emerald-500/22",
          glow: "shadow-emerald-500/60",
          ring: "ring-emerald-400",
          avatarGlow: "shadow-emerald-400/80",
          avatarBg: "bg-emerald-500/20",
          avatarBorder: "border-emerald-400/60"
        };

    // Confetti effect for winner at regular intervals
    useEffect(() => {
      if (!isWinner || !badgeRef.current) return;

      const triggerConfetti = () => {
        const rect = badgeRef.current?.getBoundingClientRect();
        if (!rect) return;

        // Calculate position relative to viewport
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;

        confetti({
          particleCount: 50,
          spread: 60,
          origin: { x, y },
          colors: ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d', '#fde047'], // Golden/amber colors
          gravity: 0.8,
          ticks: 200,
        });
      };

      // Initial confetti burst
      triggerConfetti();

      // Set up interval for regular confetti pops
      const interval = setInterval(() => {
        triggerConfetti();
      }, 2000); // Every 2 seconds

      return () => clearInterval(interval);
    }, [isWinner]);

    return (
      <div 
        ref={badgeRef}
        className={clsx(
        "relative flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 rounded-xl border transition-all duration-500 flex-1 min-w-0",
        // Only hide overflow when no overlays are present (emoji + chat bubble need to render outside)
        !(emoji || message) && "overflow-hidden",
        playerTheme.border,
        playerTheme.bg,
        // Winner celebration animation
        isWinner && "animate-winner-celebration",
        // Enhanced glow and animation when it's the player's turn
        isCurrentPlayerTurn && !isWinner
          ? clsx(
              "opacity-100 scale-105",
              "border-opacity-80 bg-opacity-25",
              // Contained glow effect
              "animate-badge-glow-contained",
                player === 'X'
                  ? "bg-gradient-to-br from-indigo-500/20 via-indigo-600/30 to-purple-600/20"
                  : "bg-gradient-to-br from-emerald-500/20 via-emerald-600/30 to-teal-600/20"
            )
          : !isWinner && "opacity-85 hover:opacity-95",
        // Winner styling
        isWinner && clsx(
          "opacity-100 scale-110",
          "border-amber-400/60 bg-gradient-to-br from-amber-500/20 via-yellow-500/30 to-amber-600/20",
          "shadow-2xl shadow-amber-500/40"
        )
      )}>

        {/* Winner celebration highlight */}
        {isWinner && (
          <div className={clsx(
            "absolute inset-0 rounded-xl opacity-60",
            "animate-badge-highlight-sweep",
            "bg-gradient-to-r from-transparent via-amber-400/80 to-transparent"
          )} />
        )}

        {/* Internal highlight animation when it's the player's turn */}
        {isCurrentPlayerTurn && !isWinner && (
          <div className={clsx(
            "absolute inset-0 rounded-xl opacity-40",
            "animate-badge-highlight-sweep",
            player === 'X'
              ? "bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent"
              : "bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
          )} />
        )}

      {/* Emoji Overlay - More Pronounced */}
      {emoji && (
        <div className="absolute -top-12 sm:-top-14 left-1/2 -translate-x-1/2 z-[9998] pointer-events-none">
          <div className="relative animate-emoji-pop">
            {/* Glow effect behind emoji */}
            <div className={clsx(
              "absolute inset-0 rounded-full blur-xl opacity-60",
              "animate-emoji-glow",
              isMe
                ? "bg-gradient-to-br from-indigo-400/60 via-purple-400/50 to-fuchsia-400/60"
                : "bg-gradient-to-br from-green-400/60 via-teal-400/50 to-cyan-400/60"
            )} style={{ transform: 'scale(1.5)' }} />
            
            {/* Emoji with enhanced styling */}
            <div className="relative drop-shadow-2xl filter">
              {renderAnimatedEmoji(emoji, 80)}
            </div>
          </div>
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
                  ? "bg-gradient-to-br from-indigo-400/60 via-purple-400/50 to-fuchsia-400/60"
                  : "bg-gradient-to-br from-green-400/60 via-teal-400/50 to-cyan-400/60"
              )}
            />

            {/* Gradient border */}
            <div
              className={clsx(
                "relative rounded-2xl p-[1.5px]",
                isMe
                  ? "bg-gradient-to-br from-indigo-400/90 via-purple-400/80 to-fuchsia-400/70"
                  : "bg-gradient-to-br from-green-400/90 via-teal-400/80 to-cyan-400/70"
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
        isWinner
          ? clsx(
              "scale-125 animate-winner-avatar",
              "bg-gradient-to-br from-amber-400 via-yellow-400 to-amber-500 border-amber-300 shadow-lg shadow-amber-400/60"
            )
          : isCurrentPlayerTurn
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
            isWinner ? "text-amber-100 scale-110 drop-shadow-lg" :
            isCurrentPlayerTurn ? "text-indigo-200 scale-110" : "text-indigo-400"
          )} strokeWidth={2.5} />
        ) : (
          <Circle className={clsx(
            "w-4 h-4 sm:w-5 sm:h-5 transition-all duration-300 relative z-10",
            isWinner ? "text-amber-100 scale-110 drop-shadow-lg" :
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
    // Outer wrapper must remain free of filter/transform so position: fixed stays viewport-sticky on mobile.
    <div className="relative w-full max-w-lg">
      <div className={clsx(
        // Visual card container
        "flex flex-col items-center gap-2 sm:gap-4 p-2 sm:p-3 rounded-3xl border border-white/10 bg-slate-950/40 backdrop-blur-xl shadow-2xl ring-1 ring-white/5 overflow-hidden",
        // Make room for the mobile fixed Play Again bar so it doesn't cover content
        isGameOver && "pb-24 sm:pb-3",
      )}>

        {/* Important: apply shake on an inner wrapper so it doesn't break position: fixed */}
        <div className={clsx("w-full flex flex-col items-center gap-2 sm:gap-4", isNudged && "animate-shake")}>

      {/* Top Bar */}
      <div className="relative z-20 w-full flex items-center justify-between bg-slate-950/45 backdrop-blur-sm p-2 sm:p-2.5 rounded-xl border border-white/10 shadow-xl ring-1 ring-white/5">
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
              className="p-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-lg transition-colors border border-white/10"
              title="View on GitHub"
              aria-label="View source code on GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
            <button onClick={onLeave} className="p-2 bg-white/5 hover:bg-red-500/15 text-slate-400 hover:text-red-300 rounded-lg transition-colors border border-white/10 hover:border-red-500/30">
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

      {/* Status Bar - Compact Design */}
      <div className="w-full relative z-10">
        <div className={clsx(
          "w-full py-1.5 sm:py-2 rounded-lg font-semibold text-sm sm:text-base transition-all duration-300",
          "flex items-center justify-center relative",
          // Only hide overflow when button is not present
          !isOpponentTurn && "overflow-hidden",
          status === 'winner' && winner === myPlayer ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30" :
          status === 'winner' && winner !== myPlayer ? "bg-red-500/10 text-red-300 border border-red-500/30" :
          status === 'draw' ? "bg-amber-500/15 text-amber-300 border border-amber-400/40 shadow-lg shadow-amber-500/20 animate-pulse" :
          isMyTurn ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/30" : "bg-slate-800/30 text-slate-400 border border-slate-700/30"
        )}>
          <span className="flex-1 text-center">{getStatusMessage()}</span>
          
          {/* Nudge Button - Integrated within status bar */}
          {isOpponentTurn && (
            <button 
              onClick={handleNudge}
              disabled={justNudged}
              className={clsx(
                "absolute right-2 sm:right-2.5 p-1.5 sm:p-2 rounded-md transition-all duration-300 z-20",
                "backdrop-blur-sm border flex items-center justify-center",
                justNudged 
                  ? "bg-slate-700/60 text-slate-500 cursor-not-allowed border-slate-600/40" 
                  : clsx(
                      "bg-gradient-to-br from-amber-500 to-amber-600 text-white",
                      "border-amber-400/30 shadow-sm",
                      "hover:from-amber-400 hover:to-amber-500 hover:scale-105 hover:shadow-md hover:shadow-amber-500/30",
                      "active:scale-95"
                    )
              )}
              title={justNudged ? "Cooldown active" : "Nudge opponent"}
              aria-label="Nudge opponent"
            >
              <BellRing className={clsx(
                "w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300",
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
              "absolute inset-0 bg-slate-700/50 border shadow-2xl rounded-none transition-all duration-500",
              // Pronounced X highlight, balanced O highlight when it's the player's turn
              isMyTurn && status === 'playing' ? (
                myPlayer === 'X'
                  ? "border-indigo-300/55 ring-2 ring-indigo-300/55 animate-grid-glow-indigo"
                  : "border-emerald-300/40 ring-2 ring-emerald-300/50 animate-grid-glow-emerald"
              ) : "border-white/10"
            )}
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                gridTemplateRows: `repeat(${gridSize}, 1fr)`,
                gap: '3px',
                padding: '3px'
            }}
        >
            {board.map((cell, index) => {
              const isWinningCell = winningLine?.includes(index);
              const isLastMove = lastMoveIndex === index;
              const canClick = !cell && isMyTurn && status === 'playing';
              const winningPlayer = winner ?? null;
              const winnerIsX = winningPlayer === 'X';
              const iconSizeClass = gridSize === 3 ? "w-16 h-16" : gridSize === 4 ? "w-10 h-10" : "w-6 h-6";

              return (
                <button
                  key={index}
                  onClick={() => onMove(index)}
                  disabled={!canClick}
                  className={clsx(
                    "relative flex items-center justify-center transition-all duration-200 w-full h-full overflow-hidden",
                    isWinningCell ? "bg-slate-950/70" :
                    isLastMove ? "bg-cyan-500/15" : "bg-slate-950/80",
                    canClick ? "hover:bg-slate-900/50 cursor-pointer" : "cursor-default",
                    !cell && !canClick && "opacity-100",
                    "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/5",
                    // Highlight only actionable cells (reduces visual noise)
                    canClick &&
                      (myPlayer === 'X'
                        ? "ring-indigo-300/45 shadow-[0_0_14px_rgba(99,102,241,0.18)] hover:ring-indigo-200/70"
                        : "ring-emerald-300/45 shadow-[0_0_12px_rgba(16,185,129,0.16)] hover:ring-emerald-200/70"),
                    canClick && "focus-visible:outline-none focus-visible:ring-2"
                  )}
                >
                  {isWinningCell && (
                    <div className="pointer-events-none absolute inset-0">
                      <div
                        className={clsx(
                          "absolute inset-0 bg-gradient-to-br",
                          winnerIsX
                            ? "from-indigo-500/35 via-purple-500/18 to-fuchsia-500/12"
                            : "from-emerald-500/30 via-teal-500/16 to-cyan-500/12"
                        )}
                      />
                      <div
                        className={clsx(
                          "absolute inset-0 opacity-70",
                          winnerIsX
                            ? "bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.26)_0%,rgba(99,102,241,0)_75%)]"
                            : "bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.22)_0%,rgba(16,185,129,0)_75%)]"
                        )}
                      />
                      <div
                        className={clsx(
                          "absolute inset-0 ring-2",
                          winnerIsX
                            ? "ring-indigo-200/65 shadow-[0_0_22px_rgba(99,102,241,0.20)]"
                            : "ring-emerald-200/65 shadow-[0_0_22px_rgba(16,185,129,0.16)]"
                        )}
                      />
                      <div className="absolute inset-0 opacity-20">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 animate-[badge-highlight-sweep_3.2s_ease-in-out_infinite]" />
                      </div>
                      <div
                        className={clsx(
                          "absolute top-1 left-1 w-1.5 h-1.5 rounded-full blur-[0.5px]",
                          winnerIsX ? "bg-indigo-200/65" : "bg-emerald-200/65"
                        )}
                      />
                      <div
                        className={clsx(
                          "absolute top-1 right-1 w-1.5 h-1.5 rounded-full blur-[0.5px]",
                          winnerIsX ? "bg-indigo-200/65" : "bg-emerald-200/65"
                        )}
                      />
                      <div
                        className={clsx(
                          "absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full blur-[0.5px]",
                          winnerIsX ? "bg-indigo-200/45" : "bg-emerald-200/45"
                        )}
                      />
                      <div
                        className={clsx(
                          "absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full blur-[0.5px]",
                          winnerIsX ? "bg-indigo-200/45" : "bg-emerald-200/45"
                        )}
                      />
                    </div>
                  )}

                  <div className={clsx("relative z-10 transition-all duration-300 transform scale-0", cell && "scale-100")}>
                    {cell === 'X' && (
                      <X
                        className={clsx(
                          iconSizeClass,
                          isWinningCell
                            ? "text-indigo-200 drop-shadow-[0_0_14px_rgba(99,102,241,0.55)]"
                            : "text-indigo-400"
                        )}
                        strokeWidth={2.5}
                      />
                    )}
                    {cell === 'O' && (
                      <Circle
                        className={clsx(
                          iconSizeClass,
                          isWinningCell
                            ? "text-emerald-200 drop-shadow-[0_0_14px_rgba(16,185,129,0.55)]"
                            : "text-emerald-400"
                        )}
                        strokeWidth={2.5}
                      />
                    )}
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
          const id = winner === 'X' ? 'win-line-x' : 'win-line-o';

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
       <div className="sm:hidden flex items-center justify-center mt-[-6px]">
            <span className="text-xs font-bold text-slate-500 bg-slate-800/50 px-2.5 py-0.5 rounded-full">Goal: {winCondition} in a row</span>
      </div>

      {/* Emoji Bar */}
      <div className="w-full flex justify-center gap-1 pt-0.5 mb-16 sm:mb-0">
        <div className="flex justify-center bg-slate-950/45 backdrop-blur rounded-2xl sm:rounded-full p-1 sm:p-1.5 gap-0.5 sm:gap-0.5 border border-white/10 shadow-xl ring-1 ring-white/5">
            {EMOJIS.map(emoji => (
                <button
                    key={emoji}
                    onClick={() => {
                        onSendEmoji(emoji);
                    }}
                    className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-all hover:scale-110 active:scale-95"
                    title={emoji}
                >
                    {renderUnicodeEmoji(emoji, 22)}
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
            className={clsx(
              "hidden sm:flex items-center justify-center rounded-xl font-bold mt-2 group relative overflow-hidden",
              "px-8 py-3",
              "text-white bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500",
              "hover:from-amber-400 hover:via-orange-400 hover:to-rose-400",
              "border border-white/10 ring-1 ring-white/10",
              "shadow-xl shadow-amber-500/20 transition-all active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70",
              "animate-fade-in-up"
            )}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 group-hover:animate-[badge-highlight-sweep_1.4s_ease-in-out_1]" />
            </span>
            <span className="relative z-10 flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Play Again
            </span>
          </button>
        </>
      )}

      </div>
      </div>

      {/* Mobile: fixed bottom action bar (must be outside transformed/filtered containers) */}
      {isGameOver && (
        <div className="sm:hidden fixed left-1/2 -translate-x-1/2 bottom-0 z-[9998] pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] w-[min(15rem,calc(100vw-10.5rem))]">
          <button
            onClick={onReset}
            className={clsx(
              "w-full flex items-center justify-center rounded-xl font-black group relative overflow-hidden",
              "py-3",
              "text-white bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500",
              "hover:from-amber-400 hover:via-orange-400 hover:to-rose-400",
              "border border-white/10 ring-1 ring-white/10",
              "shadow-xl shadow-amber-500/20 transition-all active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
            )}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 group-hover:animate-[badge-highlight-sweep_1.4s_ease-in-out_1]" />
            </span>
            <span className="relative z-10 flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Play Again
            </span>
          </button>
        </div>
      )}

      {/* Floating Chat Widget (bottom-right, agent-style) */}
      <div
        className={clsx(
          "fixed right-4 z-[9999] flex flex-col items-end",
          // Keep it at the bottom of the screen (respect safe-area on mobile)
          "bottom-[calc(0.75rem+env(safe-area-inset-bottom))] sm:bottom-4"
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
                              'bg-gradient-to-br from-indigo-500/75 via-indigo-600/75 to-purple-600/75 border-indigo-400/80 text-white shadow-indigo-500/40',
                            label: 'text-indigo-200',
                          }
                        : {
                            bubble:
                              'bg-gradient-to-br from-green-500/75 via-teal-600/75 to-cyan-600/75 border-green-400/80 text-white shadow-green-500/40',
                            label: 'text-green-200',
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
          className="relative w-14 h-14 rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow-xl shadow-indigo-500/25 hover:from-indigo-500 hover:to-fuchsia-500 transition-all flex items-center justify-center border border-white/10 ring-1 ring-white/10"
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

export type Player = 'X' | 'O';
export type CellValue = Player | null;
export type GameStatus = 'idle' | 'playing' | 'winner' | 'draw';
export type AiLevel = 'easy' | 'medium' | 'hard' | 'extreme';

export interface ChatMessage {
  id: string;
  from: Player;
  name: string;
  text: string;
  ts: number;
}

export interface GameState {
  board: CellValue[];
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
  winningLine: number[] | null;
  gridSize: number;
  winCondition: number;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type PeerMessage = 
  | { type: 'MOVE'; index: number; player: Player }
  | { type: 'RESET'; startingPlayer: Player }
  | { type: 'SYNC_STATE'; state: GameState }
  | { type: 'HANDSHAKE'; name: string; gridSize?: number; winCondition?: number }
  | { type: 'EMOJI'; emoji: string }
  | { type: 'CHAT'; id: string; from: Player; name: string; text: string; ts: number }
  // Back-compat with older clients (if any) that only sent text
  | { type: 'CHAT'; text: string }
  | { type: 'NUDGE' }
  | { type: 'PING' }
  | { type: 'PONG' }
  | { type: 'VOICE_TALKING_START'; player: Player }
  | { type: 'VOICE_TALKING_STOP'; player: Player }
  | { type: 'VOICE_MUTE_TOGGLE'; player: Player; muted: boolean }
  | { type: 'VOICE_INITIALIZED'; player: Player };

export interface GameContextType {
  gameState: GameState;
  connectionStatus: ConnectionStatus;
  myPlayer: Player | null;
  roomCode: string;
  isHost: boolean;
  myName: string;
  opponentName: string;
  scores: { X: number; O: number };
  createRoom: (name: string, gridSize: number, winCondition: number) => void;
  joinRoom: (code: string, name: string) => void;
  makeMove: (index: number) => void;
  resetGame: () => void;
  leaveRoom: () => void;
  errorMessage: string | null;
  incomingEmoji: string | null;
  myEmoji: string | null;
  sendEmoji: (emoji: string) => void;
  sendNudge: () => void;
  isNudged: boolean;
  chatMessages: ChatMessage[];
  sendChat: (text: string) => void;
}
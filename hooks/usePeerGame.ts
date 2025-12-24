import { useState, useRef, useCallback, useEffect } from 'react';
import Peer, { DataConnection, PeerOptions } from 'peerjs';
import { GameState, ConnectionStatus, Player, PeerMessage, ChatMessage } from '../types';
import { checkWinner, isDraw, getInitialGameState } from '../utils/gameLogic';

const ID_PREFIX = 'peer-tac-toe-v4-public-'; // Bumped version to v4 to avoid cached/stale IDs on server

// Base STUN servers (always available as fallback)
const BASE_STUN_SERVERS = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
];

export const usePeerGame = () => {
  const [gameState, setGameState] = useState<GameState>(getInitialGameState());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const connectionStatusRef = useRef<ConnectionStatus>('disconnected');
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [roomCode, setRoomCode] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const [myName, setMyName] = useState<string>('');
  const [opponentName, setOpponentName] = useState<string>('Opponent');
  const [scores, setScores] = useState<{X: number; O: number}>({ X: 0, O: 0 });
  
  const [incomingEmoji, setIncomingEmoji] = useState<string | null>(null);
  const [myEmoji, setMyEmoji] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  
  const [starter, setStarter] = useState<Player>('X');
  const [isNudged, setIsNudged] = useState(false);
  const [turnServers, setTurnServers] = useState<RTCIceServer[]>([]);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const connectionTimeoutRef = useRef<number | null>(null);
  const incomingEmojiTimeoutRef = useRef<number | null>(null);
  const myEmojiTimeoutRef = useRef<number | null>(null);
  const nudgeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  const createId = useCallback(() => {
    // Prefer stable UUIDs when available (modern browsers)
    try {
      if ('crypto' in window && 'randomUUID' in window.crypto) {
        return window.crypto.randomUUID();
      }
    } catch {}
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }, []);

  const appendChatMessage = useCallback((msg: ChatMessage) => {
    setChatMessages((prev) => {
      const next = [...prev, msg];
      // Keep memory bounded
      return next.length > 100 ? next.slice(-100) : next;
    });
  }, []);

  // Helper to safely send messages
  const sendMessage = useCallback((msg: PeerMessage) => {
    try {
      if (connRef.current && connRef.current.open) {
        connRef.current.send(msg);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  }, []);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (connectionStatus !== 'connected' || !connRef.current) return;

    const heartbeatInterval = setInterval(() => {
        // Just a ping to keep NAT open
        sendMessage({ type: 'PING' });
    }, 4000); 

    return () => clearInterval(heartbeatInterval);
  }, [connectionStatus, sendMessage]);

  const updateGameLocal = useCallback((index: number, player: Player) => {
    setGameState((prev) => {
      if (prev.board[index] || prev.status !== 'playing') return prev;

      const newBoard = [...prev.board];
      newBoard[index] = player;

      const { winner, line } = checkWinner(newBoard, prev.winCondition);
      const draw = isDraw(newBoard);

      if (winner) {
        setScores(current => ({ ...current, [winner]: current[winner] + 1 }));
      }

      return {
        ...prev,
        board: newBoard,
        currentPlayer: player === 'X' ? 'O' : 'X',
        status: winner ? 'winner' : draw ? 'draw' : 'playing',
        winner,
        winningLine: line,
      };
    });
  }, []);

  const handleData = useCallback((data: unknown) => {
    const msg = data as PeerMessage;
    
    if (msg.type === 'PING') return; 
    if (msg.type === 'PONG') return;

    if (msg.type === 'MOVE') {
      updateGameLocal(msg.index, msg.player);
    } else if (msg.type === 'RESET') {
      setStarter(msg.startingPlayer);
      setGameState(current => getInitialGameState(msg.startingPlayer, current.gridSize, current.winCondition));
    } else if (msg.type === 'SYNC_STATE') {
      setGameState(msg.state);
    } else if (msg.type === 'HANDSHAKE') {
      setOpponentName(msg.name || 'Opponent');
      // If receiving handshake from host (has game config), update local state
      if (msg.gridSize && msg.winCondition) {
        setGameState(getInitialGameState('X', msg.gridSize, msg.winCondition));
      }
    } else if (msg.type === 'EMOJI') {
      setIncomingEmoji(msg.emoji);
      if (incomingEmojiTimeoutRef.current) clearTimeout(incomingEmojiTimeoutRef.current);
      incomingEmojiTimeoutRef.current = window.setTimeout(() => {
        setIncomingEmoji(null);
      }, 3000);
    } else if (msg.type === 'CHAT') {
      // Back-compat: older clients may only send { type:'CHAT', text }
      if ('from' in msg && msg.from && 'id' in msg && msg.id && 'name' in msg && msg.name && 'ts' in msg && msg.ts) {
        appendChatMessage({
          id: msg.id,
          from: msg.from,
          name: msg.name,
          text: msg.text,
          ts: msg.ts
        });
      } else {
        // If we don't know the sender, assume it's opponent (since this is received over the connection)
        const assumedFrom: Player = myPlayer === 'X' ? 'O' : 'X';
        appendChatMessage({
          id: createId(),
          from: assumedFrom,
          name: opponentName || 'Opponent',
          text: msg.text,
          ts: Date.now()
        });
      }
    } else if (msg.type === 'NUDGE') {
      setIsNudged(true);
      if (nudgeTimeoutRef.current) clearTimeout(nudgeTimeoutRef.current);
      nudgeTimeoutRef.current = window.setTimeout(() => setIsNudged(false), 500); 
    }
  }, [appendChatMessage, createId, myPlayer, opponentName, updateGameLocal]);

  const cleanup = useCallback(() => {
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    if (incomingEmojiTimeoutRef.current) clearTimeout(incomingEmojiTimeoutRef.current);
    if (myEmojiTimeoutRef.current) clearTimeout(myEmojiTimeoutRef.current);
    if (nudgeTimeoutRef.current) clearTimeout(nudgeTimeoutRef.current);
    
    // Close connections first
    if (connRef.current) {
      try { connRef.current.close(); } catch {}
    }
    // Then destroy peer
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch {}
    }
    
    peerRef.current = null;
    connRef.current = null;
    
    setConnectionStatus('disconnected');
    setMyPlayer(null);
    setIsHost(false);
    setRoomCode('');
    setStarter('X');
    setGameState(getInitialGameState());
    setScores({ X: 0, O: 0 });
    setOpponentName('Opponent');
    setIncomingEmoji(null);
    setMyEmoji(null);
    setChatMessages([]);
    setIsNudged(false);
  }, []);

  // Fetch TURN credentials from our serverless function on mount
  useEffect(() => {
    const fetchTurnCredentials = async () => {
      try {
        const response = await fetch('/api/get-turn-credentials');
        if (response.ok) {
          const data = await response.json();
          // Turnix returns { iceServers: [...] }
          if (data.iceServers && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
            setTurnServers(data.iceServers);
            console.log('TURN servers loaded:', data.iceServers.length);
          } else {
            console.log('No TURN servers available, using STUN only');
          }
        }
      } catch (error) {
        console.warn('Failed to fetch TURN credentials, using STUN only:', error);
      }
    };
    
    fetchTurnCredentials();
  }, []);

  // Get peer config with current TURN servers
  const getPeerConfig = useCallback((): PeerOptions => {
    return {
      debug: 2,
      config: {
        iceServers: [
          ...BASE_STUN_SERVERS,
          ...turnServers, // Add TURN servers if available
        ],
      },
    };
  }, [turnServers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const createRoom = useCallback((name: string, gridSize: number, winCondition: number, retryCount = 0) => {
    if (retryCount === 0) cleanup();
    
    setErrorMessage(null);
    setConnectionStatus('connecting');
    setMyName(name);
    
    const initialGame = getInitialGameState('X', gridSize, winCondition);
    setGameState(initialGame);
    
    // Generate code
    const code = Math.floor(100 + Math.random() * 900).toString();
    const fullId = `${ID_PREFIX}${code}`;
    
    setRoomCode(code);
    setIsHost(true);
    setMyPlayer('X');

    try {
      const peer = new Peer(fullId, getPeerConfig());
      peerRef.current = peer;

      peer.on('open', () => {
        // Host is ready to receive connections
        setConnectionStatus('disconnected'); 
        console.log('Host initialized:', fullId);
      });

      peer.on('connection', (conn) => {
        // Handle new connection
        if (connRef.current) {
            connRef.current.close();
        }
        connRef.current = conn;
        
        const onOpen = () => {
            setConnectionStatus('connected');
            // Send Host Handshake immediately
            conn.send({ 
              type: 'HANDSHAKE', 
              name: name, 
              gridSize: gridSize, 
              winCondition: winCondition
            });
            conn.send({ type: 'SYNC_STATE', state: initialGame });
        };

        if (conn.open) {
            onOpen();
        } else {
            conn.on('open', onOpen);
        }
        
        conn.on('data', handleData);
        conn.on('close', () => {
          setErrorMessage("Opponent disconnected");
          setConnectionStatus('disconnected'); 
        });
        conn.on('error', (err) => {
            console.error('Connection error:', err);
            setConnectionStatus('disconnected');
        });
      });

      peer.on('error', (err: any) => {
        if (err.type === 'unavailable-id') {
            // ID taken, try again
            if (retryCount < 5) {
                console.log('ID Collision, retrying...');
                peer.destroy();
                createRoom(name, gridSize, winCondition, retryCount + 1);
            } else {
                setErrorMessage("Unable to generate a unique room code. Please try again.");
                setConnectionStatus('error');
            }
        } else {
            console.error('Peer error:', err);
            setErrorMessage("Failed to initialize room. Check internet connection.");
            setConnectionStatus('error');
        }
      });
      
    } catch (err) {
      setErrorMessage("Failed to start game.");
      setConnectionStatus('error');
    }

  }, [cleanup, handleData, getPeerConfig]);

  const joinRoom = useCallback((code: string, name: string) => {
    cleanup();
    setErrorMessage(null);
    setConnectionStatus('connecting');
    setMyName(name);
    
    const formattedCode = code.trim();
    setRoomCode(formattedCode);
    setIsHost(false);
    setMyPlayer('O');

    try {
      // Create Joiner Peer (random ID)
      // IMPORTANT: PeerJS constructor is (id?, options?). Passing config as the first arg
      // can be treated as an id string like "[object Object]" and prevent proper connection.
      const peer = new Peer(undefined, getPeerConfig());
      peerRef.current = peer;
      
      // Global connection timeout
      connectionTimeoutRef.current = window.setTimeout(() => {
        // Avoid stale closure by checking the ref
        if (connectionStatusRef.current !== 'connected') {
          setErrorMessage("Connection timed out. Room might not exist or host is offline.");
          setConnectionStatus('error');
          // Don't full cleanup to allow retry on same screen if needed, but here we just show error
        }
      }, 10000); 

      peer.on('open', (id) => {
        console.log('Joiner peer opened with id:', id);
        const destId = `${ID_PREFIX}${formattedCode}`;
        console.log('Attempting to connect to:', destId);

        const conn = peer.connect(destId, {
            reliable: true
        });
        connRef.current = conn;

        conn.on('open', () => {
          // Clear timeout on success
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setConnectionStatus('connected');
          
          // Send Joiner Handshake
          conn.send({ type: 'HANDSHAKE', name: name });
          // Send Ping to wake up any dormant NAT
          conn.send({ type: 'PING' });
        });

        conn.on('data', handleData);
        
        conn.on('close', () => {
          setErrorMessage("Host disconnected");
          setConnectionStatus('disconnected');
        });

        conn.on('error', (err) => {
          console.error('Connection level error:', err);
        });
      });

      peer.on('error', (err: any) => {
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        
        console.error('Peer error:', err);
        
        if (err.type === 'peer-unavailable') {
           setErrorMessage(`Room ${formattedCode} not found.`);
        } else {
           setErrorMessage("Connection failed. Check your internet.");
        }
        setConnectionStatus('error');
      });

    } catch (err) {
      setErrorMessage("Failed to join room.");
      setConnectionStatus('error');
    }
  }, [cleanup, handleData, getPeerConfig]);

  const makeMove = useCallback((index: number) => {
    if (gameState.status !== 'playing') return;
    if (gameState.currentPlayer !== myPlayer) return;
    if (gameState.board[index]) return;

    updateGameLocal(index, myPlayer!);
    
    if (connectionStatus === 'connected') {
      sendMessage({ type: 'MOVE', index, player: myPlayer! });
    }
  }, [gameState, myPlayer, connectionStatus, updateGameLocal, sendMessage]);

  const sendEmoji = useCallback((emoji: string) => {
    if (connectionStatus === 'connected') {
      sendMessage({ type: 'EMOJI', emoji });
      setMyEmoji(emoji);
      if (myEmojiTimeoutRef.current) clearTimeout(myEmojiTimeoutRef.current);
      myEmojiTimeoutRef.current = window.setTimeout(() => setMyEmoji(null), 3000);
    }
  }, [connectionStatus, sendMessage]);

  const sendChat = useCallback((text: string) => {
    if (connectionStatus === 'connected') {
      if (!myPlayer) return;
      const msg: ChatMessage = {
        id: createId(),
        from: myPlayer,
        name: myName || 'You',
        text,
        ts: Date.now()
      };
      // Local echo so sender sees it immediately too
      appendChatMessage(msg);
      sendMessage({ type: 'CHAT', ...msg });
    }
  }, [appendChatMessage, connectionStatus, createId, myName, myPlayer, sendMessage]);

  const sendNudge = useCallback(() => {
    if (connectionStatus === 'connected') {
      sendMessage({ type: 'NUDGE' });
    }
  }, [connectionStatus, sendMessage]);

  const resetGame = useCallback(() => {
    const nextStarter = starter === 'X' ? 'O' : 'X';
    setStarter(nextStarter);
    const newGameState = getInitialGameState(nextStarter, gameState.gridSize, gameState.winCondition);
    setGameState(newGameState);
    
    if (connectionStatus === 'connected') {
      sendMessage({ type: 'RESET', startingPlayer: nextStarter });
    }
  }, [connectionStatus, starter, gameState.gridSize, gameState.winCondition, sendMessage]);

  const leaveRoom = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return {
    gameState,
    connectionStatus,
    myPlayer,
    roomCode,
    isHost,
    myName,
    opponentName,
    scores,
    createRoom,
    joinRoom,
    makeMove,
    resetGame,
    leaveRoom,
    errorMessage,
    incomingEmoji,
    myEmoji,
    sendEmoji,
    sendChat,
    sendNudge,
    isNudged,
    chatMessages
  };
};
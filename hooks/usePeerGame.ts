import { useState, useRef, useCallback, useEffect } from 'react';
import Peer, { DataConnection, MediaConnection, PeerOptions } from 'peerjs';
import { GameState, ConnectionStatus, Player, PeerMessage, ChatMessage } from '../types';
import { applyMoveToGameState, getInitialGameState } from '../utils/gameLogic';

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

  // Voice chat state
  const [isVoiceChatEnabled, setIsVoiceChatEnabled] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [opponentTalking, setOpponentTalking] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const connectionTimeoutRef = useRef<number | null>(null);
  const incomingEmojiTimeoutRef = useRef<number | null>(null);
  const myEmojiTimeoutRef = useRef<number | null>(null);
  const nudgeTimeoutRef = useRef<number | null>(null);
  
  // Voice chat refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<MediaConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

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
      const { nextState, winnerJustHappened } = applyMoveToGameState(prev, index, player);

      if (winnerJustHappened) {
        setScores((current) => ({ ...current, [winnerJustHappened]: current[winnerJustHappened] + 1 }));
      }

      return nextState;
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
    } else if (msg.type === 'VOICE_TALKING_START') {
      if (msg.player !== myPlayer) {
        setOpponentTalking(true);
      }
    } else if (msg.type === 'VOICE_TALKING_STOP') {
      if (msg.player !== myPlayer) {
        setOpponentTalking(false);
      }
    } else if (msg.type === 'VOICE_MUTE_TOGGLE') {
      // This is informational, opponent's mute state doesn't affect our UI directly
      // but we could use it for future features
    } else if (msg.type === 'VOICE_INITIALIZED') {
      // Opponent has initialized voice chat, if we haven't, we should too
      // This helps establish the connection faster
      if (!isVoiceChatEnabled && connectionStatus === 'connected') {
        console.log('Opponent initialized voice chat, we should too');
        // Don't auto-initialize (requires permission), but log it
      }
    }
  }, [appendChatMessage, createId, myPlayer, opponentName, updateGameLocal]);

  const cleanup = useCallback(() => {
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    if (incomingEmojiTimeoutRef.current) clearTimeout(incomingEmojiTimeoutRef.current);
    if (myEmojiTimeoutRef.current) clearTimeout(myEmojiTimeoutRef.current);
    if (nudgeTimeoutRef.current) clearTimeout(nudgeTimeoutRef.current);
    
    // Clean up voice chat
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (callRef.current) {
      try { callRef.current.close(); } catch {}
      callRef.current = null;
    }
    
    if (remoteAudioRef.current) {
      if (remoteAudioRef.current.srcObject) {
        const stream = remoteAudioRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      try { document.body.removeChild(remoteAudioRef.current); } catch {}
      remoteAudioRef.current = null;
    }
    
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
    
    // Reset voice chat state
    setIsVoiceChatEnabled(false);
    setIsMicMuted(false);
    setIsTalking(false);
    setOpponentTalking(false);
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

      // Set up MediaConnection listener for voice chat
      peer.on('call', (call) => {
        console.log('Host: Incoming call received');
        callRef.current = call;
        
        // If we have a stream, answer immediately
        if (mediaStreamRef.current) {
          console.log('Host: Answering call with existing stream');
          try {
            call.answer(mediaStreamRef.current);
          } catch (err) {
            console.error('Host: Error answering call:', err);
          }
        } else {
          console.log('Host: Call received but no stream yet, will answer when stream is ready');
          // Set up stream handler for when we get the stream
          call.on('stream', (remoteStream) => {
            console.log('Host: Remote stream received (before local stream)');
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remoteStream;
              remoteAudioRef.current.play().catch(err => {
                console.error('Error playing remote audio:', err);
              });
            }
          });
        }
        
        // Set up stream handler (will be called when remote stream arrives)
        call.on('stream', (remoteStream) => {
          console.log('Host: Remote stream received');
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            // Ensure audio plays
            remoteAudioRef.current.play().catch(err => {
              console.error('Error playing remote audio:', err);
            });
          }
        });

        call.on('open', () => {
          console.log('Host: Call opened');
        });

        call.on('close', () => {
          console.log('Host: Call closed');
          // Don't set to null immediately, might be reconnecting
        });

        call.on('error', (err) => {
          console.error('Host: MediaConnection error:', err);
        });
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
      
      // Set up MediaConnection listener for voice chat (in case host calls first)
      peer.on('call', (call) => {
        console.log('Incoming call received (joiner)');
        callRef.current = call;
        
        // If we have a stream, answer immediately
        if (mediaStreamRef.current) {
          console.log('Answering call with existing stream (joiner)');
          call.answer(mediaStreamRef.current);
        } else {
          console.log('Call received but no stream yet, will answer when stream is ready (joiner)');
        }
        
        call.on('stream', (remoteStream) => {
          console.log('Remote stream received (joiner)');
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            // Ensure audio plays
            remoteAudioRef.current.play().catch(err => {
              console.error('Error playing remote audio:', err);
            });
          }
        });

        call.on('close', () => {
          console.log('Call closed (joiner)');
          callRef.current = null;
        });

        call.on('error', (err) => {
          console.error('MediaConnection error (joiner):', err);
        });
      });
      
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

  // Initialize voice chat - request mic permission and create MediaStream
  const initializeVoiceChat = useCallback(async () => {
    if (isVoiceChatEnabled || !connectionStatus || connectionStatus !== 'connected') {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000  // Lower sample rate for voice chat (saves CPU)
        }
      });

      mediaStreamRef.current = stream;
      console.log('MediaStream created:', { 
        id: stream.id, 
        active: stream.active,
        audioTracks: stream.getAudioTracks().length 
      });
      
      // Ensure audio tracks are enabled by default
      stream.getAudioTracks().forEach(track => {
        track.enabled = true;
        console.log('Audio track:', { enabled: track.enabled, muted: track.muted, readyState: track.readyState });
      });
      
      setIsVoiceChatEnabled(true);
      
      // Notify opponent that we've initialized voice chat
      if (myPlayer) {
        sendMessage({ type: 'VOICE_INITIALIZED', player: myPlayer });
      }

      // Create hidden audio element for remote audio
      if (!remoteAudioRef.current) {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.playsInline = true;
        audio.style.display = 'none';
        audio.volume = 1.0;
        document.body.appendChild(audio);
        remoteAudioRef.current = audio;
        console.log('Remote audio element created');
      }

      // Set up MediaConnection based on role
      if (!peerRef.current) return;

      // If there's a pending call and we're the host, answer it now
      if (isHost && callRef.current) {
        const callState = callRef.current.open ? 'open' : 'pending';
        console.log(`Host: Answering ${callState} call with stream`);
        if (!callRef.current.open) {
          try {
            callRef.current.answer(stream);
            console.log('Host: Call answered successfully');
            // Wait a bit and verify the call is open
            setTimeout(() => {
              if (callRef.current) {
                console.log('Host: Call state after answer:', { open: callRef.current.open });
              }
            }, 500);
          } catch (err) {
            console.error('Host: Error answering call:', err);
          }
        } else {
          console.log('Host: Call already open');
        }
      } else if (!isHost) {
        // Joiner initiates call
        const hostPeerId = `${ID_PREFIX}${roomCode}`;
        console.log('Joiner: Initiating call to', hostPeerId);
        
        // If there's already a call, close it first
        if (callRef.current) {
          try {
            callRef.current.close();
          } catch {}
        }
        
        const call = peerRef.current.call(hostPeerId, stream);
        
        if (call) {
          callRef.current = call;
          
          call.on('stream', (remoteStream) => {
            console.log('Joiner: Remote stream received');
            if (remoteAudioRef.current) {
              remoteAudioRef.current.srcObject = remoteStream;
              // Ensure audio plays
              remoteAudioRef.current.play().catch(err => {
                console.error('Error playing remote audio:', err);
              });
            }
          });

          call.on('open', () => {
            console.log('Joiner: Call opened successfully');
          });

          call.on('close', () => {
            console.log('Joiner: Call closed');
            // Don't set to null immediately, might be reconnecting
          });

          call.on('error', (err) => {
            console.error('Joiner: MediaConnection error:', err);
            // Retry call if it fails and we still have a stream
            if (mediaStreamRef.current && connectionStatus === 'connected') {
              console.log('Joiner: Retrying call in 1 second...');
              setTimeout(() => {
                if (mediaStreamRef.current && peerRef.current && connectionStatus === 'connected') {
                  const retryCall = peerRef.current.call(hostPeerId, mediaStreamRef.current);
                  if (retryCall) {
                    callRef.current = retryCall;
                    retryCall.on('stream', (remoteStream) => {
                      if (remoteAudioRef.current) {
                        remoteAudioRef.current.srcObject = remoteStream;
                        remoteAudioRef.current.play().catch(() => {});
                      }
                    });
                    retryCall.on('open', () => console.log('Joiner: Retry call opened'));
                    retryCall.on('error', (err) => console.error('Joiner: Retry call error:', err));
                  }
                }
              }, 1000);
            }
          });
        } else {
          console.error('Joiner: Failed to create call');
        }
      }
    } catch (err) {
      console.error('Failed to initialize voice chat:', err);
      // Don't set isVoiceChatEnabled to true if permission denied
    }
  }, [isVoiceChatEnabled, connectionStatus, isHost, roomCode]);

  // Start talking (push-to-talk button pressed)
  const startTalking = useCallback(async () => {
    if (isMicMuted || !myPlayer || connectionStatus !== 'connected') return;
    
    // Initialize voice chat if not already done
    if (!isVoiceChatEnabled || !mediaStreamRef.current) {
      await initializeVoiceChat();
      // Wait a bit for initialization
      if (!mediaStreamRef.current) return;
    }

    // Enable audio track (resume processing if it was paused by mute)
    const audioTracks = mediaStreamRef.current.getAudioTracks();
    console.log('Enabling audio tracks:', audioTracks.length);
    audioTracks.forEach(track => {
      if (track.readyState !== 'ended') {
        console.log('Audio track state before:', { enabled: track.enabled, muted: track.muted, readyState: track.readyState });
        track.enabled = true;  // Resume CPU processing
        console.log('Audio track state after:', { enabled: track.enabled, muted: track.muted, readyState: track.readyState });
      }
    });

    // Verify call is open
    if (callRef.current) {
      console.log('Call state:', { open: callRef.current.open, peer: callRef.current.peer });
      if (!callRef.current.open) {
        console.warn('Call is not open!');
      }
    } else {
      console.warn('No call reference when trying to talk - MediaConnection may not be established');
    }

    setIsTalking(true);
    sendMessage({ type: 'VOICE_TALKING_START', player: myPlayer });
  }, [isVoiceChatEnabled, isMicMuted, myPlayer, connectionStatus, initializeVoiceChat, sendMessage]);

  // Stop talking (push-to-talk button released)
  const stopTalking = useCallback(() => {
    if (!isVoiceChatEnabled || !myPlayer) return;
    if (!mediaStreamRef.current) return;

    // Disable audio track to pause CPU processing when button is released
    const audioTracks = mediaStreamRef.current.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = false;  // Pause processing to save CPU
      console.log('Audio track disabled - CPU processing paused (button released)');
    });

    setIsTalking(false);
    sendMessage({ type: 'VOICE_TALKING_STOP', player: myPlayer });
  }, [isVoiceChatEnabled, myPlayer, sendMessage]);

  // Toggle mic mute
  const toggleMicMute = useCallback(() => {
    const newMuted = !isMicMuted;
    setIsMicMuted(newMuted);

    // If muting while talking, stop talking
    if (newMuted && isTalking) {
      stopTalking();
    }

    // Pause audio processing when muted to save CPU
    if (mediaStreamRef.current) {
      const audioTracks = mediaStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        if (newMuted) {
          // Disable track to pause processing (saves CPU)
          track.enabled = false;
          console.log('Audio track disabled due to mute - CPU processing paused');
        } else {
          // Re-enable when unmuted (if not talking, will be enabled when button is pressed)
          // Don't enable here, let startTalking handle it
          console.log('Audio track ready to be enabled on next talk');
        }
      });
    }

    if (myPlayer) {
      sendMessage({ type: 'VOICE_MUTE_TOGGLE', player: myPlayer, muted: newMuted });
    }
  }, [isMicMuted, isTalking, myPlayer, stopTalking, sendMessage]);

  // Auto-initialize voice chat when connection is established
  useEffect(() => {
    if (connectionStatus === 'connected' && !isVoiceChatEnabled && peerRef.current) {
      // Auto-initialize voice chat to establish MediaConnection early
      // This way when users press the button, audio flows immediately
      console.log('Auto-initializing voice chat...');
      initializeVoiceChat().catch(err => {
        console.warn('Auto-initialization of voice chat failed (user may deny permission):', err);
        // Don't show error to user, they can still press button to retry
      });
    }
  }, [connectionStatus, isVoiceChatEnabled, initializeVoiceChat]);

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
    chatMessages,
    // Voice chat
    isVoiceChatEnabled,
    isMicMuted,
    isTalking,
    opponentTalking,
    startTalking,
    stopTalking,
    toggleMicMute,
    initializeVoiceChat
  };
};
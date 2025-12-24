import React, { useState } from 'react';
import { usePeerGame } from './hooks/usePeerGame';
import { WelcomeScreen } from './components/WelcomeScreen';
import { GameBoard } from './components/GameBoard';
import { SinglePlayerBoard } from './components/SinglePlayerBoard';
import { Loader2, Copy } from 'lucide-react';
import clsx from 'clsx';
import { useAIGame } from './hooks/useAIGame';
import type { AiLevel } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<'welcome' | 'multiplayer' | 'ai'>('welcome');

  const {
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
    sendNudge,
    isNudged,
    sendChat,
    chatMessages
  } = usePeerGame();

  const ai = useAIGame();
  
  const [copied, setCopied] = useState(false);
  
  const copyRoomCode = async () => {
    if (!roomCode) return;
    
    // Fallback copy method
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
        textArea.setSelectionRange(0, 99999);
        
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
      // Still show brief feedback
      setCopied(true);
      setTimeout(() => setCopied(false), 500);
    }
  };

  const renderContent = () => {
    // AI Mode
    if (mode === 'ai') {
      return (
        <SinglePlayerBoard
          gameState={ai.gameState}
          playerName={ai.config?.name ?? 'You'}
          aiName="AI"
          scores={ai.scores}
          difficulty={ai.config?.difficulty ?? 'medium'}
          aiThinking={ai.aiThinking}
          onMove={ai.makeMove}
          onReset={ai.resetGame}
          onLeave={() => {
            ai.leave();
            setMode('welcome');
          }}
        />
      );
    }

    // Welcome screen (explicit or fallback on errors/disconnect)
    if (mode === 'welcome' || connectionStatus === 'disconnected' || connectionStatus === 'error') {
      return (
        <WelcomeScreen
          onCreate={(name, gridSize, winCondition) => {
            setMode('multiplayer');
            createRoom(name, gridSize, winCondition);
          }}
          onJoin={(code, name) => {
            setMode('multiplayer');
            joinRoom(code, name);
          }}
          onStartAi={(name, gridSize, winCondition, difficulty: AiLevel) => {
            ai.start({ name, gridSize, winCondition, difficulty });
            setMode('ai');
          }}
          isConnecting={connectionStatus === 'connecting'}
          error={errorMessage}
        />
      );
    }

    // Multiplayer connecting state
    if (connectionStatus === 'connecting') {
      return (
        <div className="flex flex-col items-center gap-6 p-8 pb-32 bg-slate-800/50 rounded-2xl backdrop-blur-sm border border-slate-700 animate-pulse">
           <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
           <div className="text-center">
             <p className="text-slate-300 font-medium text-lg">Connecting to network...</p>
             <p className="text-slate-500 text-sm mt-1">Establishing secure P2P connection</p>
           </div>

           {/* Mobile fixed cancel button */}
           <div className="sm:hidden fixed left-0 right-0 bottom-0 z-50 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] bg-slate-950/80 backdrop-blur border-t border-white/10">
             <button
              onClick={() => {
                leaveRoom();
                setMode('welcome');
              }}
               className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl font-black transition-all shadow-xl shadow-red-500/20"
             >
               Cancel Connection
             </button>
           </div>

           {/* Desktop inline cancel button */}
           <button
             onClick={() => {
               leaveRoom();
               setMode('welcome');
             }}
             className="hidden sm:block px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-600"
           >
             Cancel
           </button>
        </div>
      );
    }
  };
  
  // Logic: Host waiting for opponent. 
  // 'disconnected' here implies the Peer is open (handled in hook) but no data connection yet.
  const isWaitingForOpponent = mode === 'multiplayer' && isHost && roomCode && connectionStatus === 'disconnected';
  const allowScroll = (mode === 'ai') || (mode === 'multiplayer' && connectionStatus === 'connected');

  return (
    <div className={clsx(
      "app-shell min-h-[100svh] w-full flex items-start sm:items-center justify-center px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]",
      // Only allow scrolling when connected (game active), not during welcome/join
      allowScroll ? "overflow-y-auto" : "overflow-hidden"
    )}>
      <div className="relative z-10 w-full flex justify-center">
        {mode === 'multiplayer' && connectionStatus === 'connected' ? (
          <GameBoard
            gameState={gameState}
            myPlayer={myPlayer}
            roomCode={roomCode}
            isHost={isHost}
            myName={myName}
            opponentName={opponentName}
            scores={scores}
            onMove={makeMove}
            onReset={resetGame}
            onLeave={() => {
              leaveRoom();
              setMode('welcome');
            }}
            incomingEmoji={incomingEmoji}
            myEmoji={myEmoji}
            onSendEmoji={sendEmoji}
            onSendNudge={sendNudge}
            isNudged={isNudged}
            onSendChat={sendChat}
            chatMessages={chatMessages}
          />
        ) : isWaitingForOpponent ? (
          <div className="flex flex-col items-center gap-6 p-8 bg-slate-950/45 backdrop-blur-xl rounded-2xl border border-white/10 ring-1 ring-white/5 max-w-sm w-full text-center shadow-2xl">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse"></div>
              <Loader2 className="w-16 h-16 text-indigo-400 animate-spin relative z-10" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Room Created</h2>
              <p className="text-slate-400">Share this code with your friend</p>
            </div>

            <div className="bg-slate-950/50 border border-white/10 px-8 py-4 rounded-xl flex items-center gap-4 shadow-xl">
              <span className="text-4xl font-mono font-bold text-white tracking-[0.2em]">{roomCode}</span>
              <button
                onClick={copyRoomCode}
                className={clsx(
                  "p-2 rounded-lg transition-all",
                  copied 
                    ? "bg-emerald-500/20 text-emerald-400" 
                    : "text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50"
                )}
                title={copied ? "Copied!" : "Copy room code"}
              >
                <Copy className={clsx("w-5 h-5 transition-transform", copied && "scale-110")} />
              </button>
            </div>
            
            <p className="text-sm text-slate-500 animate-pulse">Waiting for player to join...</p>
            
            <button
              onClick={() => {
                leaveRoom();
                setMode('welcome');
              }}
              className="text-slate-400 hover:text-white text-sm underline underline-offset-4"
            >
              Cancel
            </button>
          </div>
        ) : (
          renderContent()
        )}
      </div>
    </div>
  );
};

export default App;

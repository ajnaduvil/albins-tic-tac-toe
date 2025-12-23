import React from 'react';
import { usePeerGame } from './hooks/usePeerGame';
import { WelcomeScreen } from './components/WelcomeScreen';
import { GameBoard } from './components/GameBoard';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
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

  const renderContent = () => {
    // 1. Initial State or Error
    if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
      return (
        <WelcomeScreen 
          onCreate={createRoom} 
          onJoin={joinRoom} 
          isConnecting={false} 
          error={errorMessage} 
        />
      );
    }

    // 2. Connecting State (for joiners mostly, or hosts initializing)
    if (connectionStatus === 'connecting') {
      return (
        <div className="flex flex-col items-center gap-6 p-8 bg-slate-800/50 rounded-2xl backdrop-blur-sm border border-slate-700 animate-pulse">
           <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
           <div className="text-center">
             <p className="text-slate-300 font-medium text-lg">Connecting to network...</p>
             <p className="text-slate-500 text-sm mt-1">Establishing secure P2P connection</p>
           </div>
           <button 
             onClick={leaveRoom}
             className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-600"
           >
             Cancel
           </button>
        </div>
      );
    }
  };
  
  // Logic: Host waiting for opponent. 
  // 'disconnected' here implies the Peer is open (handled in hook) but no data connection yet.
  const isWaitingForOpponent = isHost && roomCode && connectionStatus === 'disconnected';

  return (
    <div className="min-h-screen w-full bg-[#0f172a] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0f172a] to-black flex items-center justify-center p-4">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[100px]" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full flex justify-center">
        {connectionStatus === 'connected' ? (
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
            onLeave={leaveRoom}
            incomingEmoji={incomingEmoji}
            myEmoji={myEmoji}
            onSendEmoji={sendEmoji}
            onSendNudge={sendNudge}
            isNudged={isNudged}
            onSendChat={sendChat}
            chatMessages={chatMessages}
          />
        ) : isWaitingForOpponent ? (
          <div className="flex flex-col items-center gap-6 p-8 bg-slate-800/80 rounded-2xl border border-slate-700 max-w-sm w-full text-center shadow-2xl">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse"></div>
              <Loader2 className="w-16 h-16 text-indigo-400 animate-spin relative z-10" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Room Created</h2>
              <p className="text-slate-400">Share this code with your friend</p>
            </div>

            <div className="bg-slate-900 border-2 border-indigo-500/30 px-8 py-4 rounded-xl">
              <span className="text-4xl font-mono font-bold text-white tracking-[0.2em]">{roomCode}</span>
            </div>
            
            <p className="text-sm text-slate-500 animate-pulse">Waiting for player to join...</p>
            
            <button onClick={leaveRoom} className="text-slate-400 hover:text-white text-sm underline underline-offset-4">
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
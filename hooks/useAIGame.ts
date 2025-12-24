import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiLevel, GameState, Player } from '../types';
import { applyMoveToGameState, getInitialGameState } from '../utils/gameLogic';
import { chooseAiMove } from '../utils/ai';

export interface AiGameConfig {
  name: string;
  gridSize: number;
  winCondition: number;
  difficulty: AiLevel;
}

export const useAIGame = () => {
  const [config, setConfig] = useState<AiGameConfig | null>(null);
  const [gameState, setGameState] = useState<GameState>(getInitialGameState());
  const [scores, setScores] = useState<{ X: number; O: number }>({ X: 0, O: 0 });
  const [aiThinking, setAiThinking] = useState(false);
  const [starter, setStarter] = useState<Player>('X');
  const timeoutRef = useRef<number | null>(null);
  const scheduledForRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const start = useCallback((next: AiGameConfig) => {
    setConfig(next);
    setScores({ X: 0, O: 0 });
    setAiThinking(false);
    setStarter('X');
    setGameState(getInitialGameState('X', next.gridSize, next.winCondition));
  }, []);

  const leave = useCallback(() => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    scheduledForRef.current = null;
    setAiThinking(false);
    setConfig(null);
    setStarter('X');
    setScores({ X: 0, O: 0 });
    setGameState(getInitialGameState());
  }, []);

  const applyMoveLocal = useCallback((index: number, player: Player) => {
    setGameState((prev) => {
      const { nextState, winnerJustHappened } = applyMoveToGameState(prev, index, player);
      if (winnerJustHappened) {
        setScores((s) => ({ ...s, [winnerJustHappened]: s[winnerJustHappened] + 1 }));
      }
      return nextState;
    });
  }, []);

  const makeMove = useCallback((index: number) => {
    if (aiThinking) return;
    if (gameState.status !== 'playing') return;
    if (gameState.currentPlayer !== 'X') return;
    if (gameState.board[index]) return;
    applyMoveLocal(index, 'X');
  }, [aiThinking, applyMoveLocal, gameState.board, gameState.currentPlayer, gameState.status]);

  const resetGame = useCallback(() => {
    if (!config) return;
    const nextStarter: Player = starter === 'X' ? 'O' : 'X';
    setStarter(nextStarter);
    setAiThinking(false);
    scheduledForRef.current = null;
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setGameState(getInitialGameState(nextStarter, config.gridSize, config.winCondition));
  }, [config, starter]);

  // AI turn loop
  useEffect(() => {
    if (!config) return;
    if (gameState.status !== 'playing') {
      setAiThinking(false);
      scheduledForRef.current = null;
      return;
    }
    if (gameState.currentPlayer !== 'O') {
      setAiThinking(false);
      scheduledForRef.current = null;
      return;
    }

    const turnKey = `O:${config.difficulty}:${gameState.board.map((v) => v ?? '-').join('')}:${gameState.gridSize}:${gameState.winCondition}`;
    if (scheduledForRef.current === turnKey) return;
    scheduledForRef.current = turnKey;

    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;

    setAiThinking(true);

    const move = chooseAiMove({
      board: gameState.board,
      gridSize: gameState.gridSize,
      winCondition: gameState.winCondition,
      aiPlayer: 'O',
      level: config.difficulty,
    });

    // Artificial "thinking" delay to feel more human.
    // Keep it consistent enough to be noticeable, but jittered to avoid feeling robotic.
    const delayMs = (config.difficulty === 'extreme')
      ? 950 + Math.floor(Math.random() * 600)
      : 750 + Math.floor(Math.random() * 450);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setAiThinking(false);

      setGameState((prev) => {
        if (prev.status !== 'playing') return prev;
        if (prev.currentPlayer !== 'O') return prev;

        const legal = prev.board[move] === null ? move : chooseAiMove({
          board: prev.board,
          gridSize: prev.gridSize,
          winCondition: prev.winCondition,
          aiPlayer: 'O',
          level: config.difficulty,
        });

        const { nextState, winnerJustHappened } = applyMoveToGameState(prev, legal, 'O');
        if (winnerJustHappened) {
          setScores((s) => ({ ...s, [winnerJustHappened]: s[winnerJustHappened] + 1 }));
        }
        return nextState;
      });
    }, delayMs);
  }, [config, gameState.board, gameState.currentPlayer, gameState.gridSize, gameState.status, gameState.winCondition]);

  return {
    config,
    gameState,
    scores,
    aiThinking,
    start,
    makeMove,
    resetGame,
    leave,
  };
};



import type { AiLevel, CellValue, Player } from '../types';
import { checkWinner, getWinningCombinations, isDraw } from './gameLogic';

const other = (p: Player): Player => (p === 'X' ? 'O' : 'X');

const nowMs = (): number => {
  // `performance.now()` is monotonic (better for budgets), but may not exist in some environments.
  // Fall back to Date.now() for safety.
  try {
    return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  } catch {
    return Date.now();
  }
};

const legalMoves = (board: CellValue[]) => {
  const moves: number[] = [];
  for (let i = 0; i < board.length; i++) if (board[i] === null) moves.push(i);
  return moves;
};

const applyMove = (board: CellValue[], idx: number, p: Player) => {
  const b = board.slice();
  b[idx] = p;
  return b;
};

const findImmediateWin = (board: CellValue[], winCondition: number, p: Player): number | null => {
  for (const m of legalMoves(board)) {
    const b = applyMove(board, m, p);
    if (checkWinner(b, winCondition).winner === p) return m;
  }
  return null;
};

// Heuristic for larger boards / limited search
const evaluateBoard = (
  board: CellValue[],
  gridSize: number,
  winCondition: number,
  ai: Player
): number => {
  const opp = other(ai);
  const combos = getWinningCombinations(gridSize, winCondition);

  let score = 0;
  for (const combo of combos) {
    let aiCount = 0;
    let oppCount = 0;

    for (const i of combo) {
      const v = board[i];
      if (v === ai) aiCount++;
      else if (v === opp) oppCount++;
    }

    // blocked
    if (aiCount > 0 && oppCount > 0) continue;
    if (aiCount === 0 && oppCount === 0) continue;

    const weight = (n: number) => Math.pow(10, n - 1); // 1, 10, 100, ...
    if (aiCount > 0) score += weight(aiCount);
    if (oppCount > 0) score -= weight(oppCount);
  }

  // Small bias towards the center-ish cell (helps early game, reduces randomness weirdness)
  const center = Math.floor(board.length / 2);
  if (board[center] === ai) score += 0.5;
  if (board[center] === opp) score -= 0.5;

  return score;
};

const minimaxAB = (
  board: CellValue[],
  gridSize: number,
  winCondition: number,
  ai: Player,
  toMove: Player,
  depth: number,
  alpha: number,
  beta: number,
  deadlineMs: number
): number => {
  if (nowMs() > deadlineMs) return evaluateBoard(board, gridSize, winCondition, ai);

  const w = checkWinner(board, winCondition).winner;
  if (w === ai) return 1_000_000 + depth; // prefer faster wins
  if (w === other(ai)) return -1_000_000 - depth; // prefer slower losses
  if (isDraw(board) || depth === 0) return evaluateBoard(board, gridSize, winCondition, ai);

  const moves = legalMoves(board);

  if (toMove === ai) {
    let best = -Infinity;
    for (const m of moves) {
      const s = minimaxAB(applyMove(board, m, toMove), gridSize, winCondition, ai, other(toMove), depth - 1, alpha, beta, deadlineMs);
      best = Math.max(best, s);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const m of moves) {
    const s = minimaxAB(applyMove(board, m, toMove), gridSize, winCondition, ai, other(toMove), depth - 1, alpha, beta, deadlineMs);
    best = Math.min(best, s);
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
};

const pickTopK = (scored: Array<{ m: number; s: number }>, k: number) => {
  scored.sort((a, b) => b.s - a.s);
  const top = scored.slice(0, Math.min(k, scored.length));
  return top[Math.floor(Math.random() * top.length)]!.m;
};

export const chooseAiMove = (params: {
  board: CellValue[];
  gridSize: number;
  winCondition: number;
  aiPlayer: Player;
  level: AiLevel;
}): number => {
  const { board, gridSize, winCondition, aiPlayer: ai, level } = params;

  const moves = legalMoves(board);
  if (moves.length === 0) return -1;

  // Always take a win if available (all difficulties)
  const winNow = findImmediateWin(board, winCondition, ai);
  if (winNow !== null) return winNow;

  const opp = other(ai);

  // Medium/Hard: block immediate loss
  if (level !== 'easy') {
    const blockNow = findImmediateWin(board, winCondition, opp);
    if (blockNow !== null) return blockNow;
  }

  // Easy: still imperfect, but should not feel completely clueless.
  // Typical approach: simple tactics + strong randomness + occasional mistakes.
  if (level === 'easy') {
    // If we must block a 1-move loss, do it *most* of the time (but not always).
    const mustBlock = findImmediateWin(board, winCondition, opp);
    if (mustBlock !== null && Math.random() < 0.75) return mustBlock;

    // Small opening preference for center on odd-sized boards (human-like).
    const center = Math.floor(board.length / 2);
    if (gridSize % 2 === 1 && board[center] === null && Math.random() < 0.45) return center;

    // Score moves with heuristic, but strongly penalize moves that allow an immediate opponent win.
    const scored = moves.map((m) => {
      const after = applyMove(board, m, ai);
      let s = evaluateBoard(after, gridSize, winCondition, ai);
      const oppWinNext = findImmediateWin(after, winCondition, opp);
      if (oppWinNext !== null) s -= 100_000; // avoid obvious blunders
      return { m, s };
    });

    // Easy should still be unpredictable:
    // - often pick from top few reasonable moves
    // - sometimes do a random move anyway
    if (Math.random() < 0.8) return pickTopK(scored, 5);
    return moves[Math.floor(Math.random() * moves.length)]!;
  }

  const perfectCase = gridSize === 3 && winCondition === 3;
  const timeBudgetMs = level === 'hard' ? 80 : 30;
  const deadline = nowMs() + timeBudgetMs;

  // Depth tuning by board size (kept conservative to avoid UI stalls)
  const depth =
    perfectCase ? moves.length :
    gridSize === 4 ? (level === 'hard' ? 5 : 4) :
    gridSize === 5 ? (level === 'hard' ? 4 : 3) :
    /* 6x6 */       (level === 'hard' ? 3 : 2);

  // Medium: pick among top few moves to feel human
  const topK = level === 'hard' ? 1 : 3;

  const scored = moves.map((m) => {
    const b = applyMove(board, m, ai);
    const s = minimaxAB(b, gridSize, winCondition, ai, opp, depth - 1, -Infinity, Infinity, deadline);
    return { m, s };
  });

  return pickTopK(scored, topK);
};



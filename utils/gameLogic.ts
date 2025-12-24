import { CellValue, GameState, Player } from '../types';

export const getWinningCombinations = (size: number, winLength: number): number[][] => {
  const combos: number[][] = [];
  
  // Rows
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - winLength; c++) {
      const line = [];
      for (let k = 0; k < winLength; k++) {
        line.push(r * size + (c + k));
      }
      combos.push(line);
    }
  }

  // Cols
  for (let c = 0; c < size; c++) {
    for (let r = 0; r <= size - winLength; r++) {
      const line = [];
      for (let k = 0; k < winLength; k++) {
        line.push((r + k) * size + c);
      }
      combos.push(line);
    }
  }

  // Diagonals (Top-Left to Bottom-Right)
  for (let r = 0; r <= size - winLength; r++) {
    for (let c = 0; c <= size - winLength; c++) {
      const line = [];
      for (let k = 0; k < winLength; k++) {
        line.push((r + k) * size + (c + k));
      }
      combos.push(line);
    }
  }

  // Diagonals (Top-Right to Bottom-Left)
  for (let r = 0; r <= size - winLength; r++) {
    for (let c = winLength - 1; c < size; c++) {
      const line = [];
      for (let k = 0; k < winLength; k++) {
        line.push((r + k) * size + (c - k));
      }
      combos.push(line);
    }
  }

  return combos;
};

export const checkWinner = (board: CellValue[], winCondition: number): { winner: Player | null, line: number[] | null } => {
  const size = Math.sqrt(board.length);
  // Sanity check for perfect square
  if (size % 1 !== 0) return { winner: null, line: null };

  const combinations = getWinningCombinations(size, winCondition);

  for (const combo of combinations) {
    const firstIndex = combo[0];
    const firstCell = board[firstIndex];
    
    if (!firstCell) continue;

    let isWinning = true;
    for (let i = 1; i < combo.length; i++) {
      if (board[combo[i]] !== firstCell) {
        isWinning = false;
        break;
      }
    }

    if (isWinning) {
      return { winner: firstCell, line: combo };
    }
  }
  return { winner: null, line: null };
};

export const isDraw = (board: CellValue[]): boolean => {
  return board.every((cell) => cell !== null);
};

// "Dead position" draw: no matter how the remaining moves are played,
// neither player can complete any winning line anymore.
export const isForcedDraw = (board: CellValue[], winCondition: number, nextPlayer: Player): boolean => {
  const size = Math.sqrt(board.length);
  // Sanity check for perfect square
  if (size % 1 !== 0) return false;

  const combinations = getWinningCombinations(size, winCondition);

  const emptyCount = board.reduce((acc, cell) => (cell === null ? acc + 1 : acc), 0);
  const movesRemainingFor = (player: Player) => {
    // Remaining turns alternate starting with `nextPlayer`.
    // Example: if 5 empty cells and nextPlayer is X, X gets 3 turns, O gets 2.
    const first = Math.ceil(emptyCount / 2);
    const second = Math.floor(emptyCount / 2);
    return player === nextPlayer ? first : second;
  };

  const hasPotentialWin = (player: Player) => {
    const opponent: Player = player === 'X' ? 'O' : 'X';
    const remainingTurns = movesRemainingFor(player);

    return combinations.some((combo) => {
      // If opponent already occupies any cell in this segment, it's blocked.
      for (const i of combo) {
        if (board[i] === opponent) return false;
      }
      // Player needs to fill all empty cells in this segment, which must be <= their remaining turns.
      let needed = 0;
      for (const i of combo) {
        if (board[i] === null) needed++;
      }
      return needed <= remainingTurns;
    });
  };

  return !hasPotentialWin('X') && !hasPotentialWin('O');
};

export const getInitialGameState = (startingPlayer: Player = 'X', gridSize: number = 3, winCondition: number = 3): GameState => ({
  board: Array(gridSize * gridSize).fill(null),
  currentPlayer: startingPlayer,
  status: 'playing',
  winner: null,
  winningLine: null,
  gridSize,
  winCondition
});
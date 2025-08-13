// minimax.js
// Basic minimax algorithm implementation for tic-tac-toe
// NOTE: This is an unoptimized version without alpha-beta pruning, negamax, etc.
// Suitable for simple games like tic-tac-toe due to small game tree.

/**
 * Basic Minimax Algorithm for Tic-Tac-Toe
 * 
 * This is a straightforward implementation without optimizations.
 * For tic-tac-toe's small game tree (~9! = 362,880 possible games),
 * this unoptimized version is sufficient and clear.
 * 
 * @param {Object} gameState - Current state of the game
 * @param {number} depth - Current depth in the game tree
 * @param {boolean} isMaximizing - True if maximizing player's turn
 * @param {string} maxPlayer - Mark type for maximizing player ("X" or "O")
 * @param {string} minPlayer - Mark type for minimizing player ("X" or "O")
 * @param {Function} evaluateBoard - Function to evaluate board state
 * @param {Function} getAvailableMoves - Function to get available moves
 * @param {Function} makeMove - Function to apply a move and return new state
 * @param {Function} isTerminal - Function to check if game is over
 * @returns {Object} { score: number, move: {x, y} }
 */
export function minimax(
  gameState,
  depth,
  isMaximizing,
  maxPlayer,
  minPlayer,
  evaluateBoard,
  getAvailableMoves,
  makeMove,
  isTerminal
) {
  // Base case: terminal state or max depth reached
  if (isTerminal(gameState) || depth === 0) {
    return {
      score: evaluateBoard(gameState, maxPlayer, minPlayer),
      move: null
    };
  }

  const availableMoves = getAvailableMoves(gameState);
  
  if (availableMoves.length === 0) {
    return {
      score: evaluateBoard(gameState, maxPlayer, minPlayer),
      move: null
    };
  }

  let bestMove = null;
  let bestScore = isMaximizing ? -Infinity : Infinity;

  for (const move of availableMoves) {
    // Apply the move
    const newGameState = makeMove(gameState, move, isMaximizing ? maxPlayer : minPlayer);
    
    // Recursively call minimax for the opposite player
    const result = minimax(
      newGameState,
      depth - 1,
      !isMaximizing,
      maxPlayer,
      minPlayer,
      evaluateBoard,
      getAvailableMoves,
      makeMove,
      isTerminal
    );

    // Update best score and move
    if (isMaximizing) {
      if (result.score > bestScore) {
        bestScore = result.score;
        bestMove = move;
      }
    } else {
      if (result.score < bestScore) {
        bestScore = result.score;
        bestMove = move;
      }
    }
  }

  return {
    score: bestScore,
    move: bestMove
  };
}

/**
 * Simplified minimax function specifically for tic-tac-toe
 * Handles the game-specific logic internally
 * 
 * @param {Object} tileMap - The game's tile map
 * @param {string} computerMark - Computer's mark ("X" or "O")
 * @param {string} humanMark - Human's mark ("X" or "O") 
 * @param {number} maxDepth - Maximum search depth (default: 9 for full search)
 * @returns {Object} { x, y } - Best move coordinates
 */
export function minimaxTicTacToe(tileMap, computerMark, humanMark, maxDepth = 9) {
  // Helper functions for tic-tac-toe specific logic
  
  /**
   * Check if someone has won the game
   */

  function getMarkType(tile) {
    if (!tile) {
      return null;
    }
    if (tile.getMarkType) {
      return tile.getMarkType();
    }
    return tile.type;
  }

  function checkWinner(board) {
    const size = 3; // Standard tic-tac-toe is 3x3
    
    // Check rows
    for (let y = 0; y < size; y++) {
      const row = [];
      for (let x = 0; x < size; x++) {
        const tile = board[y] && board[y][x];
        row.push(getMarkType(tile));
      }
      if (row[0] && row[0] === row[1] && row[1] === row[2]) {
        return row[0];
      }
    }
    
    // Check columns
    for (let x = 0; x < size; x++) {
      const col = [];
      for (let y = 0; y < size; y++) {
        const tile = board[y] && board[y][x];
        col.push(getMarkType(tile));
      }
      if (col[0] && col[0] === col[1] && col[1] === col[2]) {
        return col[0];
      }
    }
    
    // Check diagonals
    const diag1 = [
      board[0] && board[0][0] ? getMarkType(board[0][0]) : null,
      board[1] && board[1][1] ? getMarkType(board[1][1]) : null,
      board[2] && board[2][2] ? getMarkType(board[2][2]) : null
    ];
    if (diag1[0] && diag1[0] === diag1[1] && diag1[1] === diag1[2]) {
      return diag1[0];
    }
    
    const diag2 = [
      board[0] && board[0][2] ? getMarkType(board[0][2]) : null,
      board[1] && board[1][1] ? getMarkType(board[1][1]) : null,
      board[2] && board[2][0] ? getMarkType(board[2][0]) : null
    ];
    if (diag2[0] && diag2[0] === diag2[1] && diag2[1] === diag2[2]) {
      return diag2[0];
    }
    
    return null; // No winner
  }
  
  /**
   * Convert tile map to 2D array for easier processing
   */
  function tileMapToBoard(tileMap) {
    const board = [];
    for (let y = 0; y < tileMap.height; y++) {
      board[y] = [];
      for (let x = 0; x < tileMap.width; x++) {
        board[y][x] = tileMap.getTile(x, y);
      }
    }
    return board;
  }
  
  /**
   * Evaluate the board state
   * +10 for computer win, -10 for human win, 0 for draw/ongoing
   */
  function evaluateBoard(gameState) {
    const winner = checkWinner(gameState.board);
    if (winner === computerMark) return 10;
    if (winner === humanMark) return -10;
    return 0;
  }
  
  /**
   * Get all available moves
   */
  function getAvailableMoves(gameState) {
    const moves = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        if (!gameState.board[y][x]) {
          moves.push({ x, y });
        }
      }
    }
    return moves;
  }
  
  /**
   * Apply a move and return new game state
   */
  function makeMove(gameState, move, mark) {
    const newBoard = gameState.board.map(row => [...row]); // Deep copy
    newBoard[move.y][move.x] = { type: mark };
    return { board: newBoard };
  }
  
  /**
   * Check if game is terminal (won or draw)
   */
  function isTerminal(gameState) {
    const winner = checkWinner(gameState.board);
    if (winner) return true;
    
    // Check for draw (no empty spaces)
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        if (!gameState.board[y][x]) {
          return false; // Still has empty spaces
        }
      }
    }
    return true; // Draw
  }
  
  // Convert tile map to game state
  const initialGameState = {
    board: tileMapToBoard(tileMap)
  };
  
  // Run minimax algorithm
  const result = minimax(
    initialGameState,
    maxDepth,
    true, // Computer is maximizing player
    computerMark,
    humanMark,
    evaluateBoard,
    getAvailableMoves,
    makeMove,
    isTerminal
  );
  
  return result.move;
}

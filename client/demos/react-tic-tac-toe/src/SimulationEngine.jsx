import React, { createContext, useContext } from "react";
import { GameProvider, useGame } from "./GameContext";

const SimulationEngineContext = createContext();

export function SimulationEngineProvider({ children }) {
  // Use the real game context under the hood
  return (
    <GameProvider>
      <SimulationEngineCore>{children}</SimulationEngineCore>
    </GameProvider>
  );
}

function SimulationEngineCore({ children }) {
  const { gameState, setGameState } = useGame();

  // Simulate a backend action handler
  function onCellClick(row, col) {
    // In a real app, this would send an action to the backend and update gameState from the response
    // For now, just update the matrix and alternate turn for demo
    const key = `${row},${col}`;
    const nextMatrix = { ...gameState.matrix, [key]: gameState.turn };
    const nextTurn = gameState.turn === "X" ? "O" : "X";

    // Calculate valid moves (empty cells)
    const validMoves = Object.keys(nextMatrix).filter(
      (cellKey) => nextMatrix[cellKey] === ""
    );

    // Check if it's still the player's turn after this move
    const isPlayerTurn = nextTurn === gameState.player;

    setGameState({
      ...gameState,
      matrix: nextMatrix,
      turn: nextTurn,
      status: `Player ${nextTurn}'s turn`,
      isPlayerTurn,
      validMoves,
      gameActive: validMoves.length > 0, // Game active if there are moves left
    });
  }

  // Simulation functions for SimulationArea (simulating backend state updates)
  function simulateGameStateUpdate(updates) {
    // In a real app, this would be a WebSocket message from backend
    // For now, simulate by updating state with validation recalculation
    const newState = { ...gameState, ...updates };

    // Recalculate validation fields based on new state
    if (updates.matrix || updates.turn || updates.player) {
      const validMoves = Object.keys(newState.matrix).filter(
        (cellKey) => newState.matrix[cellKey] === ""
      );
      newState.validMoves = validMoves;
      newState.isPlayerTurn = newState.turn === newState.player;
      newState.gameActive = validMoves.length > 0;
    }

    setGameState(newState);
  }

  function simulateSetCell(row, col, value) {
    const key = `${row},${col}`;
    const updatedMatrix = { ...gameState.matrix, [key]: value };
    simulateGameStateUpdate({ matrix: updatedMatrix });
  }

  function simulateSetField(field, value) {
    simulateGameStateUpdate({ [field]: value });
  }

  // Expose gameState and the action handlers
  const value = {
    gameState,
    onCellClick,
    // Simulation functions for testing/demo
    simulateGameStateUpdate,
    simulateSetCell,
    simulateSetField,
  };

  // For demo: expose globally for GameCanvas to call
  if (typeof window !== "undefined") {
    window.simulationEngine = value;
  }

  return (
    <SimulationEngineContext.Provider value={value}>
      {children}
    </SimulationEngineContext.Provider>
  );
}

export function useSimulationEngine() {
  return useContext(SimulationEngineContext);
}

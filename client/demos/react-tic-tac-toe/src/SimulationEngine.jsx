import React, { createContext, useContext, useState, useEffect } from "react";
import { GameProvider, useGame } from "./GameContext";

const SimulationEngineContext = createContext();

// Simulated initial game state (what backend would send when joining a game)
const simulatedInitialState = {
  matrix: {
    "0,0": "",
    "0,1": "",
    "0,2": "",
    "1,0": "",
    "1,1": "",
    "1,2": "",
    "2,0": "",
    "2,1": "",
    "2,2": "",
  },
  turn: "X", // 'X' or 'O'
  player: "X", // 'X' or 'O' (who you are)
  status: "Player X's turn",
  // Validation fields (would come from backend)
  isPlayerTurn: true, // Is it this player's turn?
  gameActive: true, // Is the game still active (not finished)?
  validMoves: ["0,0", "0,1", "0,2", "1,0", "1,1", "1,2", "2,0", "2,1", "2,2"], // Valid cell keys
  hostExists: false, // Simulate if a host is present (for join overlay)
};

export function SimulationEngineProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    // Simulate backend connection delay
    const timeout = setTimeout(() => {
      setGameState(simulatedInitialState);
      setIsLoading(false);
    }, 1500);

    return () => clearTimeout(timeout);
  }, []);

  // Provide loading state to children, let App decide what to render
  if (isLoading || !gameState) {
    return (
      <SimulationEngineContext.Provider
        value={{ isLoading: true, gameState: null, ready: false }}
      >
        {children}
      </SimulationEngineContext.Provider>
    );
  }

  // Once loaded, provide full game functionality
  return (
    <GameProvider initialState={gameState}>
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

  // Simulate joining as player 2 (for demo)
  function simulateJoin() {
    // In a real app, this would notify the backend and get a new state
    // Here, just set player to 'O' and remove hostExists
    setGameState({
      ...gameState,
      player: "O",
      status: "Player O's turn",
      hostExists: false,
    });
  }

  // Expose gameState and the action handlers
  const value = {
    gameState,
    onCellClick,
    // Simulation functions for testing/demo
    simulateGameStateUpdate,
    simulateSetCell,
    simulateSetField,
    simulateJoin,
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
  const context = useContext(SimulationEngineContext);
  if (!context) {
    throw new Error(
      "useSimulationEngine must be used within SimulationEngineProvider"
    );
  }
  return context;
}

import { createContext, useContext, useState } from "react";

const GameContext = createContext();

export function GameProvider({ children, initialState }) {
  const [gameState, setGameState] = useState(initialState);
  return (
    <GameContext.Provider value={{ gameState, setGameState }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}

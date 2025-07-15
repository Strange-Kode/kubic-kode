// Custom hook to use the SimulationEngine context
export function useSimulationEngine() {
  const context = useContext(SimulationEngineContext);
  if (!context) {
    throw new Error(
      "useSimulationEngine must be used within a SimulationEngineProvider"
    );
  }
  return context;
}
import { createContext, useContext, useState, useEffect } from "react";
import { useToast } from "@chakra-ui/react";

const SimulationEngineContext = createContext();

// =====================
// PART 1: MIGRATED TO BACKEND (or in progress)
// =====================

// Fetch session from backend on mount
export function SimulationEngineProvider({ children }) {
  // All hooks must be declared before any logic that uses them
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const toast = useToast();

  // Fetch participants for the session
  async function fetchParticipants() {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/session/${sessionId}/participants`);
      if (!res.ok) throw new Error("Failed to fetch participants");
      const data = await res.json();
      setParticipants(data);
    } catch (err) {
      setParticipants([]);
    }
  }

  // todo: temporary generation, fix
  function generateParticipantId() {
    return "p_" + Math.random().toString(36).slice(2, 10);
  }

  // Join session as a participant
  async function joinSession({ name }) {
    if (!sessionId) {
      toast({
        title: "No session ID",
        description: "Session must be initialized before joining.",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "bottom-left",
      });
      return;
    }
    const participantId = generateParticipantId();
    setParticipantId(participantId);
    try {
      const res = await fetch(`/api/session/${sessionId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, participantName: name }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to join session");
      }
      toast({
        title: "Joined session",
        description: `You joined as ${name}`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom-left",
      });
    } catch (err) {
      toast({
        title: "Join failed",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom-left",
      });
    }
  }

  // Automatically join session after sessionId is set
  useEffect(() => {
    if (sessionId && !participantId) {
      joinSession({ name: participantId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Refetch participants after joining
  useEffect(() => {
    if (sessionId) {
      fetchParticipants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, participantId]);

  useEffect(() => {
    // Fetch session from backend, but always show loading for at least 1 second
    async function fetchSession() {
      setIsLoading(true);
      const start = Date.now();
      let sessionData = null;
      try {
        const res = await fetch("/api/session/init");
        if (!res.ok) throw new Error("Failed to fetch session");
        const data = await res.json();
        setSessionId(data.session_id);
        sessionData = data;
      } catch (err) {
        console.error("Error fetching session:", err);
        toast({
          title: "Error",
          description: err.message || "Failed to fetch session",
          status: "error",
          duration: 4000,
          isClosable: true,
          position: "bottom-left",
        });
      } finally {
        const elapsed = Date.now() - start;
        const minDelay = 1000;
        const finish = () => {
          setIsLoading(false);
          if (sessionData) {
            toast({
              title: "Session initialized",
              description: `Session ID: ${sessionData.session_id}`,
              status: "success",
              duration: 3000,
              isClosable: true,
              position: "bottom-left",
            });
          }
        };
        if (elapsed < minDelay) {
          setTimeout(finish, minDelay - elapsed);
        } else {
          finish();
        }
      }
    }
    fetchSession();
  }, [toast]);

  // Provide loading state to children, let App decide what to render
  if (isLoading) {
    return (
      <SimulationEngineContext.Provider
        value={{ isLoading: true, gameState: null, ready: false }}
      >
        {children}
      </SimulationEngineContext.Provider>
    );
  }

  // Expose joinSession and participants in context for use in the app
  return (
    <SimulationEngineContext.Provider
      value={{
        isLoading: false,
        sessionId,
        joinSession,
        participants,
        fetchParticipants,
      }}
    >
      <SimulationEngineCore
        sessionId={sessionId}
        participants={participants}
        fetchParticipants={fetchParticipants}
      >
        {children}
      </SimulationEngineCore>
    </SimulationEngineContext.Provider>
  );
}

function SimulationEngineCore({
  children,
  sessionId,
  participants,
  fetchParticipants,
}) {
  // Simulated initial game state (for not-yet-migrated logic)
  const defaultGameState = {
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
    turn: "X",
    player: "X",
    status: "Player X's turn",
    isPlayerTurn: true,
    gameActive: true,
    validMoves: ["0,0", "0,1", "0,2", "1,0", "1,1", "1,2", "2,0", "2,1", "2,2"],
    hostExists: false,
  };

  const [gameState, setGameState] = useState(defaultGameState);

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
      gameActive: validMoves.length > 0,
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
    simulateGameStateUpdate,
    simulateSetCell,
    simulateSetField,
    simulateJoin,
    sessionId,
    participants,
    fetchParticipants,
  };

  return (
    <SimulationEngineContext.Provider value={value}>
      {children}
    </SimulationEngineContext.Provider>
  );
}

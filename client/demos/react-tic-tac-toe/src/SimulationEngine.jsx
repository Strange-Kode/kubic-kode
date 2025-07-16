import { createContext, useContext, useState, useEffect } from "react";
import { useToast } from "@chakra-ui/react";

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

const SimulationEngineContext = createContext();

// =====================
// PART 1: MIGRATED TO BACKEND (or in progress)
// =====================

export function SimulationEngineProvider({ children }) {
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [sessionFullModal, setSessionFullModal] = useState({
    isOpen: false,
    message: "",
  });
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

    try {
      const res = await fetch(`/api/session/${sessionId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantName: name }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to join session");
      }

      // Set the participant ID returned by the backend
      setParticipantId(data.participant_id);
      setShowNameModal(false); // Close the modal on successful join
      toast({
        title: "Joined session",
        description: `You joined as ${name}`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom-left",
      });
    } catch (err) {
      const errorMessage = err.message;

      // Handle specific error cases
      if (
        errorMessage.includes("Session is full") ||
        errorMessage.includes("full")
      ) {
        setSessionFullModal({
          isOpen: true,
          message: "This game session is full.",
        });
        setShowNameModal(false);
      } else if (
        errorMessage.includes("already started") ||
        errorMessage.includes("Game has already started")
      ) {
        setSessionFullModal({
          isOpen: true,
          message: "This game has already started.",
        });
        setShowNameModal(false);
      } else {
        // Generic error handling
        toast({
          title: "Join failed",
          description: errorMessage,
          status: "error",
          duration: 4000,
          isClosable: true,
          position: "bottom-left",
        });
      }
    }
  }

  // Start game when both participants have joined
  async function startGame() {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/game/start/${sessionId}`);
      if (!res.ok) throw new Error("Failed to start game");
      const data = await res.json();
      toast({
        title: "Game started!",
        description: `Current player: ${data.current_player_id}`,
        status: "success",
        duration: 3000,
        isClosable: true,
        position: "bottom-left",
      });
      return data;
    } catch (err) {
      toast({
        title: "Failed to start game",
        description: err.message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "bottom-left",
      });
    }
  }

  // Check if session is available for joining
  const checkSessionAvailability = async () => {
    if (!sessionId) return false;

    try {
      // First check how many participants are already in the session
      const participantsRes = await fetch(
        `/api/session/${sessionId}/participants`
      );
      if (!participantsRes.ok) return false;

      const participantsData = await participantsRes.json();

      // If session already has 2+ participants, it's full
      if (participantsData.length >= 2) {
        setSessionFullModal({
          isOpen: true,
          message:
            "This game session is full. Please try creating a new game or wait for a spot to open up.",
        });
        return false;
      }

      return true;
    } catch (err) {
      console.error("Error checking session availability:", err);
      return false;
    }
  };

  // Show name modal after sessionId is set, but only if session is available
  useEffect(() => {
    const checkAndShowModal = async () => {
      if (sessionId && !participantId) {
        const isAvailable = await checkSessionAvailability();
        if (isAvailable) {
          setShowNameModal(true);
        }
      }
    };

    checkAndShowModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, participantId]);

  // Refetch participants after joining
  useEffect(() => {
    if (sessionId) {
      fetchParticipants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, participantId]);

  // Monitor participants and start game when we have 2 players
  useEffect(() => {
    if (participants.length === 2) {
      startGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants.length]);

  useEffect(() => {
    // Fetch session from backend, but always show loading component for at least 1 second
    async function fetchSession() {
      setIsLoading(true);
      const start = Date.now();
      let sessionData = null;
      try {
        // Use tic-tac-toe-classic as the default gameId for initialization
        const res = await fetch("/api/session/init/tic-tac-toe-classic");
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

  // Close session full modal
  const closeSessionFullModal = () => {
    setSessionFullModal({ isOpen: false, message: "" });
  };

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
        participantId,
        joinSession,
        participants,
        fetchParticipants,
        showNameModal,
        setShowNameModal,
        sessionFullModal,
        closeSessionFullModal,
      }}
    >
      <SimulationEngineCore
        sessionId={sessionId}
        participants={participants}
        fetchParticipants={fetchParticipants}
        joinSession={joinSession}
        showNameModal={showNameModal}
        setShowNameModal={setShowNameModal}
        participantId={participantId}
        sessionFullModal={sessionFullModal}
        closeSessionFullModal={closeSessionFullModal}
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
  joinSession,
  showNameModal,
  setShowNameModal,
  participantId,
  sessionFullModal,
  closeSessionFullModal,
}) {
  const toast = useToast();
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

  // =====================
  // REAL BACKEND INTEGRATION (replacing simulation)
  // =====================

  // Fetch current game state from backend
  async function fetchGameState() {
    if (!sessionId) return;

    try {
      // Get current player
      const currentPlayerRes = await fetch(
        `/api/game/get-current-player/${sessionId}`
      );
      const isActiveRes = await fetch(`/api/game/is-active/${sessionId}`);

      if (currentPlayerRes.ok && isActiveRes.ok) {
        const currentPlayerData = await currentPlayerRes.json();
        const isActiveData = await isActiveRes.json();

        // For now, we'll need to construct the board state from what we have
        // Since we don't have a direct board endpoint, we'll start with empty board
        // and rely on moves to update it properly
        const updatedGameState = {
          ...gameState,
          currentPlayer: currentPlayerData.current_player_id,
          gameActive: isActiveData.is_active,
          // TODO: We'll need to get the actual board state somehow
          // For now keep the current matrix until we make moves
        };

        setGameState(updatedGameState);
      }
    } catch (err) {
      console.error("Failed to fetch game state:", err);
    }
  }

  // Send move to backend and update state
  async function playMove(row, col) {
    if (!sessionId) return;

    try {
      const res = await fetch(`/api/tic-tac-toe/play-turn/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: participantId, // TODO: map participant to player
          xPos: col, // backend expects x/y coordinates
          yPos: row,
        }),
      });

      if (!res.ok) throw new Error("Failed to play move");

      const moveResult = await res.json();

      // Update local game state based on move result
      const key = `${row},${col}`;
      const currentTurn = gameState.turn || "X";
      const nextTurn = currentTurn === "X" ? "O" : "X";

      const updatedMatrix = { ...gameState.matrix, [key]: currentTurn };

      // Calculate valid moves
      const validMoves = Object.keys(updatedMatrix).filter(
        (cellKey) => updatedMatrix[cellKey] === ""
      );

      let status = `Player ${nextTurn}'s turn`;
      let gameActive = true;

      if (moveResult.player_has_won) {
        status = `Player ${currentTurn} wins!`;
        gameActive = false;
      } else if (validMoves.length === 0) {
        status = "It's a draw!";
        gameActive = false;
      }

      setGameState({
        ...gameState,
        matrix: updatedMatrix,
        turn: nextTurn,
        status,
        gameActive,
        validMoves,
        isPlayerTurn: nextTurn === gameState.player,
      });

      return moveResult;
    } catch (err) {
      console.error("Failed to play move:", err);
      toast({
        title: "Move failed",
        description: err.message,
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "bottom-left",
      });
    }
  }

  // Real backend cell click handler
  function onCellClick(row, col) {
    playMove(row, col);
  }

  // Fetch game state when session starts or participants change
  useEffect(() => {
    if (sessionId && participants.length > 0) {
      fetchGameState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, participants.length]);

  // =====================
  // END REAL BACKEND INTEGRATION
  // =====================

  // Expose gameState and the action handlers
  const value = {
    isLoading: false,
    gameState,
    onCellClick,
    fetchGameState,
    playMove,
    sessionId,
    participants,
    fetchParticipants,
    joinSession,
    showNameModal,
    setShowNameModal,
    participantId,
    sessionFullModal,
    closeSessionFullModal,
  };

  return (
    <SimulationEngineContext.Provider value={value}>
      {children}
    </SimulationEngineContext.Provider>
  );
}

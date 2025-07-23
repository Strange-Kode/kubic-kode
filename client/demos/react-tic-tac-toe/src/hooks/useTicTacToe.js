import { useState, useEffect, useCallback } from "react";
import { useSession } from "./useSession.js";
import { useGame } from "./useGame.js";
import { useGameWebSocket } from "./useGameWebSocket.js";
import { useRestartVoting } from "./useRestartGame.js";

/**
 * Main orchestration hook for Tic-Tac-Toe game
 * Combines useSession + useGame hooks and manages the complete flow:
 * session → join → auto-start game → play
 */
export function useTicTacToe() {
  // UI state
  const [showNameModal, setShowNameModal] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerName, setPlayerName] = useState(null);

  // Hook dependencies
  const session = useSession();
  const game = useGame(session.sessionId);

  // Refresh all data function (needs to be defined before restart voting hook)
  const refreshData = useCallback(async () => {
    // console.log("[useTicTacToe] Refreshing all data");
    setError(null);

    try {
      await Promise.all([session.fetchParticipants(), game.refreshGameData()]);
    } catch (err) {
      console.error("[useTicTacToe] Error refreshing data:", err);
      setError(err.message);
    }
  }, [session, game]);

  // Restart voting functionality
  const restartVoting = useRestartVoting(session, game, refreshData);

  // Check if we need to show name modal
  const needsName =
    session.sessionId && !session.participantId && !session.isSessionLoading;

  // Check if game should auto-start
  const shouldAutoStart =
    session.participants.length === 2 && !game.gameStarted;

  // Overall loading state
  const overallLoading =
    session.isSessionLoading || game.isGameLoading || isLoading;

  // Combined error state
  const combinedError = error || session.sessionError || game.gameError;

  // Show name modal when session is ready but user hasn't joined
  useEffect(() => {
    if (needsName) {
      // console.log("[useTicTacToe] Session ready, showing name modal");
      setShowNameModal(true);
      setIsLoading(false);
    }
  }, [needsName]);

  // Auto-start game when 2 participants are present
  useEffect(() => {
    if (shouldAutoStart) {
      // console.log("[useTicTacToe] AUTO-START triggered: participants=2");
      handleAutoStartGame();
    }
  }, [shouldAutoStart]);

  // Handle name submission from modal
  const handleNameSubmit = useCallback(
    async (name) => {
      // console.log(`[useTicTacToe] Name submitted: ${name}`);
      setIsLoading(true);
      setError(null);

      try {
        const result = await session.joinSession(name);

        if (result.success) {
          setPlayerName(name);
          setShowNameModal(false);
          // console.log(`[useTicTacToe] Successfully joined as: ${name}`);
          await refreshData(); // Ensure participants list is up to date for the joining user
        } else {
          setError(result.error || "Failed to join session");
        }
      } catch (err) {
        console.error("[useTicTacToe] Error joining session:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    [session, refreshData]
  );

  // Handle auto-start game logic
  const handleAutoStartGame = useCallback(async () => {
    // console.log("[useTicTacToe] Starting game automatically");
    setIsLoading(true);
    setError(null);

    try {
      const result = await game.startGame();

      if (result.success) {
        // console.log("[useTicTacToe] Game started successfully");
      } else {
        setError(result.error || "Failed to start game");
      }
    } catch (err) {
      // console.error("[useTicTacToe] Error starting game:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [game]);

  // Handle move with error handling
  const handleMove = useCallback(
    async (x, y) => {
      // console.log(`[useTicTacToe] Making move at (${x}, ${y})`);
      setError(null);

      try {
        const result = await game.makeMove(x, y);

        if (!result.success) {
          setError(result.error || "Move failed");
          return false;
        }

        // console.log(`[useTicTacToe] Move successful at (${x}, ${y})`);
        return true;
      } catch (err) {
        console.error("[useTicTacToe] Error making move:", err);
        setError(err.message);
        return false;
      }
    },
    [game]
  );

  // Handle win modal actions
  const handleWinModalClose = useCallback(() => {
    setShowWinModal(false);
    setWinner(null);
  }, []);

  // Handle WebSocket events including win conditions
  const handleWebSocketEvent = useCallback(
    (data) => {
      console.log("[useTicTacToe] WebSocket event received:", data);

      if (
        data.type === "turnPlayed" &&
        data.payload?.roundStatus?.player_has_won
      ) {
        // Find the winner participant
        const winnerParticipant = session.participants.find(
          (p) => p.id === data.payload.roundStatus.player_id
        );

        if (winnerParticipant) {
          console.log("[useTicTacToe] Game won by:", winnerParticipant.name);
          setWinner(winnerParticipant);
          setShowWinModal(true);
        }
      }

      if (
        data.type === "turnPlayed" ||
        data.type === "sessionParticipantJoined" ||
        data.type === "sessionParticipantLeft"
      ) {
        refreshData();
      }

      if (data.type === "winCount") {
        console.log("current winCount: ", data.payload.winCount);
      }

      // Handle restart voting events
      if (
        data.type === "restartVoteStarted" ||
        data.type === "restartVoteUpdate" ||
        data.type === "restartVoteResult"
      ) {
        restartVoting.handleRestartVoteEvent(
          data,
          setError,
          setShowWinModal,
          setWinner
        );
      }
    },
    [session.participants, refreshData, restartVoting]
  );

  // Only connect WebSocket after game has started (must be after refreshData is defined)
  // Listen for session events (join/leave) and game events
  useGameWebSocket(
    session.sessionId ? session.sessionId : null,
    handleWebSocketEvent
  );

  // Determine current game phase
  const getGamePhase = useCallback(() => {
    if (overallLoading) return "loading";
    if (combinedError) return "error";
    if (showNameModal) return "name-selection";
    if (session.participants.length < 2) return "waiting-for-players";
    if (!game.gameStarted) return "starting-game";
    if (game.gameActive) return "playing";
    return "game-ended";
  }, [
    overallLoading,
    combinedError,
    showNameModal,
    session.participants.length,
    game.gameStarted,
    game.gameActive,
  ]);

  // Get current player info, but only if game has started
  const getCurrentPlayerInfo = useCallback(() => {
    if (
      !game.gameStarted ||
      !game.currentPlayerId ||
      !session.participants.length
    ) {
      return null;
    }

    const currentParticipant = session.participants.find(
      (p) => p.id === game.currentPlayerId
    );

    return currentParticipant || null;
  }, [game.gameStarted, game.currentPlayerId, session.participants]);

  // Check if it's current user's turn
  const isMyTurn = useCallback(() => {
    return game.currentPlayerId === session.participantId;
  }, [game.currentPlayerId, session.participantId]);

  // Get opponent info
  const getOpponentInfo = useCallback(() => {
    if (!session.participantId || session.participants.length < 2) {
      return null;
    }

    return (
      session.participants.find((p) => p.id !== session.participantId) || null
    );
  }, [session.participantId, session.participants]);

  // Log flow transitions for debugging
  useEffect(() => {
    const phase = getGamePhase();
    // console.log(`[useTicTacToe] Flow transition → ${phase}`);
  }, [getGamePhase]);

  return {
    // Game phase and state
    gamePhase: getGamePhase(),
    isLoading: overallLoading,
    error: combinedError,

    // UI state
    showNameModal,
    showWinModal,
    winner,

    // Player info
    playerName,
    participants: session.participants,
    currentPlayer: getCurrentPlayerInfo(),
    opponent: getOpponentInfo(),
    isMyTurn: isMyTurn(),

    // Game state
    gameStarted: game.gameStarted,
    gameActive: game.gameActive,
    tileMap: game.tileMap,
    lastMoveResult: game.lastMoveResult,

    // Session info
    sessionId: session.sessionId,
    participantId: session.participantId,
    isHost: session.isHost,

    // Actions
    handleNameSubmit,
    handleMove,
    refreshData,
    handleWinModalClose,

    // Restart functionality
    ...restartVoting,

    // Pass-through game helpers
    getTile: game.getTile,
    getGridDimensions: game.getGridDimensions,

    // Pass-through session actions (for advanced use)
    joinSession: session.joinSession,
    startGame: game.startGame,
    checkSessionAvailability: session.checkSessionAvailability,
  };
}

import { useState, useEffect, useCallback } from "react";
import { useSession } from "./useSession.js";
import { useGame } from "./useGame.js";

/**
 * Main orchestration hook for Tic-Tac-Toe game
 * Combines useSession + useGame hooks and manages the complete flow:
 * session → name modal → join → auto-start game → play
 */
export function useTicTacToe() {
  // UI state
  const [showNameModal, setShowNameModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerName, setPlayerName] = useState(null);

  // Hook dependencies
  const session = useSession();
  const game = useGame(session.sessionId);

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
      console.log("[useTicTacToe] Session ready, showing name modal");
      setShowNameModal(true);
      setIsLoading(false);
    }
  }, [needsName]);

  // Auto-start game when 2 participants are present
  useEffect(() => {
    if (shouldAutoStart) {
      console.log("[useTicTacToe] AUTO-START triggered: participants=2");
      handleAutoStartGame();
    }
  }, [shouldAutoStart]);

  // Handle name submission from modal
  const handleNameSubmit = useCallback(
    async (name) => {
      console.log(`[useTicTacToe] Name submitted: ${name}`);
      setIsLoading(true);
      setError(null);

      try {
        const result = await session.joinSession(name);

        if (result.success) {
          setPlayerName(name);
          setShowNameModal(false);
          console.log(`[useTicTacToe] Successfully joined as: ${name}`);
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
    [session]
  );

  // Handle auto-start game logic
  const handleAutoStartGame = useCallback(async () => {
    console.log("[useTicTacToe] Starting game automatically");
    setIsLoading(true);
    setError(null);

    try {
      const result = await game.startGame();

      if (result.success) {
        console.log("[useTicTacToe] Game started successfully");
      } else {
        setError(result.error || "Failed to start game");
      }
    } catch (err) {
      console.error("[useTicTacToe] Error starting game:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [game]);

  // Handle move with error handling
  const handleMove = useCallback(
    async (x, y) => {
      console.log(`[useTicTacToe] Making move at (${x}, ${y})`);
      setError(null);

      try {
        const result = await game.makeMove(x, y);

        if (!result.success) {
          setError(result.error || "Move failed");
          return false;
        }

        console.log(`[useTicTacToe] Move successful at (${x}, ${y})`);
        return true;
      } catch (err) {
        console.error("[useTicTacToe] Error making move:", err);
        setError(err.message);
        return false;
      }
    },
    [game]
  );

  // Refresh all data
  const refreshData = useCallback(async () => {
    console.log("[useTicTacToe] Refreshing all data");
    setError(null);

    try {
      await Promise.all([session.fetchParticipants(), game.refreshGameData()]);
    } catch (err) {
      console.error("[useTicTacToe] Error refreshing data:", err);
      setError(err.message);
    }
  }, [session, game]);

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

  // Get current player info
  const getCurrentPlayerInfo = useCallback(() => {
    if (!game.currentPlayerId || !session.participants.length) {
      return null;
    }

    const currentParticipant = session.participants.find(
      (p) => p.id === game.currentPlayerId
    );

    return currentParticipant || null;
  }, [game.currentPlayerId, session.participants]);

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
    console.log(`[useTicTacToe] Flow transition → ${phase}`);
  }, [getGamePhase]);

  return {
    // Game phase and state
    gamePhase: getGamePhase(),
    isLoading: overallLoading,
    error: combinedError,

    // UI state
    showNameModal,

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

    // Pass-through game helpers
    getTile: game.getTile,
    getGridDimensions: game.getGridDimensions,

    // Pass-through session actions (for advanced use)
    joinSession: session.joinSession,
    startGame: game.startGame,
    checkSessionAvailability: session.checkSessionAvailability,
  };
}

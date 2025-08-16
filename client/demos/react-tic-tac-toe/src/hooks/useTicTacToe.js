import { useState, useEffect, useCallback } from "react";
import { useSession } from "./useSession.js";
import { useGame } from "./useGame.js";
import { useGameWebSocket } from "./useGameWebSocket.js";
import { useRestartVoting } from "./useRestartGame.js";
import { usePlayerWins } from "./usePlayerWins.js";

/**
 * Main orchestration hook for Tic-Tac-Toe game
 * Combines useSession + useGame hooks and manages the complete flow:
 * session → join → auto-start game → play
 */
export function useTicTacToe() {
  // UI state
  const [showNameModal, setShowNameModal] = useState(false);
  const [showSpectatorModal, setShowSpectatorModal] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [inactivityTimer, setInactivityTimer] = useState(null);
  const [lastTimerUpdate, setLastTimerUpdate] = useState(null);
  const [gameDisabledByInactivity, setGameDisabledByInactivity] =
    useState(false);

  // Hook dependencies
  const session = useSession();
  const game = useGame(session.sessionId, session.participantId, session.getGameToken);
  const playerWins = usePlayerWins(session.sessionId);

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

  // Live timer calculation with interpolation - always sync to backend authority
  const getLiveTimer = useCallback(() => {
    if (inactivityTimer === null || lastTimerUpdate === null) return null;

    // Calculate elapsed time since last backend update
    const elapsedMs = Date.now() - lastTimerUpdate;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    // Start from backend's authoritative time and subtract local elapsed time
    const liveTimer = Math.max(0, inactivityTimer - elapsedSeconds);

    return liveTimer;
  }, [inactivityTimer, lastTimerUpdate]);

  // Restart voting functionality
  const restartVoting = useRestartVoting(session, game, refreshData);

  // Check if we need to show name modal or spectator modal
  const needsName =
    session.sessionId && !session.participantId && !session.isSessionLoading;

  // Check if game should auto-start (only count playable participants)
  const playableParticipants = session.participants.filter(
    (p) => p.type === "user" || p.type === "computer"
  );

  // Check if session is full and should show spectator modal instead
  const sessionIsFull = playableParticipants.length >= session.maxPlayers;
  const shouldShowSpectator = needsName && sessionIsFull;

  const shouldAutoStart =
    playableParticipants.length === session.maxPlayers &&
    !game.gameStarted;

  // Overall loading state
  const overallLoading =
    session.isSessionLoading || game.isGameLoading || isLoading;

  // Combined error state
  const combinedError = error || session.sessionError || game.gameError;

  // Show name modal or spectator modal when session is ready but user hasn't joined
  useEffect(() => {
    if (shouldShowSpectator) {
      // Session is full, show spectator modal
      setShowSpectatorModal(true);
      setShowNameModal(false);
      setIsLoading(false);
    } else if (needsName) {
      // Session has space, show name modal
      setShowNameModal(true);
      setShowSpectatorModal(false);
      setIsLoading(false);
    }
  }, [needsName, shouldShowSpectator]);

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

  // Handle joining as spectator
  const handleJoinAsSpectator = useCallback(
    async (name) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await session.joinAsSpectator(name);

        if (result.success) {
          setPlayerName(name);
          setShowSpectatorModal(false);
          await refreshData();
        } else {
          setError(result.error || "Failed to join as spectator");
        }
      } catch (err) {
        console.error("[useTicTacToe] Error joining as spectator:", err);
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
      // console.log("[useTicTacToe] WebSocket event received:", data);

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

          // Refresh win counts after someone wins (with small delay to allow backend processing)
          setTimeout(() => {
            playerWins.fetchPlayerWins();
          }, 100);
        }
      }

      // Handle game tied condition
      if (data.type === "gameTied") {
        setWinner({ id: null, name: "Tie", isTie: true });
        setShowWinModal(true);

        setTimeout(() => {
          playerWins.fetchPlayerWins();
        }, 100);
      }

      if (
        data.type === "turnPlayed" ||
        data.type === "sessionParticipantJoined" ||
        data.type === "sessionParticipantLeft"
      ) {
        refreshData();
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

      // Refresh win counts when game is restarted and re-enable UI
      if (data.type === "gameStarted") {
        setGameDisabledByInactivity(false);
        setTimeout(() => {
          playerWins.fetchPlayerWins();
        }, 100);
      }

      // Handle inactivity timer updates - reset baseline on each backend update
      if (data.type === "timeLeft") {
        const backendTimeLeft = data.payload?.secondsLeft;
        if (typeof backendTimeLeft === "number") {
          // Always use backend time as authoritative source
          setInactivityTimer(backendTimeLeft);
          setLastTimerUpdate(Date.now());
          console.log(
            `[Timer Sync] Backend reports ${backendTimeLeft}s left, frontend baseline reset`
          );
        }
      }

      // Handle player inactivity and resulting win
      if (data.type === "playerInactive") {
        setInactivityTimer(null);
        setLastTimerUpdate(null);
        setGameDisabledByInactivity(true);

        // Handle the win condition from inactivity
        const inactivePlayers = data.payload?.inactivePlayers;
        if (inactivePlayers && inactivePlayers.length > 0) {
          // Find the first inactive player's status
          const firstInactiveResult = inactivePlayers[0];
          const inactivityStatus = firstInactiveResult.inactivityStatus;
          
          if (inactivityStatus?.winnerPlayerId) {
            // Find the winner participant
            const winnerParticipant = session.participants.find(
              (p) => p.id === inactivityStatus.winnerPlayerId
            );

            if (winnerParticipant) {
              console.log(
                "[useTicTacToe] Game won by inactivity:",
                winnerParticipant.name
              );
              setWinner(winnerParticipant);
              setShowWinModal(true);

              // Refresh data and win counts after inactivity win
              refreshData();
              setTimeout(() => {
                playerWins.fetchPlayerWins();
              }, 100);
            }
          }
        }
      }
    },
    [session.participants, refreshData, restartVoting, playerWins]
  );

  // Only connect WebSocket after game has started (must be after refreshData is defined)
  // Listen for session events (join/leave) and game events
  useGameWebSocket(
    session.sessionId ? session.sessionId : null,
    session.participantId ? session.participantId : null,
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
    showSpectatorModal,
    showWinModal,
    winner,

    // Player info
    playerName,
    participants: session.participants,
    maxPlayers: session.maxPlayers,
    currentPlayer: getCurrentPlayerInfo(),
    opponent: getOpponentInfo(),
    isMyTurn: isMyTurn(),

    // Game state
    gameStarted: game.gameStarted,
    gameActive: game.gameActive,
    gameDisabledByInactivity,
    tileMap: game.tileMap,
    lastMoveResult: game.lastMoveResult,
    inactivityTimer,
    getLiveTimer,

    // Session info
    sessionId: session.sessionId,
    participantId: session.participantId,
    isHost: session.isHost,

    // Player wins data
    playerWinCounts: playerWins.playerWinCounts,
    getWinCountForPlayer: playerWins.getWinCountForPlayer,
    getTotalGames: playerWins.getTotalGames,

    // Actions
    handleNameSubmit,
    handleJoinAsSpectator,
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
    joinAsSpectator: session.joinAsSpectator,
    addAIParticipant: session.addAIParticipant,
    startGame: game.startGame,
    checkSessionAvailability: session.checkSessionAvailability,
  };
}

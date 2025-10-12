import { useState, useEffect, useCallback, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { useSession } from "./useSession.js";
import { useGame } from "./useGame.js";
import { useRestartVoting } from "./useRestartGame.js";
import { usePlayerWins } from "./usePlayerWins.js";
import "../../../../kubic-kode-helper.js";

/**
 * Main orchestration hook for Tic-Tac-Toe game
 * NOW SIMPLIFIED: Just UI state management + subscribing to KubicKodeHelper events
 * All game flow logic is handled by KubicKodeHelper.flow
 */
export function useTicTacToe() {
  const [showNameModal, setShowNameModal] = useState(false);
  const [showSpectatorModal, setShowSpectatorModal] = useState(false);
  const [showWinModal, setShowWinModal] = useState(false);
  const [winner, setWinner] = useState(null);
  const [showSessionEndedModal, setShowSessionEndedModal] = useState(false);
  const [sessionEndedReason, setSessionEndedReason] = useState(null);
  const [gameDisabledByInactivity, setGameDisabledByInactivity] =
    useState(false);
  const [inactivityTimer, setInactivityTimer] = useState(null);

  const flowEventHandlersSetup = useRef(false);

  const toast = useToast();

  const KubicKode = window.KubicKode;

  const session = useSession();
  const game = useGame(
    session.sessionId,
    session.participantId,
    session.getGameToken
  );
  const playerWins = usePlayerWins(session.sessionId);
  const restartVoting = useRestartVoting(session, game, () => {
    // Refresh callback for restart voting
    session.fetchParticipants();
  });

  const showConnectionToast = useCallback(
    (title, description, status = "info") => {
      toast({
        title,
        description,
        status,
        duration: 4000,
        isClosable: true,
        position: "bottom-left",
      });
    },
    [toast]
  );

  const handleSessionTermination = useCallback((payload) => {
    setSessionEndedReason(payload);
    setShowSessionEndedModal(true);
  }, []);

  // Close session ended modal and return to welcome state
  const handleSessionEndedModalClose = useCallback(() => {
    setShowSessionEndedModal(false);
    setSessionEndedReason(null);
    setShowNameModal(false);
    setShowSpectatorModal(false);
    setShowWinModal(false);
    setWinner(null);
  }, []);

  // Setup event listeners for high-level KubicKodeHelper.flow events

  useEffect(() => {
    if (!KubicKode) {
      console.error("[useTicTacToe] KubicKode not available");
      return;
    }

    // Setup flow event handlers only once
    if (!flowEventHandlersSetup.current) {
      KubicKode.flow.setupEventHandlers();
      flowEventHandlersSetup.current = true;
    }

    // Listen to high-level events emitted by KubicKode.flow
    const handleGameEnded = (data) => {
      setWinner(data.winner);
      setShowWinModal(true);
    };

    const handleSessionTerminated = (data) => {
      handleSessionTermination(data);
    };

    const handleParticipantConnectionChanged = (data) => {
      const { type, participantName, participantType, reason } = data;

      if (type === "disconnected") {
        const isSpectator = participantType === "spectator";
        showConnectionToast(
          isSpectator ? "Spectator disconnected" : "Player disconnected",
          `${participantName} has disconnected`,
          "warning"
        );
      } else if (type === "removed") {
        showConnectionToast(
          "Player removed",
          `${participantName} was removed (${reason})`,
          "error"
        );
      } else if (type === "reconnected") {
        showConnectionToast(
          "Player reconnected",
          `${participantName} has reconnected`,
          "success"
        );
      }
    };

    const handleGameDisabled = () => {
      setGameDisabledByInactivity(true);
    };

    const handleGameReEnabled = () => {
      setGameDisabledByInactivity(false);
    };

    const handleInactivityTimerUpdate = (data) => {
      setInactivityTimer(data.secondsLeft);
    };

    // Handle restart voting events from KubicKode.flow
    const handleRestartVotingStarted = (data) => {
      restartVoting.handleRestartVoteEvent(
        { type: "restartVoteStarted", payload: data },
        (error) => {
          toast({
            title: "Error",
            description: error,
            status: "error",
            duration: 3000,
          });
        },
        setShowWinModal,
        setWinner
      );
    };

    const handleRestartVotingUpdated = (data) => {
      restartVoting.handleRestartVoteEvent(
        { type: "restartVoteUpdate", payload: data },
        (error) => {
          toast({
            title: "Error",
            description: error,
            status: "error",
            duration: 3000,
          });
        },
        setShowWinModal,
        setWinner
      );
    };

    const handleRestartVotingCompleted = (data) => {
      restartVoting.handleRestartVoteEvent(
        { type: "restartVoteResult", payload: data },
        (error) => {
          toast({
            title: "Error",
            description: error,
            status: "error",
            duration: 3000,
          });
        },
        setShowWinModal,
        setWinner
      );
    };

    // Subscribe to events
    KubicKode.events.on("gameEnded", handleGameEnded);
    KubicKode.events.on("sessionTerminated", handleSessionTerminated);
    KubicKode.events.on(
      "participantConnectionChanged",
      handleParticipantConnectionChanged
    );
    KubicKode.events.on("gameDisabledByInactivity", handleGameDisabled);
    KubicKode.events.on("gameReEnabled", handleGameReEnabled);
    KubicKode.events.on("inactivityTimerUpdate", handleInactivityTimerUpdate);
    KubicKode.events.on("restartVotingStarted", handleRestartVotingStarted);
    KubicKode.events.on("restartVotingUpdated", handleRestartVotingUpdated);
    KubicKode.events.on("restartVotingCompleted", handleRestartVotingCompleted);

    return () => {
      // Cleanup event listeners
      KubicKode.events.off("gameEnded", handleGameEnded);
      KubicKode.events.off("sessionTerminated", handleSessionTerminated);
      KubicKode.events.off(
        "participantConnectionChanged",
        handleParticipantConnectionChanged
      );
      KubicKode.events.off("gameDisabledByInactivity", handleGameDisabled);
      KubicKode.events.off("gameReEnabled", handleGameReEnabled);
      KubicKode.events.off(
        "inactivityTimerUpdate",
        handleInactivityTimerUpdate
      );
      KubicKode.events.off("restartVotingStarted", handleRestartVotingStarted);
      KubicKode.events.off("restartVotingUpdated", handleRestartVotingUpdated);
      KubicKode.events.off(
        "restartVotingCompleted",
        handleRestartVotingCompleted
      );
    };
  }, [
    KubicKode,
    handleSessionTermination,
    showConnectionToast,
    restartVoting,
    toast,
  ]);

  // Check if we need to show name modal or spectator modal
  const needsName =
    session.sessionId && !session.participantId && !session.isSessionLoading;

  // Check if session is full and should show spectator modal instead
  const playableParticipants = session.participants.filter(
    (p) => p.type === "user" || p.type === "computer"
  );
  const sessionIsFull = playableParticipants.length >= session.maxPlayers;
  const shouldShowSpectator = needsName && sessionIsFull;

  // Show name modal or spectator modal when session is ready but user hasn't joined
  useEffect(() => {
    if (shouldShowSpectator) {
      setShowSpectatorModal(true);
      setShowNameModal(false);
    } else if (needsName) {
      setShowNameModal(true);
      setShowSpectatorModal(false);
    }
  }, [needsName, shouldShowSpectator]);

  const handleNameSubmit = useCallback(
    async (name) => {
      try {
        const result = await session.joinSession(name);

        if (result.success) {
          setShowNameModal(false);
          await session.fetchParticipants();
        } else {
          toast({
            title: "Failed to join",
            description: result.error || "Failed to join session",
            status: "error",
            duration: 3000,
          });
        }
      } catch (err) {
        console.error("[useTicTacToe] Error joining session:", err);
        toast({
          title: "Error",
          description: err.message,
          status: "error",
          duration: 3000,
        });
      }
    },
    [session, toast]
  );

  const handleJoinAsSpectator = useCallback(
    async (name) => {
      try {
        const result = await session.joinAsSpectator(name);

        if (result.success) {
          setShowSpectatorModal(false);
          await session.fetchParticipants();
        } else {
          toast({
            title: "Failed to join as spectator",
            description: result.error || "Failed to join as spectator",
            status: "error",
            duration: 3000,
          });
        }
      } catch (err) {
        console.error("[useTicTacToe] Error joining as spectator:", err);
        toast({
          title: "Error",
          description: err.message,
          status: "error",
          duration: 3000,
        });
      }
    },
    [session, toast]
  );

  const handleMove = useCallback(
    async (x, y) => {
      try {
        const result = await game.makeMove(x, y);
        return result.success;
      } catch (err) {
        console.error("[useTicTacToe] Error making move:", err);
        toast({
          title: "Move failed",
          description: err.message,
          status: "error",
          duration: 3000,
        });
        return false;
      }
    },
    [game, toast]
  );

  const handleWinModalClose = useCallback(() => {
    setShowWinModal(false);
    setWinner(null);
  }, []);

  const refreshData = useCallback(async () => {
    try {
      await session.fetchParticipants();
      if (session.sessionId && session.participantId) {
        await game.refreshGameData();
      }
    } catch (err) {
      console.error("[useTicTacToe] Error refreshing data:", err);
    }
  }, [session, game]);

  const gamePhase = KubicKode?.flow.getCurrentPhase() || "initializing";

  const getCurrentPlayerInfo = useCallback(() => {
    if (
      !game.gameStarted ||
      !game.currentPlayerId ||
      !session.participants.length
    ) {
      return null;
    }
    return (
      session.participants.find((p) => p.id === game.currentPlayerId) || null
    );
  }, [game.gameStarted, game.currentPlayerId, session.participants]);

  const isMyTurn = useCallback(() => {
    const myPlayerId = game.playerMappings[session.participantId];
    return game.currentPlayerId === myPlayerId;
  }, [game.currentPlayerId, game.playerMappings, session.participantId]);

  const getOpponentInfo = useCallback(() => {
    if (!session.participantId || session.participants.length < 2) {
      return null;
    }
    return (
      session.participants.find((p) => p.id !== session.participantId) || null
    );
  }, [session.participantId, session.participants]);

  const currentParticipant = session.participants.find(
    (p) => p.id === session.participantId
  );
  const playerName = currentParticipant?.name || null;

  return {
    // Game phase and state
    gamePhase,
    isLoading: session.isSessionLoading || game.isGameLoading,
    error: session.sessionError || game.gameError,

    // UI state
    showNameModal,
    showSpectatorModal,
    showWinModal,
    winner,
    showSessionEndedModal,
    sessionEndedReason,

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

    // Inactivity timer from React state (updated by events)
    inactivityTimer,
    getLiveTimer: () => KubicKode?.inactivity.getLiveTimer() || null,

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
    handleSessionEndedModalClose,

    // Restart functionality
    ...restartVoting,

    // Pass-through game helpers
    getTile: game.getTile,
    getGridDimensions: game.getGridDimensions,

    // Pass-through session actions (for advanced use)
    initializeSession: session.initializeSession,
    joinSession: session.joinSession,
    addAIParticipant: session.addAIParticipant,
    startGame: game.startGame,
    checkSessionAvailability: session.checkSessionAvailability,
    leaveSession: session.leaveSession,

    // Session state sync for browser integration
    syncSessionState: async (newSessionId, newParticipantId) => {
      try {
        await session.syncSessionState(newSessionId, newParticipantId);
        await refreshData();
      } catch (err) {
        console.error("[useTicTacToe] Error syncing session state:", err);
        toast({
          title: "Sync failed",
          description: err.message,
          status: "error",
          duration: 3000,
        });
      }
    },
  };
}

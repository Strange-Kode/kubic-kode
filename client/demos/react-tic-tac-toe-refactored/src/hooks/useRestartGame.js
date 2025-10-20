import { useState, useCallback, useEffect } from "react";
// Import from new modular structure
import "../../../../kubic-kode-helper/index.js";

export function useRestartVoting(session, game, refreshData) {
  // Restart voting state
  const [showRestartVoteModal, setShowRestartVoteModal] = useState(false);
  const [restartVoteInitiator, setRestartVoteInitiator] = useState(null);
  const [restartVotes, setRestartVotes] = useState({});

  // Get KubicKode helper
  const KubicKode = window.KubicKode;

  // Reset voting state when session changes (prevents stale data between sessions)
  useEffect(() => {
    setShowRestartVoteModal(false);
    setRestartVoteInitiator(null);
    setRestartVotes({});
  }, [session.sessionId]);

  // Sync KubicKode helper state with session
  useEffect(() => {
    if (KubicKode && session.sessionId && session.participantId) {
      KubicKode.sessionId = session.sessionId;
      KubicKode.participantId = session.participantId;
      KubicKode.gameToken = session.getGameToken();
    }
  }, [session.sessionId, session.participantId, KubicKode]);

  // Request restart vote using KubicKode helper
  const requestRestart = useCallback(async () => {
    if (!KubicKode) {
      throw new Error("KubicKode helper not available");
    }

    if (!session.sessionId) {
      throw new Error("No session available");
    }

    try {
      // Track that this participant initiated the restart and show modal immediately
      setRestartVoteInitiator(session.participantId);
      setShowRestartVoteModal(true);
      setRestartVotes({});

      // Use KubicKode helper's voting system
      await KubicKode.voting.initiate(session.participants);
    } catch (err) {
      console.error("[useRestartVoting] Error requesting restart:", err);
      // Reset on error
      setRestartVoteInitiator(null);
      setShowRestartVoteModal(false);
      setRestartVotes({});
      throw err;
    }
  }, [
    session.sessionId,
    session.participantId,
    session.participants,
    KubicKode,
  ]);

  // Submit restart vote using KubicKode helper
  const submitRestartVote = useCallback(
    async (voteYes) => {
      if (!KubicKode) {
        throw new Error("KubicKode helper not available");
      }

      if (!session.sessionId || !session.participantId) {
        throw new Error("No session or participant ID available");
      }

      try {
        await KubicKode.voting.vote(voteYes);
      } catch (err) {
        console.error("[useRestartVoting] Error submitting restart vote:", err);
        throw err;
      }
    },
    [session.sessionId, session.participantId, KubicKode]
  );

  // Handle restart sequence for initiator
  const handleRestartSequence = useCallback(async () => {
    try {
      // Since tic-tac-toe automatically stops when someone wins,
      // we can directly start the new game (which includes resetForRestart)
      const result = await game.startGame();

      if (result.success) {
        await refreshData();
      } else {
        console.error(
          "[useRestartVoting] Failed to restart game:",
          result.error
        );
        // Re-throw so the .catch() in handleRestartVoteEvent can handle it
        throw new Error(result.error || "Failed to restart game");
      }
    } catch (err) {
      console.error("[useRestartVoting] Error in restart sequence:", err);
      // Re-throw so the .catch() in handleRestartVoteEvent can handle it with setError
      throw err;
    }
  }, [session.sessionId, game, refreshData]);

  // Close restart vote modal
  const handleRestartVoteModalClose = useCallback(() => {
    setShowRestartVoteModal(false);
    setRestartVoteInitiator(null);
    setRestartVotes({});
  }, []);

  // Handle restart vote WebSocket events
  const handleRestartVoteEvent = useCallback(
    (data, setError, setShowWinModal, setWinner) => {
      console.log("[useRestartGame] handleRestartVoteEvent called with:", data);

      if (data.type === "restartVoteStarted") {
        // Only show modal and set initiator for non-initiators
        // The initiator already has their modal open
        if (!showRestartVoteModal) {
          setShowRestartVoteModal(true);
          setRestartVoteInitiator("Another player");
          setRestartVotes({});
        }

        // AI auto-voting is now handled by KubicKode helper
      }

      if (data.type === "restartVoteUpdate") {
        console.log("[useRestartGame] Updating votes with:", data.payload);
        setRestartVotes((prev) => ({
          ...prev,
          [data.payload.participantId]: data.payload.vote,
        }));
      }

      if (data.type === "restartVoteResult") {
        console.log("[useRestartVoting] Vote result received:", {
          allAgreed: data.payload.allAgreed,
          restartVoteInitiator,
          sessionParticipantId: session.participantId,
          shouldExecuteRestart: restartVoteInitiator === session.participantId
        });

        if (data.payload.allAgreed) {
          // All players agreed to restart - restart the game!
          setShowRestartVoteModal(false);
          setShowWinModal(false);
          setWinner(null);
          setRestartVotes({});

          // Only the vote initiator should handle the actual restart
          if (restartVoteInitiator === session.participantId) {
            setRestartVoteInitiator(null);

            // Execute restart sequence
            handleRestartSequence().catch((err) => {
              console.error(
                "[useRestartVoting] Error in restart sequence:",
                err
              );
              setError(err.message || "Failed to restart game");
            });
          } else {
            setRestartVoteInitiator(null);
            // Add a 2-second delay before refreshing for non-initiators
            setTimeout(() => {
              refreshData();
            }, 2000);
          }
        } else {
          // Not everyone agreed
          setShowRestartVoteModal(false);
          setRestartVotes({});
          setRestartVoteInitiator(null);
        }
      }
    },
    [
      showRestartVoteModal,
      restartVoteInitiator,
      session.participantId,
      session.sessionId,
      game,
      refreshData,
      handleRestartSequence,
    ]
  );

  return {
    // State
    showRestartVoteModal,
    restartVoteInitiator,
    restartVotes,

    // Actions
    requestRestart,
    submitRestartVote,
    handleRestartVoteModalClose,
    handleRestartVoteEvent,
  };
}

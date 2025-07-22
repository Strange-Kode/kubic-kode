import { useState, useCallback } from "react";

export function useRestartVoting(session, game, refreshData) {
  // Restart voting state
  const [showRestartVoteModal, setShowRestartVoteModal] = useState(false);
  const [restartVoteInitiator, setRestartVoteInitiator] = useState(null);
  const [restartVotes, setRestartVotes] = useState({});

  // Request restart vote
  const requestRestart = useCallback(async () => {
    if (!session.sessionId) {
      throw new Error("No session available");
    }

    try {
      // Track that this participant initiated the restart and show modal immediately
      setRestartVoteInitiator(session.participantId);
      setShowRestartVoteModal(true);
      setRestartVotes({});

      const response = await fetch(
        `/api/session/request-restart-vote/${session.sessionId}`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to request restart");
      }

      console.log("[useRestartVoting] Restart vote initiated");

      // Automatically submit "Yes" vote for the initiator
      const voteResponse = await fetch(
        `/api/session/submit-restart-vote/${session.sessionId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            participantId: session.participantId,
            voteYes: true,
          }),
        }
      );

      if (!voteResponse.ok) {
        console.error("[useRestartVoting] Failed to auto-vote for initiator");
      } else {
        console.log("[useRestartVoting] Auto-voted Yes for restart initiator");
      }
    } catch (err) {
      console.error("[useRestartVoting] Error requesting restart:", err);
      // Reset on error
      setRestartVoteInitiator(null);
      setShowRestartVoteModal(false);
      setRestartVotes({});
      throw err;
    }
  }, [session.sessionId, session.participantId]);

  // Submit restart vote
  const submitRestartVote = useCallback(
    async (voteYes) => {
      if (!session.sessionId || !session.participantId) {
        throw new Error("No session or participant ID available");
      }

      try {
        const response = await fetch(
          `/api/session/submit-restart-vote/${session.sessionId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              participantId: session.participantId,
              voteYes: voteYes,
            }),
          }
        );

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to submit vote");
        }

        console.log("[useRestartVoting] Restart vote submitted:", voteYes);
      } catch (err) {
        console.error("[useRestartVoting] Error submitting restart vote:", err);
        throw err;
      }
    },
    [session.sessionId, session.participantId]
  );

  // Handle restart sequence for initiator
  const handleRestartSequence = useCallback(async () => {
    try {
      console.log("[useRestartVoting] Starting game restart sequence...");

      // Since tic-tac-toe automatically stops when someone wins,
      // we can directly start the new game (which includes resetForRestart)
      const result = await game.startGame();

      if (result.success) {
        console.log("[useRestartVoting] Game restarted successfully!");
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
      if (data.type === "restartVoteStarted") {
        console.log("[useRestartVoting] Restart vote started");

        // Only show modal and set initiator for non-initiators
        // The initiator already has their modal open
        if (!showRestartVoteModal) {
          setShowRestartVoteModal(true);
          setRestartVoteInitiator("Another player");
          setRestartVotes({});
        }
      }

      if (data.type === "restartVoteUpdate") {
        console.log("[useRestartVoting] Restart vote update:", data.payload);
        setRestartVotes((prev) => ({
          ...prev,
          [data.payload.participantId]: data.payload.vote,
        }));
      }

      if (data.type === "restartVoteResult") {
        console.log("[useRestartVoting] Restart vote result:", data.payload);
        if (data.payload.allAgreed) {
          // All players agreed to restart - restart the game!
          console.log(
            "[useRestartVoting] All players agreed! Restarting game..."
          );
          setShowRestartVoteModal(false);
          setShowWinModal(false);
          setWinner(null);
          setRestartVotes({});

          // Only the vote initiator should handle the actual restart
          if (restartVoteInitiator === session.participantId) {
            console.log(
              "[useRestartVoting] I am the initiator, handling restart..."
            );
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
            console.log(
              "[useRestartVoting] Not the initiator, waiting 2s before refreshing data after restart..."
            );
            setRestartVoteInitiator(null);
            // Add a 2-second delay before refreshing for non-initiators
            setTimeout(() => {
              refreshData().then(() => {
                console.log(
                  "[useRestartVoting] Non-initiator data refreshed after restart (with delay)"
                );
              });
            }, 2000);
          }
        } else {
          // Not everyone agreed
          console.log("[useRestartVoting] Restart was not agreed upon");
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

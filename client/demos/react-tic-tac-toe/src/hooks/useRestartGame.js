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
      if (data.type === "restartVoteStarted") {
        // Only show modal and set initiator for non-initiators
        // The initiator already has their modal open
        if (!showRestartVoteModal) {
          setShowRestartVoteModal(true);
          setRestartVoteInitiator("Another player");
          setRestartVotes({});
        }

        // AI auto-voting: Check if there are any AI participants that need to auto-vote
        // Only include playable participants (users and computers) in voting
        const aiParticipants = session.participants.filter(p => p.type === "computer");
        aiParticipants.forEach(aiParticipant => {
          // Add a small delay to make it feel more realistic
          setTimeout(() => {
            console.log(`[AI Auto-Vote] AI participant ${aiParticipant.name} (ID: ${aiParticipant.id}) automatically voting Yes`);
            
            // Submit AI vote directly via API call
            fetch(`/api/session/submit-restart-vote/${session.sessionId}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                participantId: aiParticipant.id,
                voteYes: true,
              }),
            }).catch(err => {
              console.error(`[AI Auto-Vote] Failed to submit vote for AI ${aiParticipant.name}:`, err);
            });
          }, 500 + Math.random() * 1000); // 500-1500ms delay
        });
      }

      if (data.type === "restartVoteUpdate") {
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
            console.log("[useRestartVoting] Executing restart sequence as initiator");
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
            console.log("[useRestartVoting] Not executing restart - not initiator, waiting for initiator");
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

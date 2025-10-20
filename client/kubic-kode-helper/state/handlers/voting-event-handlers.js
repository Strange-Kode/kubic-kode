/**
 * Restart voting WebSocket event handlers
 * Handles: restartVoteStarted, restartVoteUpdate, restartVoteResult
 */
export function createVotingEventHandlers(helper) {
  return {
    /**
     * Handle restartVoteStarted WebSocket event
     * @param {Object} payload - Event payload
     */
    handleRestartVoteStarted: (payload) => {
      // Emit high-level event for UI
      helper.events.emit("restartVotingStarted", {
        initiatorId: payload.initiatorId,
        participants: payload.participants,
      });
    },

    /**
     * Handle restartVoteUpdate WebSocket event
     * @param {Object} payload - Event payload with participantId and vote
     */
    handleRestartVoteUpdate: (payload) => {
      console.log("[KubicKode.flow] Received kubic::restartVoteUpdate:", payload);
      // Update voting state in KubicKode.voting
      if (payload.participantId && payload.vote !== undefined) {
        helper.voting.votes[payload.participantId] = payload.vote;
        console.log("[KubicKode.flow] Updated voting state:", helper.voting.votes);
      }

      // Emit high-level event for UI
      console.log("[KubicKode.flow] Emitting restartVotingUpdated event");
      helper.events.emit("restartVotingUpdated", {
        participantId: payload.participantId,
        vote: payload.vote,
        allVotes: { ...helper.voting.votes },
      });
    },

    /**
     * Handle restartVoteResult WebSocket event
     * @param {Object} payload - Event payload with allAgreed boolean
     */
    handleRestartVoteResult: (payload) => {
      const allAgreed = payload.allAgreed;

      // Emit high-level event for UI
      helper.events.emit("restartVotingCompleted", {
        allAgreed,
        initiatorId: helper.voting.initiatorId,
      });

      // Reset voting state after result
      setTimeout(() => {
        helper.voting.reset();
      }, 100);
    },
  };
}

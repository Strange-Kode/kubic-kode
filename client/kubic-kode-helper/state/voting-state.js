/**
 * High-level restart voting management factory
 * Creates a voting state object bound to the helper instance
 */
export function createVotingState(helper) {
  return {
    // Voting state
    isActive: false,
    initiatorId: null,
    votes: {},
    voteCount: 0,

    /**
     * Initialize restart voting with automatic initiator vote
     * @returns {Promise<Object>} The API response
     */
    async initiate() {
      try {
        // Request restart vote
        const result = await helper.requestRestartVote();

        if (result.success) {
          // Update voting state
          this.isActive = true;
          this.initiatorId = helper.participantId;
          this.votes = {};
          this.voteCount = 0;

          // Auto-submit "Yes" vote for initiator
          await helper.submitRestartVote(true);
          this.votes[helper.participantId] = true;
          this.voteCount = 1;

          // Emit event for UI updates
          helper.events.emit("restartVoteInitiated", {
            initiatorId: helper.participantId,
            votes: this.votes,
          });
        }

        return result;
      } catch (error) {
        this.isActive = false;
        this.initiatorId = null;
        this.votes = {};
        this.voteCount = 0;
        throw error;
      }
    },

    /**
     * Submit a vote and update local state
     * @param {boolean} voteYes - Whether to vote yes
     * @returns {Promise<Object>} The API response
     */
    async vote(voteYes) {
      const result = await helper.submitRestartVote(voteYes);

      if (result.success) {
        this.votes[helper.participantId] = voteYes;
        this.voteCount = Object.keys(this.votes).length;

        // Emit event for UI updates
        helper.events.emit("restartVoteSubmitted", {
          participantId: helper.participantId,
          vote: voteYes,
          allVotes: this.votes,
        });
      }

      return result;
    },

    /**
     * Reset voting state
     */
    reset() {
      this.isActive = false;
      this.initiatorId = null;
      this.votes = {};
      this.voteCount = 0;
    },

    /**
     * Get current voting state
     * @returns {Object} Current voting state
     */
    getState() {
      return {
        isActive: this.isActive,
        initiatorId: this.initiatorId,
        votes: { ...this.votes },
        voteCount: this.voteCount,
      };
    },
  };
}

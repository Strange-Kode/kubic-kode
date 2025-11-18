import {
  KubicSystemError,
  KubicValidationError,
  ErrorFactory,
  ErrorCodes,
} from "../../game-engine/kubic-kode-error.js";

import { kubicLog } from "../../kubic-log.js";

export class SessionVoteManager {
  constructor(sessionId) {
    this._sessionId = sessionId;
    this._restartVote = null; // { votes: {}, totalParticipants: N }
    this._aiVoteTimers = []; // Track AI vote timers for cleanup
  }

  // Restart Vote Management
  // -----------------------

  /**
   * Start a restart game vote for the session
   * @param {Array<Object>} playableParticipants - Array of playable participant objects
   * @param {Function} onAiVoteCallback - Optional callback when AI votes (for broadcasting)
   */
  startRestartVote(playableParticipants, onAiVoteCallback = null) {
    // Only count playable participants (users and computers) for voting
    this._restartVote = {
      votes: {}, // participantId => true/false
      totalParticipants: playableParticipants.length,
    };

    const aiParticipants = playableParticipants.filter(
      (p) => p.type === "computer"
    );
    const delay = parseInt(process.env.KUBIC_AI_AUTO_VOTE_DELAY) || 1500;

    aiParticipants.forEach((aiParticipant) => {
      const timer = setTimeout(() => {
        // AI always votes yes
        this.registerRestartVote(aiParticipant.id, true);

        // Notify via callback if provided
        if (onAiVoteCallback) {
          onAiVoteCallback(aiParticipant.id, aiParticipant.name);
        }
      }, delay);

      this._aiVoteTimers.push(timer);
    });
  }

  /**
   * Register a participant's vote for restart
   * @param {number} participantId - The participant ID
   * @param {boolean} voteYes - Whether the participant voted yes for restart
   * @throws {Error} If no active restart vote exists
   */
  registerRestartVote(participantId, voteYes) {
    if (!this._restartVote) {
      throw ErrorFactory.validation(
        "No active restart vote",
        "restartVote",
        this._restartVote,
        {
          context: {
            method: "SessionVoteManager.registerRestartVote",
            participantId,
            suggestion: "Start a restart vote before registering votes",
          },
        }
      );
    }

    this._restartVote.votes[participantId] = voteYes;
  }

  /**
   * Check if a restart vote is currently in progress
   * @returns {boolean} True if a restart vote is active, false otherwise
   */
  isRestartVoteInProgress() {
    return this._restartVote !== null;
  }

  /**
   * Check if the restart vote is complete (all playable participants have voted)
   * Note: computer always votes yes.
   * @returns {boolean} True if all playable participants have voted, false otherwise
   */
  isRestartVoteComplete() {
    if (!this._restartVote) return false;
    return (
      Object.keys(this._restartVote.votes).length ===
      this._restartVote.totalParticipants
    );
  }

  /**
   * Get the result of the restart vote
   * @returns {boolean} True if all playable participants voted yes, false otherwise
   * Note: computer always votes yes.
   * @throws {Error} If the vote is not complete
   */
  getRestartVoteResult() {
    if (!this.isRestartVoteComplete()) {
      throw ErrorFactory.validation(
        "Vote not complete",
        "restartVote",
        this._restartVote,
        {
          context: {
            method: "SessionVoteManager.getRestartVoteResult",
            suggestion:
              "Wait for all participants to vote before getting the result",
          },
        }
      );
    }
    return Object.values(this._restartVote.votes).every((v) => v === true);
  }

  /**
   * Clear the current restart vote
   * @returns {boolean|null} The vote result if vote was complete, null otherwise
   */
  clearRestartVote() {
    const voteResult = this._restartVote ? this.getRestartVoteResult() : null;
    this._restartVote = null;

    // Clear any pending AI vote timers
    this._aiVoteTimers.forEach((timer) => clearTimeout(timer));
    this._aiVoteTimers = [];

    return voteResult;
  }

  /**
   * Get the current restart vote state
   * @returns {Object|null} The restart vote object or null if no vote is active
   */
  getRestartVote() {
    return this._restartVote;
  }

  /**
   * Get vote statistics
   * @returns {Object} Object containing vote statistics
   */
  getVoteStats() {
    if (!this._restartVote) {
      return {
        active: false,
        totalParticipants: 0,
        votesCast: 0,
        yesVotes: 0,
        noVotes: 0,
      };
    }

    const votes = Object.values(this._restartVote.votes);
    const yesVotes = votes.filter((v) => v === true).length;
    const noVotes = votes.filter((v) => v === false).length;

    return {
      active: true,
      totalParticipants: this._restartVote.totalParticipants,
      votesCast: votes.length,
      yesVotes: yesVotes,
      noVotes: noVotes,
      complete: this.isRestartVoteComplete(),
    };
  }

  /**
   * Get participants who haven't voted yet
   * @param {Array<Object>} playableParticipants - Array of playable participant objects
   * @returns {Array<Object>} Array of participants who haven't voted
   */
  getParticipantsWhoHaventVoted(playableParticipants) {
    if (!this._restartVote) {
      return playableParticipants;
    }

    return playableParticipants.filter(
      (p) => !(p.id in this._restartVote.votes)
    );
  }

  /**
   * Check if a participant has voted
   * @param {number} participantId - The participant ID to check
   * @returns {boolean} True if the participant has voted, false otherwise
   */
  hasParticipantVoted(participantId) {
    if (!this._restartVote) {
      return false;
    }
    return participantId in this._restartVote.votes;
  }

  /**
   * Get a participant's vote
   * @param {number} participantId - The participant ID
   * @returns {boolean|null} The participant's vote (true/false) or null if they haven't voted
   */
  getParticipantVote(participantId) {
    if (!this._restartVote || !this.hasParticipantVoted(participantId)) {
      return null;
    }
    return this._restartVote.votes[participantId];
  }
}

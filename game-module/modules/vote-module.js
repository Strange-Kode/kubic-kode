import { GameEventService } from "../../game-server/game-event-service.js";
import { kubicLog } from "../../kubic-log.js";

export default {
  async init() {
    kubicLog.info('[vote] Module initialized');
  },

  /**
   * Start a restart vote
   * @param {Object} gameSession - The game session
   * @returns {Object} Vote initialization result
   */
  startRestartVote(gameSession) {
    // Check if a restart vote is already in progress
    if (gameSession.getVoteManager().isRestartVoteInProgress()) {
      return { 
        vote_inited: true, 
        message: "Restart vote already in progress" 
      };
    }

    // Callback for when AI votes (for broadcasting)
    const onAiVote = (participantId, participantName) => {
      kubicLog.info(`[vote] AI VOTE callback triggered for ${participantName} (${participantId})`);
      try {
        kubicLog.info(`[vote] Broadcasting kubic::restartVoteUpdate for ${participantId}`);
        // Broadcast AI vote update
        GameEventService.broadcastToSession(gameSession, {
          type: "kubic::restartVoteUpdate",
          payload: {
            participantId,
            vote: true,
          },
        });

        kubicLog.info(`[vote] AI participant ${participantName} (${participantId}) auto-voted Yes`);

        // Check if voting is complete after AI vote
        if (gameSession.getVoteManager().isRestartVoteComplete()) {
          const allAgreed = gameSession.getVoteManager().getRestartVoteResult();

          GameEventService.broadcastToSession(gameSession, {
            type: "kubic::restartVoteResult",
            payload: {
              allAgreed,
              votes: gameSession.getVoteManager().getRestartVote().votes,
            },
          });

          gameSession.getVoteManager().clearRestartVote();
        }
      } catch (error) {
        kubicLog.error("[vote] Error handling AI vote:", error);
      }
    };

    const participants = gameSession.getPlayableParticipants();
    kubicLog.info(`[vote] Starting restart vote with ${participants.length} participants:`,
      participants.map(p => `${p.name} (${p.type})`));

    gameSession.getVoteManager().startRestartVote(participants, onAiVote);

    // Broadcast the event after initialization
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::restartVoteStarted",
        payload: {
          participants: gameSession.getParticipants().map((p) => p.id),
        },
      });
    } catch (broadcastError) {
      kubicLog.error("[vote] Broadcast error (non-blocking):", broadcastError);
    }

    return { vote_inited: true };
  },

  /**
   * Submit a restart vote
   * @param {Object} gameSession - The game session
   * @param {string} participantId - ID of the participant voting
   * @param {boolean} voteYes - Whether the vote is yes or no
   * @returns {Object} Vote submission result
   */
  submitRestartVote(gameSession, participantId, voteYes) {
    gameSession.getVoteManager().registerRestartVote(participantId, voteYes === true);

    const result = { success: true };

    // Broadcast the event after registering the vote
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::restartVoteUpdate",
        payload: {
          participantId,
          vote: voteYes === true,
        },
      });

      if (gameSession.getVoteManager().isRestartVoteComplete()) {
        const allAgreed = gameSession.getVoteManager().getRestartVoteResult();

        GameEventService.broadcastToSession(gameSession, {
          type: "kubic::restartVoteResult",
          payload: {
            allAgreed,
            votes: gameSession.getVoteManager().getRestartVote().votes,
          },
        });

        gameSession.getVoteManager().clearRestartVote();
      }
    } catch (broadcastError) {
      kubicLog.error("[vote] Broadcast error (non-blocking):", broadcastError);
    }

    return result;
  }
};


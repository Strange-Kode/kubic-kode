import { GameEventService } from "../../game-server/game-event-service.js";
import { sessionManager } from "../../game-server/session-manager.js";
import { kubicLog } from "../../kubic-log.js";
import { serializeRecursively } from "../../game-utility/game-utility.js";

export default {
  async init() {
    kubicLog.info('[participant] Module initialized');
  },

  /**
   * Add a participant to a session
   * @param {Object} gameSession - The game session
   * @param {string} participantName - Name of the participant
   * @param {string} participantType - Type of participant (user, computer, spectator)
   * @returns {Object} Join result with participant info
   */
  async joinSession(gameSession, participantName, participantType = "user") {
    const participantId = gameSession.addParticipant(participantName, participantType);
    const participant = gameSession.getParticipantById(participantId);

    // Get the participant's game token
    const gameToken = await gameSession.generateParticipantToken(participantId);
    
    const result = { 
      success: true, 
      participant_id: participantId,
      game_token: gameToken
    };

    // Broadcast the event after preparing the response
    try {
      const eventType = participantType === "spectator" ? "kubic::sessionSpectatorJoined" : "kubic::sessionParticipantJoined";
      GameEventService.broadcastToSession(gameSession, {
        type: eventType,
        payload: { participant: serializeRecursively(participant) },
      });
    } catch (broadcastError) {
      kubicLog.error("[participant] Broadcast error (non-blocking):", broadcastError);
    }

    return result;
  },

  /**
   * Remove a participant from a session
   * @param {Object} gameSession - The game session
   * @param {string} participantId - ID of the participant to remove
   * @returns {Object} Leave result
   */
  leaveSession(gameSession, participantId) {
    const participant = gameSession.getParticipantById(participantId);
    const wasStarted = gameSession.isStarted();
    const previousHost = gameSession.getParticipantManager().getHost();

    gameSession.removeParticipant(participantId);

    const remainingPlayable = gameSession.getPlayableParticipants();

    // Broadcast the leave event
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::sessionParticipantLeft",
        payload: { participant: serializeRecursively(participant) },
      });
    } catch (broadcastError) {
      kubicLog.error("[participant] Broadcast error (non-blocking):", broadcastError);
    }

    // Detect and broadcast auto host transfer
    // The kubic::hostTransferred broadcast carries a `reason` field so consumers can
    // distinguish this auto-promotion (`"host-left"`) from an explicit handoff
    // (`"host-handoff"`, broadcast from the transferHost action below).
    const currentHost = gameSession.getParticipantManager().getHost();
    if (previousHost && currentHost && previousHost.id !== currentHost.id) {
      try {
        GameEventService.broadcastToSession(gameSession, {
          type: "kubic::hostTransferred",
          payload: {
            oldHost: previousHost,
            newHost: currentHost,
            reason: "host-left"
          }
        });

        const systemMessage = gameSession.getChatManager().addSystemMessage(`${currentHost.name} is now the host`);
        GameEventService.broadcastToSession(gameSession, {
          type: "kubic::lobbyChatMessage",
          payload: { message: systemMessage }
        });
      } catch (broadcastError) {
        kubicLog.error("[participant] Auto host transfer broadcast error (non-blocking):", broadcastError);
      }
    }

    // If the game was in progress, check if the session is still viable
    if (wasStarted) {
      GameEventService.checkSessionViability(gameSession);
    } else {
      // For non-started sessions, clean up if no human participants remain
      const hasHuman = remainingPlayable.some(p => p.type === "user");
      if (!hasHuman && remainingPlayable.length > 0) {
        sessionManager.removeSession(gameSession.getSessionId());
      }
    }

    return { success: true };
  },

  /**
   * List all participants in a session
   * @param {Object} session - The game session
   * @returns {Array} List of participants
   */
  listParticipants(session) {
    return session.listParticipants();
  },

  /**
   * Get participant statistics for a session
   * @param {Object} gameSession - The game session
   * @returns {Object} Participant statistics
   */
  getParticipantStats(gameSession) {
    const allParticipants = gameSession.listParticipants();
    const playableParticipants = gameSession.getPlayableParticipants();
    const spectatorParticipants = gameSession.getSpectatorParticipants();

    return {
      sessionId: gameSession.getSessionId(),
      maxPlayers: gameSession.getMaxPlayers(),
      total: allParticipants.length,
      players: playableParticipants.length,
      spectators: spectatorParticipants.length,
      canStart: playableParticipants.length >= gameSession.getMaxPlayers(),
      started: gameSession.isStarted(),
    };
  },

  /**
   * Kick a participant from a session (host only)
   * @param {Object} gameSession - The game session
   * @param {string} participantIdToKick - ID of participant to kick
   * @param {string} hostId - ID of the host performing the kick
   * @returns {Object} Kick result
   */
  kickParticipant(gameSession, participantIdToKick, hostId) {
    const participantToKick = gameSession.getParticipantById(participantIdToKick);
    if (!participantToKick) {
      throw new Error("Participant to kick not found.");
    }

    gameSession.getLobbyManager().kickParticipant(participantIdToKick, hostId);

    const result = {
      success: true,
      kicked_participant: {
        id: participantToKick.id,
        name: participantToKick.name
      },
      remaining_participants: gameSession.listParticipants()
    };

    // Broadcast kick event
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::participantKicked",
        payload: {
          hostId: hostId,
          hostName: gameSession.getParticipantManager().getHost().name,
          kickedParticipant: {
            id: participantToKick.id,
            name: participantToKick.name
          }
        }
      });

      const systemMessage = gameSession.getChatManager().addSystemMessage(`${participantToKick.name} was removed from the session by the host`);
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::lobbyChatMessage",
        payload: { message: systemMessage }
      });
    } catch (broadcastError) {
      kubicLog.error("[participant] Kick broadcast error (non-blocking):", broadcastError);
    }

    return result;
  },

  /**
   * Transfer host privileges to another participant
   * @param {Object} gameSession - The game session
   * @param {string} currentHostId - Current host ID
   * @param {string} newHostId - New host ID
   * @returns {Object} Transfer result
   */
  transferHost(gameSession, currentHostId, newHostId) {
    if (!gameSession.getParticipantManager().isHost(currentHostId)) {
      throw new Error("Only the current host can transfer host privileges.");
    }

    const oldHost = gameSession.getParticipantManager().getHost();
    gameSession.getParticipantManager().transferHost(newHostId);
    const newHost = gameSession.getParticipantManager().getHost();

    const result = {
      success: true,
      old_host: oldHost,
      new_host: newHost
    };

    // Broadcast host transfer
    // reason: "host-handoff" - the current host actively called transferHost.
    // Pairs with "host-left" emitted by the leave handler above.
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::hostTransferred",
        payload: {
          oldHost: oldHost,
          newHost: newHost,
          reason: "host-handoff"
        }
      });

      const systemMessage = gameSession.getChatManager().addSystemMessage(`${newHost.name} is now the host`);
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::lobbyChatMessage",
        payload: { message: systemMessage }
      });
    } catch (broadcastError) {
      kubicLog.error("[participant] Host transfer broadcast error (non-blocking):", broadcastError);
    }

    return result;
  },

  /**
   * Auto-join a session for a game variant
   * @param {Object} sessionManager - The session manager
   * @param {string} gameVariantId - Game variant ID to join
   * @param {string} participantName - Name of the participant
   * @param {string} participantType - Type of participant
   * @param {boolean} createIfNone - Whether to create a new session if none available
   * @returns {Object} Auto-join result
   */
  async autoJoinSession(sessionManager, gameVariantId, participantName, participantType = "user", createIfNone = true) {
    if (!participantName || participantName.trim().length === 0) {
      throw new Error("participantName is required.");
    }

    const allSessions = sessionManager.getSessions();
    
    // Find sessions that match criteria
    // 1. Same game variant
    // 2. Not started
    // 3. Need more players
    // 4. Participant name not already in use
    const availableSessions = allSessions.filter(session => {
      if (session.getGameVariantId() !== gameVariantId) return false;
      if (session.isStarted()) return false;
      
      const status = session.getLobbyStatus();
      if (!status.needsMorePlayers) return false;

      // Don't auto-join into private games
      const isPrivate = status.lobbyConfig?.isPrivate === true;
      if (isPrivate) return false;
      
      // Check if participant name is already in use in this session
      const nameInUse = session.getParticipants().some(p => p.name === participantName.trim());
      if (nameInUse) return false;
      
      return true;
    });

    // Sort by preference: sessions with fewer players first (to balance)
    availableSessions.sort((a, b) => {
      const aPlayersCount = a.getPlayableParticipants().length;
      const bPlayersCount = b.getPlayableParticipants().length;
      return aPlayersCount - bPlayersCount;
    });

    let targetSession = null;
    let sessionCreated = false;

    if (availableSessions.length > 0) {
      // Join the first available session
      targetSession = availableSessions[0];
    } else if (createIfNone) {
      // Create new session if none available
      targetSession = sessionManager.createSession(gameVariantId);
      sessionCreated = true;
    } else {
      throw new Error("No available sessions found and auto-creation is disabled.");
    }

    // Join the target session
    const participantId = targetSession.addParticipant(participantName.trim(), participantType);
    const participant = targetSession.getParticipantById(participantId);

    // Get the participant's game token
    const gameToken = await targetSession.generateParticipantToken(participantId);

    const result = {
      success: true,
      session_id: targetSession.getSessionId(),
      participant_id: participantId,
      game_token: gameToken,
      session_created: sessionCreated,
      lobby_status: targetSession.getLobbyStatus()
    };

    // Broadcast the join event
    try {
      const eventType = participantType === "spectator" ? "kubic::sessionSpectatorJoined" : "kubic::sessionParticipantJoined";
      GameEventService.broadcastToSession(targetSession, {
        type: eventType,
        payload: { participant: serializeRecursively(participant) },
      });

      // If this was auto-join, add system message
      if (!sessionCreated) {
        const systemMessage = targetSession.getChatManager().addSystemMessage(`${participantName} joined via auto-match`);
        GameEventService.broadcastToSession(targetSession, {
          type: "kubic::lobbyChatMessage",
          payload: { message: systemMessage },
        });
      }
    } catch (broadcastError) {
      kubicLog.error("[participant] Auto-join broadcast error (non-blocking):", broadcastError);
    }

    return result;
  },

  /**
   * Process participant heartbeat
   * @param {Object} gameSession - The game session
   * @param {string} participantId - ID of the participant
   * @returns {Object} Heartbeat result
   */
  processHeartbeat(gameSession, participantId) {
    // Update participant connection status
    gameSession.updateParticipantConnection(participantId, true);
    
    return {
      success: true,
      timestamp: Date.now(),
      participant_id: participantId
    };
  },

  /**
   * Handle participant disconnection
   * @param {Object} gameSession - The game session
   * @param {Object} participant - The participant object
   * @param {string} participantId - ID of the participant
   * @param {string} reason - Reason for disconnection
   * @returns {Object} Disconnection result
   */
  handleDisconnection(gameSession, participant, participantId, reason = "Admin disconnect") {
    // Mark participant as disconnected
    gameSession.handleParticipantDisconnection(participantId);
    
    // Broadcast disconnection event
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::participantDisconnected",
        payload: {
          participantId: participantId,
          participantName: participant.name,
          reason: reason,
          disconnectedAt: new Date().toISOString()
        }
      });
    } catch (broadcastError) {
      kubicLog.error("[participant] Disconnection broadcast error (non-blocking):", broadcastError);
    }
    
    return {
      success: true,
      message: `Participant ${participant.name} has been disconnected`,
      participant_id: participantId
    };
  }
};


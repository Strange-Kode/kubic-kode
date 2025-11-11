import { GameEventService } from "../../game-server/game-event-service.js";
import { kubicLog } from "../../kubic-log.js";

export default {
  async init() {
    kubicLog.info('[lobby] Module initialized');
  },

  /**
   * Set lobby configuration (host only)
   * @param {Object} gameSession - The game session
   * @param {string} participantId - ID of the participant (must be host)
   * @param {Object} config - Configuration object
   * @returns {Object} Configuration update result
   */
  setLobbyConfig(gameSession, participantId, config) {
    // Validate that participant is the host
    if (!gameSession.getParticipantManager().isHost(participantId)) {
      throw new Error("Only the host can configure lobby settings.");
    }

    // Apply configuration changes
    const configChanges = [];
    for (const [key, value] of Object.entries(config)) {
      const oldValue = gameSession.getLobbyManager().getLobbyConfig(key);
      gameSession.getLobbyManager().setLobbyConfig(key, value, participantId);
      configChanges.push({ key, oldValue, newValue: value });
    }

    const result = {
      success: true,
      applied_config: config,
      changes: configChanges,
      full_config: gameSession.getLobbyManager().getAllLobbyConfig()
    };

    // Broadcast configuration changes
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::lobbyConfigUpdated",
        payload: {
          hostId: participantId,
          hostName: gameSession.getParticipantManager().getHost().name,
          changes: configChanges,
          fullConfig: gameSession.getLobbyManager().getAllLobbyConfig()
        }
      });

      // Add system message about config changes
      const changesList = configChanges.map(c => `${c.key}: ${c.newValue}`).join(", ");
      const systemMessage = gameSession.getChatManager().addSystemMessage(`Host updated game settings: ${changesList}`);
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::lobbyChatMessage",
        payload: { message: systemMessage }
      });
    } catch (broadcastError) {
      kubicLog.error("[lobby] Config broadcast error (non-blocking):", broadcastError);
    }

    return result;
  },

  /**
   * Get lobby configuration
   * @param {Object} gameSession - The game session
   * @returns {Object} Lobby configuration
   */
  getLobbyConfig(gameSession) {
    return {
      success: true,
      session_id: gameSession.getSessionId(),
      config: gameSession.getLobbyManager().getAllLobbyConfig(),
      host: gameSession.getParticipantManager().getHost()
    };
  },

  /**
   * Delete a lobby configuration key (host only)
   * @param {Object} gameSession - The game session
   * @param {string} participantId - ID of the participant (must be host)
   * @param {string} configKey - Configuration key to delete
   * @returns {Object} Deletion result
   */
  deleteLobbyConfig(gameSession, participantId, configKey) {
    const oldValue = gameSession.getLobbyManager().getLobbyConfig(configKey);
    const deleted = gameSession.getLobbyManager().deleteLobbyConfig(configKey, participantId);

    if (!deleted) {
      throw new Error(`Configuration key "${configKey}" not found.`);
    }

    const result = {
      success: true,
      deleted_key: configKey,
      old_value: oldValue,
      remaining_config: gameSession.getLobbyManager().getAllLobbyConfig()
    };

    // Broadcast configuration deletion
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::lobbyConfigDeleted",
        payload: {
          hostId: participantId,
          hostName: gameSession.getParticipantManager().getHost().name,
          deletedKey: configKey,
          oldValue: oldValue,
          remainingConfig: gameSession.getLobbyManager().getAllLobbyConfig()
        }
      });

      // Add system message
      const systemMessage = gameSession.getChatManager().addSystemMessage(`Host removed setting: ${configKey}`);
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::lobbyChatMessage",
        payload: { message: systemMessage }
      });
    } catch (broadcastError) {
      kubicLog.error("[lobby] Config deletion broadcast error (non-blocking):", broadcastError);
    }

    return result;
  },

  /**
   * Start sync phase (host only)
   * @param {Object} gameSession - The game session
   * @param {string} participantId - ID of the participant (must be host)
   * @returns {Object} Sync phase start result
   */
  startSyncPhase(gameSession, participantId) {
    if (!gameSession.getParticipantManager().isHost(participantId)) {
      throw new Error("Only the host can start sync phase.");
    }

    if (gameSession.isStarted()) {
      throw new Error("Game has already started.");
    }

    const playableParticipants = gameSession.getPlayableParticipants();
    if (playableParticipants.length < 2) {
      throw new Error("Need at least 2 players to start sync phase.");
    }

    gameSession.getLobbyManager().startSyncPhase();

    const result = {
      success: true,
      sync_phase: true,
      ready_states: gameSession.getLobbyManager().getAllReadyStates(),
      participants: gameSession.getPlayableParticipants().map(p => ({ id: p.id, name: p.name }))
    };

    // Broadcast sync phase start
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::syncPhaseStarted",
        payload: {
          hostId: participantId,
          hostName: gameSession.getHost().name,
          readyStates: gameSession.getLobbyManager().getAllReadyStates(),
          participants: gameSession.getPlayableParticipants()
        }
      });

      const systemMessage = gameSession.getChatManager().addSystemMessage("Synchronization phase started. Please indicate when you're ready!");
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::lobbyChatMessage",
        payload: { message: systemMessage }
      });
    } catch (broadcastError) {
      kubicLog.error("[lobby] Sync phase start broadcast error (non-blocking):", broadcastError);
    }

    return result;
  },

  /**
   * Set participant ready state
   * @param {Object} gameSession - The game session
   * @param {string} participantId - ID of the participant
   * @param {boolean} ready - Whether the participant is ready
   * @returns {Object} Ready state update result
   */
  setParticipantReady(gameSession, participantId, ready) {
    gameSession.getLobbyManager().setParticipantReady(participantId, ready);
    const participant = gameSession.getParticipantById(participantId);
    const allReady = gameSession.getLobbyManager().areAllParticipantsReady();

    const result = {
      success: true,
      participant_id: participantId,
      ready: ready,
      all_ready: allReady,
      ready_states: gameSession.getLobbyManager().getAllReadyStates()
    };

    // Broadcast ready state change
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::participantReadyChanged",
        payload: {
          participantId: participantId,
          participantName: participant.name,
          ready: ready,
          allReady: allReady,
          readyStates: gameSession.getLobbyManager().getAllReadyStates()
        }
      });

      // Add chat message about ready state change
      const readyText = ready ? "ready" : "not ready";
      const systemMessage = gameSession.getChatManager().addSystemMessage(`${participant.name} is ${readyText}`);
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::lobbyChatMessage",
        payload: { message: systemMessage }
      });

      // If all participants are ready, notify
      if (allReady) {
        const allReadyMessage = gameSession.getChatManager().addSystemMessage("All players are ready! Host can now start the game.");
        GameEventService.broadcastToSession(gameSession, {
          type: "kubic::lobbyChatMessage",
          payload: { message: allReadyMessage }
        });
      }
    } catch (broadcastError) {
      kubicLog.error("[lobby] Ready state broadcast error (non-blocking):", broadcastError);
    }

    return result;
  },

  /**
   * Get ready states
   * @param {Object} gameSession - The game session
   * @returns {Object} Ready states information
   */
  getReadyStates(gameSession) {
    return {
      success: true,
      session_id: gameSession.getSessionId(),
      in_sync_phase: gameSession.getLobbyManager().isInSyncPhase(),
      all_ready: gameSession.getLobbyManager().areAllParticipantsReady(),
      ready_states: gameSession.getLobbyManager().getAllReadyStates(),
      playable_participants: gameSession.getPlayableParticipants().map(p => ({ id: p.id, name: p.name }))
    };
  }
};


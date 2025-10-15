import { GameEventService } from "../game-event-service.js";

import { kubicLog } from "../../kubic-log.js";

export class SessionConnectionManager {
  constructor(sessionId, participantManager) {
    this._sessionId = sessionId;
    this._participantManager = participantManager;
    this._heartbeatStarted = false;
  }

  // Connection Management
  // --------------------

  /**
   * Start heartbeat for the session
   */
  startHeartbeat() {
    if (this._heartbeatStarted) {
      return;
    }
    
    GameEventService.startHeartbeatForSession(this._sessionId);
    this._heartbeatStarted = true;
  }

  /**
   * Stop heartbeat for the session
   */
  stopHeartbeat() {
    if (!this._heartbeatStarted) {
      return;
    }
    
    GameEventService.stopHeartbeatForSession(this._sessionId);
    this._heartbeatStarted = false;
  }

  /**
   * Check if heartbeat is started
   * @returns {boolean} True if heartbeat is started, false otherwise
   */
  isHeartbeatStarted() {
    return this._heartbeatStarted;
  }

  /**
   * Check session viability based on connected participants
   * @param {Object} gameInstance - The game instance to check required players
   * @returns {boolean} True if session is viable, false otherwise
   */
  checkSessionViability(gameInstance) {
    const playableParticipants = this._participantManager.getPlayableParticipants();
    const connectedParticipants = playableParticipants.filter(p => !p.disconnected);
    
    // Get required players from the game instance
    const requiredPlayers = gameInstance.requiredPlayers();
    
    if (connectedParticipants.length < requiredPlayers) {
      // Broadcast session ended event
      GameEventService.broadcastToSession({ getSessionId: () => this._sessionId }, {
        type: "kubic::sessionEnded",
        payload: {
          reason: "insufficient_players",
          message: "Session ended due to insufficient connected players",
          connectedParticipants: connectedParticipants.length,
          requiredParticipants: requiredPlayers
        }
      });
      
      return false;
    }
    
    return true;
  }

  /**
   * Handle participant reconnection
   * @param {number} participantId - The participant ID
   * @returns {boolean} True if reconnection was successful, false otherwise
   */
  handleParticipantReconnection(participantId) {
    const result = this._participantManager.handleParticipantReconnection(participantId);
    
    if (result) {
      // Broadcast reconnection event
      const participant = this._participantManager.getParticipantById(participantId);
      if (participant) {
        GameEventService.broadcastToSession({ getSessionId: () => this._sessionId }, {
          type: "kubic::participantReconnected",
          payload: {
            participantId: participantId,
            participantName: participant.name,
            reconnectedAt: new Date().toISOString()
          }
        });
      }
    }
    
    return result;
  }

  /**
   * Handle participant disconnection
   * @param {number} participantId - The participant ID
   * @returns {boolean} True if disconnection was successful, false otherwise
   */
  handleParticipantDisconnection(participantId) {
    const result = this._participantManager.handleParticipantDisconnection(participantId);
    
    if (result) {
      // Broadcast disconnection event
      const participant = this._participantManager.getParticipantById(participantId);
      if (participant) {
        GameEventService.broadcastToSession({ getSessionId: () => this._sessionId }, {
          type: "kubic::participantDisconnected",
          payload: {
            participantId: participantId,
            participantName: participant.name,
            disconnectedAt: new Date().toISOString()
          }
        });
      }
    }
    
    return result;
  }

  /**
   * Get session status including connection information
   * @param {Object} gameInstance - The game instance to check required players
   * @returns {Object} Object containing session status information
   */
  getSessionStatus(gameInstance) {
    const playableParticipants = this._participantManager.getPlayableParticipants();
    const connectedParticipants = playableParticipants.filter(p => !p.disconnected);
    const disconnectedParticipants = this._participantManager.getDisconnectedParticipants();
    
    // Get required players from the game instance
    const requiredPlayers = gameInstance.requiredPlayers();
    
    return {
      sessionId: this._sessionId,
      totalParticipants: this._participantManager.getParticipantCount(),
      connectedParticipants: connectedParticipants.length,
      disconnectedParticipants: disconnectedParticipants.length,
      playableParticipants: playableParticipants.length,
      requiredParticipants: requiredPlayers,
      viable: connectedParticipants.length >= requiredPlayers,
      heartbeatStarted: this._heartbeatStarted
    };
  }

  /**
   * Get connection statistics
   * @returns {Object} Object containing connection statistics
   */
  getConnectionStats() {
    const allParticipants = this._participantManager.getParticipants();
    const connectedParticipants = this._participantManager.getConnectedParticipants();
    const disconnectedParticipants = this._participantManager.getDisconnectedParticipants();

    return {
      total: allParticipants.length,
      connected: connectedParticipants.length,
      disconnected: disconnectedParticipants.length,
      connectionRate: allParticipants.length > 0 ? (connectedParticipants.length / allParticipants.length) * 100 : 0,
      heartbeatActive: this._heartbeatStarted
    };
  }

  /**
   * Force disconnect a participant
   * @param {number} participantId - The participant ID
   * @param {string} reason - The reason for disconnection
   * @returns {boolean} True if disconnection was successful, false otherwise
   */
  forceDisconnectParticipant(participantId, reason = "Admin disconnect") {
    const result = this.handleParticipantDisconnection(participantId);
    
    if (result) {
      // Broadcast forced disconnection event
      const participant = this._participantManager.getParticipantById(participantId);
      if (participant) {
        GameEventService.broadcastToSession({ getSessionId: () => this._sessionId }, {
          type: "kubic::participantForceDisconnected",
          payload: {
            participantId: participantId,
            participantName: participant.name,
            reason: reason,
            disconnectedAt: new Date().toISOString()
          }
        });
      }
    }
    
    return result;
  }

  /**
   * Get participants with connection issues
   * @param {number} maxReconnectionAttempts - Maximum allowed reconnection attempts
   * @returns {Array<Object>} Array of participants with connection issues
   */
  getParticipantsWithConnectionIssues(maxReconnectionAttempts = 3) {
    const participants = this._participantManager.getParticipants();
    return participants.filter(p => {
      const connectionStatus = this._participantManager.getConnectionStatus(p.id);
      return connectionStatus && connectionStatus.reconnectionAttempts >= maxReconnectionAttempts;
    });
  }

  /**
   * Reset connection status for all participants
   */
  resetAllConnectionStatus() {
    const participants = this._participantManager.getParticipants();
    participants.forEach(p => {
      this._participantManager.updateParticipantConnection(p.id, true);
    });
  }
}

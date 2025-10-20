/**
 * Session State factory function
 * Manages session-level state including participants, host status, and session metadata
 *
 *
 * @param {Object} helper - Reference to the main KubicKodeHelper instance
 * @returns {Object} Session state manager with state and methods
 */
export function createSessionState(helper) {
  return {
    // Session state
    id: null,
    participantId: null,
    participants: [],
    maxPlayers: null,
    isHost: false,
    isSessionLoading: false,
    sessionError: null,

    // Update session data from backend response
    updateSession(sessionData) {
      this.id = sessionData.sessionId || this.id;
      this.participantId = sessionData.participantId || this.participantId;
      this.participants = sessionData.participants || this.participants;

      if (sessionData.maxPlayers !== undefined) {
        this.maxPlayers = sessionData.maxPlayers;
      }

      this.isHost =
        sessionData.isHost !== undefined ? sessionData.isHost : this.isHost;

      // Sync with helper's main session tracking
      helper.sessionId = this.id;
      helper.participantId = this.participantId;

      helper.events.emit("sessionStateUpdated", this.getState());
    },

    // Update participants list
    updateParticipants(participants) {
      this.participants = participants || [];
      helper.events.emit("participantsUpdated", this.participants);
    },

    // Set loading state
    setLoading(isLoading) {
      this.isSessionLoading = isLoading;
      helper.events.emit("sessionLoadingChanged", isLoading);
    },

    // Set error state
    setError(error) {
      this.sessionError = error;
      helper.events.emit("sessionErrorChanged", error);
    },

    // Helper methods
    getParticipants() {
      return this.participants;
    },

    getParticipant(id) {
      return this.participants.find((p) => p.id === id);
    },

    isCurrentUserHost() {
      return this.isHost;
    },

    getPlayableParticipants() {
      return this.participants.filter(
        (p) => p.type === "user" || p.type === "computer"
      );
    },

    getSpectators() {
      return this.participants.filter((p) => p.type === "spectator");
    },

    // Game state checks
    canAutoStart() {
      const playableCount = this.getPlayableParticipants().length;
      return this.maxPlayers && playableCount === this.maxPlayers;
    },

    isSessionFull() {
      const playableCount = this.getPlayableParticipants().length;
      return this.maxPlayers && playableCount >= this.maxPlayers;
    },

    // Get current session state
    getState() {
      return {
        id: this.id,
        participantId: this.participantId,
        participants: [...this.participants],
        maxPlayers: this.maxPlayers,
        isHost: this.isHost,
        isSessionLoading: this.isSessionLoading,
        sessionError: this.sessionError,
        playableCount: this.getPlayableParticipants().length,
        spectatorCount: this.getSpectators().length,
        canAutoStart: this.canAutoStart(),
        isSessionFull: this.isSessionFull(),
      };
    },

    // Reset session state
    reset() {
      this.id = null;
      this.participantId = null;
      this.participants = [];
      this.maxPlayers = null;
      this.isHost = false;
      this.isSessionLoading = false;
      this.sessionError = null;
      helper.sessionId = null;
      helper.participantId = null;
      helper.events.emit("sessionReset");
    },
  };
}

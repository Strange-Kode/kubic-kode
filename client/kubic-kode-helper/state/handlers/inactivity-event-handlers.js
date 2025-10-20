/**
 * Inactivity timer WebSocket event handlers
 * Handles: timeLeft, playerInactive
 */
export function createInactivityEventHandlers(helper) {
  return {
    /**
     * Handle timeLeft (inactivity timer) WebSocket event
     * @param {Object} payload - Event payload with secondsLeft
     */
    handleTimeLeft: (payload) => {
      const secondsLeft = payload.secondsLeft;
      if (typeof secondsLeft === "number") {
        // Only update timer if there are enough players for the game to be playable
        const playableParticipants = helper.session.getPlayableParticipants();

        // Only proceed if maxPlayers is set and we have enough players
        if (helper.session.maxPlayers && playableParticipants.length >= helper.session.maxPlayers) {
          helper.inactivity.updateTimer(secondsLeft);

          // Emit event for UI updates
          helper.events.emit("inactivityTimerUpdate", { secondsLeft });
        }
      }
    },

    /**
     * Handle playerInactive WebSocket event
     * @param {Object} payload - Event payload with inactivePlayers
     */
    handlePlayerInactive: (payload) => {
      // Clear inactivity timer
      helper.inactivity.clearTimer();

      // Emit UI event to disable game
      helper.events.emit("gameDisabledByInactivity");

      // Check if there's a winner from inactivity
      const inactivePlayers = payload.inactivePlayers;
      if (inactivePlayers && inactivePlayers.length > 0) {
        const firstInactiveResult = inactivePlayers[0];
        const inactivityStatus = firstInactiveResult.inactivityStatus;

        if (inactivityStatus?.winnerPlayerId) {
          const winnerParticipant = helper.session.participants.find(
            (p) => p.id === inactivityStatus.winnerPlayerId
          );

          if (winnerParticipant) {
            helper.flow.winner = winnerParticipant;
            helper.flow.gamePhase = "ended";
            helper.game.updateGame({ active: false });

            // Emit high-level event for UI
            helper.events.emit("gameEnded", {
              winner: winnerParticipant,
              isTie: false,
              reason: "inactivity",
            });
          }
        }
      }
    },
  };
}

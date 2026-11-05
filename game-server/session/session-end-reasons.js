/* Handed to "session:ended" hooks as { reason } so a host can tell a game
   that was played out from one whose players left */
export const SESSION_END_REASONS = Object.freeze({
  GAME_WON: "game_won",
  GAME_TIED: "game_tied",
  GAME_STOPPED: "game_stopped",
  ORPHANED: "orphaned",
  INSUFFICIENT_PLAYERS: "insufficient_players",
  HOLD_EXPIRED: "hold_expired",
});

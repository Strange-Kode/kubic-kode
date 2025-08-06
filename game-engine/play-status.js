// PlayStatus - standardized class for representing the result of a playTurn operation
// 
// This class handles both competitive games (with win/tie concepts) and non-competitive games
// (like scrollable tile maps). Optional properties (playerHasWon, gameIsTied) are set to null
// for games that don't have those concepts, and are excluded from API responses.
export class PlayStatus {
  constructor(options = {}) {
    // Required properties
    this.status = options.status || 'ok'; // 'ok' or 'invalid'
    this.playerId = options.playerId || null; // int - player who made the turn

    // Optional properties that only make sense for certain game types
    this.playerHasWon = options.playerHasWon !== undefined ? options.playerHasWon : null;
    this.gameIsTied = options.gameIsTied !== undefined ? options.gameIsTied : null;

    // Additional optional properties for extensibility
    this.message = options.message || null;
    this.type = options.type || null; // e.g., 'occupied_tile', 'invalid_position'
    this.mark = options.mark || null; // for games that place marks/pieces
    this.winCondition = options.winCondition || null; // description of how player won
    this.gameEnded = options.gameEnded !== undefined ? options.gameEnded : null;
    this.timeLeft = options.timeLeft || null; // remaining time for turn/game
  }

  // Convert to snake_case object for API responses
  toSnakeCase() {
    const result = {};
    
    for (const [key, value] of Object.entries(this)) {
      // Only include properties that are not null/undefined
      if (value !== null && value !== undefined) {
        // Convert camelCase to snake_case
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        result[snakeKey] = value;
      }
    }
    
    return result;
  }

  // Static factory methods for common scenarios

  // Create a successful turn result
  static success(playerId, options = {}) {
    return new PlayStatus({
      status: 'ok',
      playerId,
      playerHasWon: false,
      gameIsTied: false,
      ...options
    });
  }

  // Create a winning turn result
  static win(playerId, options = {}) {
    return new PlayStatus({
      status: 'ok',
      playerId,
      playerHasWon: true,
      gameIsTied: false,
      gameEnded: true,
      ...options
    });
  }

  // Create a tie result
  static tie(playerId, options = {}) {
    return new PlayStatus({
      status: 'ok',
      playerId,
      playerHasWon: false,
      gameIsTied: true,
      gameEnded: true,
      ...options
    });
  }

  // Create an invalid turn result
  static invalid(playerId, message, options = {}) {
    return new PlayStatus({
      status: 'invalid',
      playerId,
      message,
      ...options
    });
  }

  // Create a result for games without winning concepts (e.g., scrollable tile maps)
  // These games don't have playerHasWon or gameIsTied concepts
  static nonCompetitive(playerId, options = {}) {
    return new PlayStatus({
      status: 'ok',
      playerId,
      // Explicitly leave playerHasWon and gameIsTied as null for non-competitive games
      // They will be excluded from toSnakeCase() output
      ...options
    });
  }

  // Create a result for movement-based games (like tile map exploration)
  static movement(playerId, options = {}) {
    return new PlayStatus({
      status: 'ok',
      playerId,
      // Movement games typically don't have win/tie concepts
      message: options.message || "Move successful",
      ...options
    });
  }
}
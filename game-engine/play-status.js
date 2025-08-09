// PlayStatus - standardized class for representing the result of a playTurn operation
// 
// This class handles both competitive games (with win/tie concepts) and non-competitive games
// (like turn-based scrollable adventure games). Optional properties (playerHasWon, gameIsTied) are set to null
// for games that don't have those concepts, and are excluded from API responses.
export class PlayStatus {
  constructor(options = {}) {
    // Use a Map to store properties for better encapsulation
    this._properties = new Map();
    
    // Required properties
    this._properties.set('status', options.status || 'ok'); // 'ok' or 'invalid'
    this._properties.set('playerId', options.playerId || null); // int - player who made the turn

    // Optional properties that only make sense for certain game types
    this._properties.set('playerHasWon', options.playerHasWon !== undefined ? options.playerHasWon : null);
    this._properties.set('gameIsTied', options.gameIsTied !== undefined ? options.gameIsTied : null);

    // Additional optional properties for extensibility
    this._properties.set('message', options.message || null);
    this._properties.set('type', options.type || null); // e.g., 'occupied_tile', 'invalid_position'
    this._properties.set('mark', options.mark || null); // for games that place marks/pieces
    this._properties.set('winCondition', options.winCondition || null); // description of how player won
    this._properties.set('gameEnded', options.gameEnded !== undefined ? options.gameEnded : null);
    this._properties.set('timeLeft', options.timeLeft || null); // remaining time for turn/game
  }

  // Generic accessor method for safe property access
  // Throws an error if the property doesn't exist, preventing silent typos
  access(propertyName) {
    if (!this._properties.has(propertyName)) {
      const availableProperties = Array.from(this._properties.keys()).join(', ');
      throw new Error(`PlayStatus does not have property '${propertyName}'. Available properties: ${availableProperties}`);
    }
    return this._properties.get(propertyName);
  }

  // Convert to snake_case object for API responses
  toSnakeCase() {
    const result = {};
    
    for (const [key, value] of this._properties) {
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
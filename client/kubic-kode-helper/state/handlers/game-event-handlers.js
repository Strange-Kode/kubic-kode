/**
 * Game lifecycle WebSocket event handlers
 * Handles: playerWon, gameTied, turnPlayed, gameStarted, winCount
 */
export function createGameEventHandlers(helper) {
  return {
    /**
     * Handle winCount WebSocket event
     * @param {Object} payload - Event payload with winCounts and totalGames
     */
    handleWinCount: (payload) => {
      // Update win counts from WebSocket payload
      helper.wins.updateWinCounts({
        playerWinCounts: payload.winCounts || {},
        totalGames: payload.totalGames || 0,
      });
    },

    /**
     * Handle playerWon WebSocket event
     * @param {Object} payload - Event payload with playerId
     */
    handlePlayerWon: (payload) => {
      // Find the winner participant
      const winnerParticipant = helper.session.participants.find(
        (p) => p.id === payload.playerId
      );

      if (winnerParticipant) {
        helper.flow.winner = winnerParticipant;
        helper.flow.gamePhase = "ended";
        helper.game.updateGame({ active: false });

        // Refresh win counts from game history after someone wins
        setTimeout(() => {
          helper.wins.refreshWinCounts();
        }, 100);

        // Emit high-level event for UI
        helper.events.emit("gameEnded", {
          winner: winnerParticipant,
          isTie: false,
        });
      }
    },

    /**
     * Handle gameTied WebSocket event
     * @param {Object} payload - Event payload
     */
    handleGameTied: (payload) => {
      helper.flow.winner = { id: null, name: "Tie", isTie: true };
      helper.flow.gamePhase = "ended";
      helper.game.updateGame({ active: false });

      // Refresh win counts from game history after a tie
      setTimeout(() => {
        helper.wins.refreshWinCounts();
      }, 100);

      // Emit high-level event for UI
      helper.events.emit("gameEnded", {
        winner: helper.flow.winner,
        isTie: true,
      });
    },

    /**
     * Handle turnPlayed WebSocket event
     * @param {Object} payload - Event payload with optional updatedTileMap
     */
    handleTurnPlayed: async (payload) => {
      // Always fetch fresh tilemap and current player from server
      try {
        const [tilemapResult, currentPlayerResult] = await Promise.all([
          helper.route.game("get-tilemap"),
          helper.route.game("get-current-player"),
        ]);

        if (tilemapResult.success) {
          helper.game.updateTilemap(tilemapResult.data.tiles);
        }

        if (currentPlayerResult.success) {
          const currentPlayerId =
            currentPlayerResult.data.current_player_id ||
            (currentPlayerResult.data.current_player_ids &&
            currentPlayerResult.data.current_player_ids.length > 0
              ? currentPlayerResult.data.current_player_ids[0]
              : null);
          helper.game.updateGame({ currentPlayerId });
        }
      } catch (error) {
        console.error(
          "[KubicKode.flow] Error fetching game state after turn:",
          error
        );
      }

      // Reset inactivity timer optimistically (use stored initial value)
      if (helper.inactivity.initialTimer !== null) {
        helper.inactivity.updateTimer(helper.inactivity.initialTimer);
        helper.events.emit("inactivityTimerUpdate", {
          secondsLeft: helper.inactivity.initialTimer,
        });
      }

      // Emit event for UI
      helper.events.emit("turnUpdated", payload);
    },

    /**
     * Handle gameStarted WebSocket event
     * @param {Object} payload - Event payload
     */
    handleGameStarted: async (payload) => {
      // Update game state to reflect that game has started
      helper.game.updateGame({
        started: true,
        active: true,
      });

      // Set game phase to active
      helper.flow.gamePhase = "active";

      // Update player mappings if provided
      if (payload.playerMappings) {
        helper.game.playerMappings = payload.playerMappings;
      }

      // Update tilemap if provided
      if (payload.updatedTileMap) {
        helper.game.updateGame({ tilemap: payload.updatedTileMap });
      }

      // Fetch complete game state (tilemap, player mappings, current player)
      // This ensures all clients get the initial game state when the game starts
      try {
        const [tilemapResult, playerMappingsResult, currentPlayerResult] =
          await Promise.all([
            helper.route.game("get-tilemap"),
            helper.route.game("get-player-mappings"),
            helper.route.game("get-current-player"),
          ]);

        if (tilemapResult.success) {
          helper.game.updateGame({ tilemap: tilemapResult.data.tiles });
        }

        if (playerMappingsResult.success) {
          helper.game.updateGame({
            playerMappings: playerMappingsResult.data.player_mappings,
          });
        }

        if (currentPlayerResult.success) {
          const currentPlayerId =
            currentPlayerResult.data.current_player_id ||
            (currentPlayerResult.data.current_player_ids &&
            currentPlayerResult.data.current_player_ids.length > 0
              ? currentPlayerResult.data.current_player_ids[0]
              : null);
          helper.game.updateGame({ currentPlayerId });
        }
      } catch (error) {
        console.error(
          "[KubicKode.flow] Error fetching game state after gameStarted:",
          error
        );
      }

      // Initialize inactivity timer from backend
      const initialTimer = payload.inactivityTimeout;
      helper.inactivity.initialTimer = initialTimer; // Store for later resets
      helper.inactivity.updateTimer(initialTimer);
      helper.events.emit("inactivityTimerUpdate", {
        secondsLeft: initialTimer,
      });

      // Re-enable game UI if it was disabled by inactivity
      helper.events.emit("gameReEnabled");
    },
  };
}

import { useState, useCallback, useEffect } from "react";

/**
 * Custom hook for game management
 * Handles game initialization, state fetching, move making, and game status tracking
 * All game routes use POST with game tokens for authentication
 */
export function useGame(sessionId, participantId, getGameToken) {
  const [isGameLoading, setIsGameLoading] = useState(false);
  const [gameError, setGameError] = useState(null);
  const [gameState, setGameState] = useState({});

  const KubicKode = window.KubicKode;

  useEffect(() => {
    if (!KubicKode) return;

    const handleGameStateUpdate = (state) => {
      setGameState(state);
    };

    const handleGameReset = () => {
      setGameState(KubicKode.game.getState());
    };

    KubicKode.events.on("gameStateUpdated", handleGameStateUpdate);
    KubicKode.events.on("gameReset", handleGameReset);
    KubicKode.events.on("tilemapUpdated", (tilemap) => {
      console.log("[useGame] Received tilemapUpdated event:", tilemap);
      setGameState(KubicKode.game.getState());
    });

    setGameState(KubicKode.game.getState());

    return () => {
      KubicKode.events.off("gameStateUpdated", handleGameStateUpdate);
      KubicKode.events.off("gameReset", handleGameReset);
    };
  }, [KubicKode]);

  // Helper function to extract current player ID from response data
  const extractCurrentPlayerId = useCallback((data) => {
    // Handle both array format (current_player_ids) and single value format (current_player_id)
    if (data.current_player_id !== undefined) {
      return data.current_player_id;
    } else if (data.current_player_ids) {
      return data.current_player_ids.length > 0
        ? data.current_player_ids[0]
        : null;
    }
    return null;
  }, []);

  // Fetch current game state (tilemap) - now uses POST with game token
  const fetchGameState = useCallback(async () => {
    if (!sessionId || !getGameToken) {
      return;
    }

    const gameToken = getGameToken();
    if (!gameToken) {
      console.warn("[useGame] No game token available for fetchGameState");
      return;
    }

    try {
      const KubicKode = window.KubicKode;
      const result = await KubicKode.route.game("get-tilemap");

      if (result.success) {
        KubicKode.game.updateTilemap(result.data.tiles);
      } else {
        console.error("[useGame] Failed to fetch game state:", result.error);
        setGameError(result.error);
      }
    } catch (error) {
      console.error("[useGame] Error fetching game state:", error);
      setGameError(error.message);
    }
  }, [sessionId, getGameToken]);

  // Fetch current player - now uses POST with game token
  const fetchCurrentPlayer = useCallback(async () => {
    if (!sessionId || !getGameToken) {
      return;
    }

    const gameToken = getGameToken();
    if (!gameToken) {
      console.warn("[useGame] No game token available for fetchCurrentPlayer");
      return;
    }

    try {
      const KubicKode = window.KubicKode;
      const result = await KubicKode.route.game("get-current-player");

      if (result.success) {
        const newCurrentPlayerId = extractCurrentPlayerId(result.data);
        KubicKode.game.updateGame({ currentPlayerId: newCurrentPlayerId });
      } else {
        console.error(
          "[useGame] Failed to fetch current player:",
          result.error
        );
      }
    } catch (error) {
      console.error("[useGame] Error fetching current player:", error);
    }
  }, [sessionId, getGameToken, extractCurrentPlayerId]);

  // Fetch player mappings - now uses POST with game token
  const fetchPlayerMappings = useCallback(async () => {
    if (!sessionId || !getGameToken) {
      return;
    }

    const gameToken = getGameToken();
    if (!gameToken) {
      console.warn("[useGame] No game token available for fetchPlayerMappings");
      return;
    }

    try {
      const KubicKode = window.KubicKode;
      const result = await KubicKode.route.game("get-player-mappings");

      if (result.success) {
        KubicKode.game.updateGame({
          playerMappings: result.data.player_mappings,
        });
      } else {
        console.error(
          "[useGame] Failed to fetch player mappings:",
          result.error
        );
      }
    } catch (error) {
      console.error("[useGame] Error fetching player mappings:", error);
    }
  }, [sessionId, getGameToken]);

  // Start the game (called when session has 2 participants) - now uses POST with game token
  const startGame = useCallback(async () => {
    if (!sessionId) {
      throw new Error("Session ID required to start game");
    }

    if (!participantId) {
      throw new Error("Participant ID required to start game");
    }

    if (!getGameToken) {
      throw new Error("Game token function required to start game");
    }

    const gameToken = getGameToken();
    if (!gameToken) {
      throw new Error("No game token available to start game");
    }

    setIsGameLoading(true);
    setGameError(null);

    try {
      const KubicKode = window.KubicKode;
      const result = await KubicKode.route.game("start", {
        participantId: participantId,
      });

      if (result.success) {
        const currentPlayerId = extractCurrentPlayerId(result.data);
        KubicKode.game.updateGame({
          started: true,
          active: true,
          currentPlayerId: currentPlayerId,
        });

        // Fetch initial game state after starting
        await fetchGameState();

        // Fetch player mappings after starting
        await fetchPlayerMappings();

        return { success: true, data: result.data };
      } else {
        console.error("[useGame] Failed to start game:", result.error);
        setGameError(result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("[useGame] Error starting game:", error);
      setGameError(error.message);
      return { success: false, error: error.message };
    } finally {
      setIsGameLoading(false);
    }
  }, [
    sessionId,
    participantId,
    fetchGameState,
    getGameToken,
    extractCurrentPlayerId,
  ]);

  // Check if game is active - now uses POST with game token
  const checkGameStatus = useCallback(async () => {
    if (!sessionId || !getGameToken) {
      return;
    }

    const gameToken = getGameToken();
    if (!gameToken) {
      console.warn("[useGame] No game token available for checkGameStatus");
      return;
    }

    const currentGameState = KubicKode.game.getState();
    console.log("[useGame] checkGameStatus - current game state:", currentGameState);

    // If game is already active but missing critical data, fetch it
    if (currentGameState.active && currentGameState.started) {
      const missingData = !currentGameState.tilemap ||
                         !currentGameState.currentPlayerId ||
                         Object.keys(currentGameState.playerMappings || {}).length === 0;

      if (missingData) {
        console.log("[useGame] Game active but missing data, fetching game state...");
        await Promise.all([
          fetchGameState(),
          fetchPlayerMappings(),
          fetchCurrentPlayer(),
        ]);
        return;
      }

      console.log("[useGame] checkGameStatus - early exit, game already active with all data");
      return;
    }

    try {
      const KubicKode = window.KubicKode;
      const result = await KubicKode.route.game("is-active");

      if (result.success) {
        const wasStarted = currentGameState.started;
        const wasActive = currentGameState.active;

        KubicKode.game.updateGame({
          active: result.data.is_active,
          started: result.data.is_active,
        });

        // If game is active and we didn't know it before, fetch all game data
        if (result.data.is_active && (!wasActive || !wasStarted)) {
          await Promise.all([
            fetchGameState(),
            fetchPlayerMappings(),
            fetchCurrentPlayer(),
          ]);
        }
      } else {
        console.error("[useGame] Failed to check game status:", result.error);
      }
    } catch (error) {
      console.error("[useGame] Error checking game status:", error);
    }
  }, [
    sessionId,
    getGameToken,
    fetchGameState,
    fetchPlayerMappings,
    fetchCurrentPlayer,
  ]);

  // Make a move (play turn) - now uses POST with game token
  const makeMove = useCallback(
    async (x, y, playerId) => {
      if (!sessionId) {
        throw new Error("Session ID required to make move");
      }

      if (!participantId) {
        throw new Error("Participant ID required to make move");
      }

      if (!getGameToken) {
        throw new Error("Game token function required to make move");
      }

      const gameToken = getGameToken();
      if (!gameToken) {
        throw new Error("No game token available to make move");
      }

      try {
        const KubicKode = window.KubicKode;
        const result = await KubicKode.route.game("play-turn", {
          xPos: x,
          yPos: y,
        });

        if (result.success) {
          KubicKode.game.updateGame({ lastMoveResult: result.data });

          // If move was successful, fetch updated game state
          if (result.data.status === "ok") {
            await fetchGameState();

            // If game is still active (no winner), fetch next player
            if (!result.data.player_has_won) {
              await fetchCurrentPlayer();
            } else {
              // Game ended, player won
              KubicKode.game.updateGame({ active: false });
            }
          }

          return { success: true, data: result.data };
        } else {
          console.error("[useGame] Failed to make move:", result.error);
          return { success: false, error: result.error };
        }
      } catch (error) {
        console.error("[useGame] Error making move:", error);
        return { success: false, error: error.message };
      }
    },
    [sessionId, participantId, fetchGameState, fetchCurrentPlayer, getGameToken]
  );

  // Refresh all game data
  const refreshGameData = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    const currentGameState = KubicKode.game.getState();

    // Only refresh game data if the game has started
    // We rely on WebSocket events (kubic::gameStarted) to know when game starts
    // No need to poll with checkGameStatus - WebSockets handle that
    if (currentGameState.started) {
      await Promise.all([
        fetchGameState(),
        fetchPlayerMappings(),
        fetchCurrentPlayer(), // Always fetch current player to ensure turn updates
      ]);
    }
  }, [sessionId, fetchGameState, fetchPlayerMappings, fetchCurrentPlayer]);

  // Reset game state when session changes
  useEffect(() => {
    if (sessionId) {
      console.log("[useGame] Resetting game state for new session:", sessionId);
      KubicKode.game.reset();
      setGameError(null);
      console.log("[useGame] Game state after reset:", KubicKode.game.getState());
    }
  }, [sessionId, KubicKode]);

  // Auto-check game status when entering game screen (sessionId + gameToken available)
  useEffect(() => {
    const checkInitialGameStatus = async () => {
      console.log("[useGame] checkInitialGameStatus triggered for session:", sessionId);
      console.log("[useGame] Has getGameToken function:", !!getGameToken);
      console.log("[useGame] Game token value:", getGameToken ? getGameToken() : "no function");

      if (sessionId && getGameToken && getGameToken()) {
        console.log("[useGame] Auto-checking game status for session:", sessionId);
        console.log("[useGame] Game state BEFORE checkGameStatus:", KubicKode.game.getState());
        await checkGameStatus();
      } else {
        console.log("[useGame] NOT checking game status - missing sessionId or gameToken");
      }
    };

    checkInitialGameStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Auto-fetch current player when game is active but no current player is set
  useEffect(() => {
    const currentGameState = KubicKode.game.getState();
    if (
      currentGameState.started &&
      currentGameState.active &&
      !currentGameState.currentPlayerId
    ) {
      setTimeout(async () => {
        await fetchCurrentPlayer();
      }, 1000);
    }
  }, [
    gameState.started,
    gameState.active,
    gameState.currentPlayerId,
    fetchCurrentPlayer,
  ]);

  const getTile = useCallback(
    (x, y) => {
      return KubicKode.game.getTile(x, y);
    },
    [KubicKode]
  );

  const getGridDimensions = useCallback(() => {
    return KubicKode.game.getGridDimensions();
  }, [KubicKode]);

  const setTileMapFromWebSocket = useCallback(
    (newTileMap) => {
      KubicKode.game.updateTilemap(newTileMap);
    },
    [KubicKode]
  );

  return {
    gameStarted: gameState.started || false,
    gameActive: gameState.active || false,
    tileMap: gameState.tilemap || null,
    currentPlayerId: gameState.currentPlayerId || null,
    playerMappings: gameState.playerMappings || {},
    lastMoveResult: gameState.lastMoveResult || null,

    isGameLoading,
    gameError,

    // Game actions
    startGame,
    makeMove,
    refreshGameData,
    fetchGameState,
    fetchCurrentPlayer,
    fetchPlayerMappings,
    checkGameStatus,
    setTileMapFromWebSocket,

    getTile,
    getGridDimensions,

    // Debug/utility functions
    forceRefreshCurrentPlayer: fetchCurrentPlayer,
  };
}

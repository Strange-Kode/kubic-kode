import { useState, useCallback, useEffect } from "react";
import { useFetch } from "./useFetch.js";

/**
 * Custom hook for game management
 * Handles game initialization, state fetching, move making, and game status tracking
 * All game routes use POST with game tokens for authentication
 */
export function useGame(sessionId, participantId, getGameToken) {
  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [gameActive, setGameActive] = useState(false);
  const [tileMap, setTileMap] = useState(null);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [isGameLoading, setIsGameLoading] = useState(false);
  const [gameError, setGameError] = useState(null);
  const [lastMoveResult, setLastMoveResult] = useState(null);

  // Fetch helper
  const { get, post } = useFetch();

  // Helper function to extract current player ID from response data
  const extractCurrentPlayerId = useCallback((data) => {
    // Handle both array format (current_player_ids) and single value format (current_player_id)
    if (data.current_player_id !== undefined) {
      return data.current_player_id;
    } else if (data.current_player_ids) {
      return data.current_player_ids.length > 0 ? data.current_player_ids[0] : null;
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
      console.warn('[useGame] No game token available for fetchGameState');
      return;
    }

    try {
      const result = await post(`/api/game/get-tilemap/${sessionId}`, {
        gameToken: gameToken
      });

      if (result.success) {
        // console.log("[useGame] Fetched game state:", result.data);
        setTileMap(result.data);
      } else {
        console.error("[useGame] Failed to fetch game state:", result.error);
        setGameError(result.error);
      }
    } catch (error) {
      console.error("[useGame] Error fetching game state:", error);
      setGameError(error.message);
    }
  }, [sessionId, post, getGameToken]);

  // Fetch current player - now uses POST with game token
  const fetchCurrentPlayer = useCallback(async () => {
    if (!sessionId || !gameStarted || !getGameToken) {
      return;
    }

    const gameToken = getGameToken();
    if (!gameToken) {
      console.warn('[useGame] No game token available for fetchCurrentPlayer');
      return;
    }

    try {
      const result = await post(`/api/game/get-current-player/${sessionId}`, {
        gameToken: gameToken
      });

      if (result.success) {
        // console.log("[useGame] Current players:", result.data.current_player_ids);
        const currentPlayerId = extractCurrentPlayerId(result.data);
        setCurrentPlayerId(currentPlayerId);
      } else {
        console.error(
          "[useGame] Failed to fetch current player:",
          result.error
        );
      }
    } catch (error) {
      console.error("[useGame] Error fetching current player:", error);
    }
  }, [sessionId, post, gameStarted, getGameToken, extractCurrentPlayerId]);

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

    // console.log("[useGame] Starting game for session:", sessionId);
    setIsGameLoading(true);
    setGameError(null);

    try {
      const result = await post(`/api/game/start/${sessionId}`, {
        participantId: participantId,
        gameToken: gameToken
      });

      if (result.success) {
        // console.log("[useGame] Game started successfully:", result.data);
        setGameStarted(true);
        setGameActive(true);
        const currentPlayerId = extractCurrentPlayerId(result.data);
        setCurrentPlayerId(currentPlayerId);

        // Fetch initial game state after starting
        await fetchGameState();

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
  }, [sessionId, participantId, post, fetchGameState, getGameToken, extractCurrentPlayerId]);

  // Check if game is active - now uses POST with game token
  const checkGameStatus = useCallback(async () => {
    if (!sessionId || !getGameToken) {
      return;
    }

    const gameToken = getGameToken();
    if (!gameToken) {
      console.warn('[useGame] No game token available for checkGameStatus');
      return;
    }

    try {
      const result = await post(`/api/game/is-active/${sessionId}`, {
        gameToken: gameToken
      });

      if (result.success) {
        // console.log("[useGame] Game active status:", result.data.is_active);
        setGameActive(result.data.is_active);
        if (result.data.is_active) {
          setGameStarted(true);
        }
      } else {
        console.error("[useGame] Failed to check game status:", result.error);
      }
    } catch (error) {
      console.error("[useGame] Error checking game status:", error);
    }
  }, [sessionId, post, getGameToken]);

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

      // console.log(
      //   `[useGame] Making move at (${x}, ${y}) for player ${playerId}`
      // );

      try {
        const result = await post(
          `/api/game/play-turn/${sessionId}`,
          {
            participantId: participantId,
            gameToken: gameToken,
            xPos: x,
            yPos: y,
          }
        );

        if (result.success) {
          // console.log("[useGame] Move result:", result.data);
          setLastMoveResult(result.data);

          // If move was successful, fetch updated game state
          if (result.data.status === "ok") {
            await fetchGameState();

            // If game is still active (no winner), fetch next player
            if (!result.data.player_has_won) {
              await fetchCurrentPlayer();
            } else {
              // Game ended, player won
              // console.log("[useGame] Game ended - player won!");
              setGameActive(false);
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
    [sessionId, participantId, post, fetchGameState, fetchCurrentPlayer, getGameToken]
  );

  // Refresh all game data
  const refreshGameData = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    // console.log("[useGame] Refreshing all game data");
    await Promise.all([
      checkGameStatus(),
      fetchGameState(),
      fetchCurrentPlayer(),
    ]);
  }, [sessionId, checkGameStatus, fetchGameState, fetchCurrentPlayer]);

  // Helper to get tile at position (for UI rendering only)
  const getTile = useCallback(
    (x, y) => {
      if (!tileMap || !tileMap.tiles) {
        return null;
      }

      // Simple array access - no validation (let backend handle bounds checking)
      return tileMap.tiles[y]?.[x] || null;
    },
    [tileMap]
  );

  // Helper to get game grid dimensions
  const getGridDimensions = useCallback(() => {
    if (!tileMap) {
      return { width: 0, height: 0 };
    }
    return { width: tileMap.width, height: tileMap.height };
  }, [tileMap]);

  return {
    // Game state
    gameStarted,
    gameActive,
    tileMap,
    currentPlayerId,
    isGameLoading,
    gameError,
    lastMoveResult,

    // Game actions
    startGame,
    makeMove,
    refreshGameData,
    fetchGameState,
    fetchCurrentPlayer,
    checkGameStatus,

    // Helper functions
    getTile,
    getGridDimensions,
  };
}

import { useState, useCallback, useEffect, useRef } from "react";
import { useFetch } from "./useFetch.js";

/**
 * Custom hook for game management
 * Handles game initialization, state fetching, move making, and game status tracking
 */
export function useGame(sessionId, participantId) {
  // Game state
  const [gameStarted, setGameStarted] = useState(false);
  const [gameActive, setGameActive] = useState(false);
  const [tileMap, setTileMap] = useState(null);
  const [currentPlayerId, setCurrentPlayerId] = useState(null);
  const [isGameLoading, setIsGameLoading] = useState(false);
  const [gameError, setGameError] = useState(null);
  const [lastMoveResult, setLastMoveResult] = useState(null);
  
  // Concurrency protection
  const refreshInProgressRef = useRef(false);

  // Fetch helper
  const { get, post } = useFetch();

  // Fetch current game state (tilemap)
  const fetchGameState = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    try {
      const result = await get(`/api/game/get-tilemap/${sessionId}`);

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
  }, [sessionId, get]);

  // Fetch current player
  const fetchCurrentPlayer = useCallback(async () => {
    if (!sessionId || !gameStarted) {
      return;
    }

    try {
      const result = await get(`/api/game/get-current-player/${sessionId}`);

      if (result.success) {
        // console.log("[useGame] Current player:", result.data.current_player_id);
        setCurrentPlayerId(result.data.current_player_id);
      } else {
        console.error(
          "[useGame] Failed to fetch current player:",
          result.error
        );
      }
    } catch (error) {
      console.error("[useGame] Error fetching current player:", error);
    }
  }, [sessionId, get, gameStarted]);

  // Start the game (called when session has 2 participants)
  const startGame = useCallback(async () => {
    if (!sessionId) {
      throw new Error("Session ID required to start game");
    }

    if (!participantId) {
      throw new Error("Participant ID required to start game");
    }

    // console.log("[useGame] Starting game for session:", sessionId);
    setIsGameLoading(true);
    setGameError(null);

    try {
      const result = await get(`/api/game/start/${sessionId}?participantId=${participantId}`);

      if (result.success) {
        // console.log("[useGame] Game started successfully:", result.data);
        setGameStarted(true);
        setGameActive(true);
        setCurrentPlayerId(result.data.current_player_id);

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
  }, [sessionId, participantId, get, fetchGameState]);

  // Check if game is active
  const checkGameStatus = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    try {
      const result = await get(`/api/game/is-active/${sessionId}`);

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
  }, [sessionId, get]);

  // Make a move (play turn)
  const makeMove = useCallback(
    async (x, y, playerId) => {
      if (!sessionId) {
        throw new Error("Session ID required to make move");
      }

      if (!participantId) {
        throw new Error("Participant ID required to make move");
      }

      // console.log(
      //   `[useGame] Making move at (${x}, ${y}) for player ${playerId}`
      // );

      try {
        const result = await post(
          `/api/game/play-turn/${sessionId}`,
          {
            participantId: participantId,
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
    [sessionId, participantId, post, fetchGameState, fetchCurrentPlayer]
  );

  // Refresh all game data
  const refreshGameData = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    // Prevent concurrent refresh calls
    if (refreshInProgressRef.current) {
      return;
    }

    refreshInProgressRef.current = true;
    setIsGameLoading(true);
    setGameError(null);

    try {
      await checkGameStatus();
      await fetchGameState();
      await fetchCurrentPlayer();
    } catch (error) {
      console.error("[useGame] Error refreshing game data:", error);
      setGameError(error.message);
    } finally {
      refreshInProgressRef.current = false;
      setIsGameLoading(false);
    }
  }, [sessionId, checkGameStatus, fetchGameState, fetchCurrentPlayer]);

  // Auto-check game status when sessionId changes
  useEffect(() => {
    if (sessionId) {
      checkGameStatus();
    }
  }, [sessionId]);

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

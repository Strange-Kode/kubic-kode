import { useState, useCallback } from "react";
import { useFetch } from "./useFetch.js";

/**
 * Hook for managing per-player win counts using GameHistory API
 * Fetches playerWon events and processes them into win counts per participant
 */
export function usePlayerWins(sessionId) {
  const [playerWinCounts, setPlayerWinCounts] = useState({});
  const { post, isLoading, error } = useFetch();

  const fetchPlayerWins = useCallback(async () => {
    if (!sessionId) return;

    const result = await post(`/api/session/${sessionId}/history`, {
      type: 'playerWon'
    });

    if (result.success && result.data) {
      console.log('[usePlayerWins] Raw GameHistory response:', result.data);
      
      // Process the history events to count wins per participant
      const winCounts = {};
      
      if (result.data.history && Array.isArray(result.data.history)) {
        console.log('[usePlayerWins] Processing', result.data.history.length, 'playerWon events');
        result.data.history.forEach((event, index) => {
          console.log(`[usePlayerWins] Event ${index}:`, event);
          if (event.participantId) {
            winCounts[event.participantId] = (winCounts[event.participantId] || 0) + 1;
          }
        });
      }

      console.log('[usePlayerWins] Final win counts:', winCounts);
      setPlayerWinCounts(winCounts);
    } else {
      console.error('[usePlayerWins] Failed to fetch player wins:', result.error);
    }
  }, [sessionId, post]);

  const getWinCountForPlayer = useCallback((participantId) => {
    return playerWinCounts[participantId] || 0;
  }, [playerWinCounts]);

  const getTotalGames = useCallback(() => {
    return Object.values(playerWinCounts).reduce((sum, count) => sum + count, 0);
  }, [playerWinCounts]);

  return {
    playerWinCounts,
    isLoading,
    error,
    fetchPlayerWins,
    getWinCountForPlayer,
    getTotalGames
  };
}
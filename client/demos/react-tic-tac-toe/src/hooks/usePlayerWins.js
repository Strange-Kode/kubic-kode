import { useState, useCallback, useEffect } from "react";
import "../../../../kubic-kode-helper.js";

export function usePlayerWins(sessionId) {
  const [winsState, setWinsState] = useState({});

  const KubicKode = window.KubicKode;

  useEffect(() => {
    if (!KubicKode) return;

    const handleWinsStateUpdate = (state) => {
      setWinsState(state);
    };

    KubicKode.events.on("winCountsUpdated", handleWinsStateUpdate);
    KubicKode.events.on("winsLoadingChanged", () => {
      setWinsState(KubicKode.wins.getState());
    });
    KubicKode.events.on("winsErrorChanged", () => {
      setWinsState(KubicKode.wins.getState());
    });

    // Initialize with current state
    setWinsState(KubicKode.wins.getState());

    return () => {
      KubicKode.events.off("winCountsUpdated", handleWinsStateUpdate);
    };
  }, [KubicKode]);

  // Delegate to KubicKode.wins for all win fetching logic
  const fetchPlayerWins = useCallback(async () => {
    if (!KubicKode) {
      console.error("[usePlayerWins] KubicKode helper not available");
      return { success: false, error: "KubicKode helper not available" };
    }

    // Sync session ID and delegate to helper
    KubicKode.sessionId = sessionId;
    return await KubicKode.wins.refreshWinCounts();
  }, [sessionId, KubicKode]);

  // Delegate helper methods to KubicKode.wins
  const getWinCountForPlayer = useCallback(
    (participantId) => {
      return KubicKode.wins.getWinCountForPlayer(participantId);
    },
    [KubicKode]
  );

  const getTotalGames = useCallback(() => {
    return KubicKode.wins.getTotalGames();
  }, [KubicKode]);

  return {
    // State from KubicKode.wins
    playerWinCounts: winsState.playerWinCounts || {},
    isLoading: winsState.isLoading || false,
    error: winsState.error || null,

    // Methods delegated to KubicKode.wins
    fetchPlayerWins,
    getWinCountForPlayer,
    getTotalGames,
  };
}

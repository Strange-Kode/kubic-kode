import { useState, useCallback, useEffect } from "react";
// Import from new modular structure
import "../../../../kubic-kode-helper/index.js";

export function usePlayerWins() {
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
    // State from KubicKode.wins (updated automatically via kubic::winCount WebSocket events)
    playerWinCounts: winsState.playerWinCounts || {},
    isLoading: winsState.isLoading || false,
    error: winsState.error || null,

    // Helper methods delegated to KubicKode.wins
    getWinCountForPlayer,
    getTotalGames,
  };
}

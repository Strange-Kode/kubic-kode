/**
 * Win tracking and statistics factory
 * Creates a wins state object bound to the helper instance
 */
export function createWinsState(helper) {
  return {
    // Win state
    playerWinCounts: {},
    totalGames: 0,
    isLoading: false,
    error: null,

    // Update win counts from backend
    updateWinCounts(winData) {
      this.playerWinCounts = winData.playerWinCounts || {};
      this.totalGames = winData.totalGames || 0;
      helper.events.emit("winCountsUpdated", this.getState());
    },

    // Set loading state
    setLoading(isLoading) {
      this.isLoading = isLoading;
      helper.events.emit("winsLoadingChanged", isLoading);
    },

    // Set error state
    setError(error) {
      this.error = error;
      helper.events.emit("winsErrorChanged", error);
    },

    // Helper methods
    getWinCountForPlayer(playerId) {
      return this.playerWinCounts[playerId] || 0;
    },

    getTotalGames() {
      return this.totalGames;
    },

    getWinPercentage(playerId) {
      if (this.totalGames === 0) return 0;
      const wins = this.getWinCountForPlayer(playerId);
      return Math.round((wins / this.totalGames) * 100);
    },

    // Refresh win counts from backend
    async refreshWinCounts() {
      if (!helper.sessionId) {
        return { success: false, error: "No session ID" };
      }

      this.setLoading(true);
      this.setError(null);

      try {
        const result = await helper.getGameHistory({ type: "playerWon" });

        if (result.success && result.data.history) {
          const winCounts = {};
          let totalGames = 0;

          result.data.history.forEach((event) => {
            if (event.type === "playerWon" && event.playerId) {
              winCounts[event.playerId] =
                (winCounts[event.playerId] || 0) + 1;
              totalGames++;
            }
          });

          this.updateWinCounts({
            playerWinCounts: winCounts,
            totalGames: totalGames,
          });
        } else {
          this.setError(result.error || "No history data");
        }

        return result;
      } catch (error) {
        this.setError(error.message);
        return { success: false, error: error.message };
      } finally {
        this.setLoading(false);
      }
    },

    // Get current win state
    getState() {
      return {
        playerWinCounts: { ...this.playerWinCounts },
        totalGames: this.totalGames,
        isLoading: this.isLoading,
        error: this.error,
      };
    },

    // Reset win state
    reset() {
      this.playerWinCounts = {};
      this.totalGames = 0;
      this.isLoading = false;
      this.error = null;
      helper.events.emit("winsReset");
    },
  };
}

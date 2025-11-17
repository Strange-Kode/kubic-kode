import { useState, useCallback } from "react";
import "../../../../kubic-kode-helper/index.js";

/**
 * Custom hook for session discovery and joining using KubicKodeHelper
 * Handles browsing existing sessions, auto-joining, and direct session joining
 */
export function useSessionBrowser() {
  // State
  const [availableSessions, setAvailableSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get KubicKode helper singleton
  const KubicKode = window.KubicKode;

  // Fetch all joinable sessions (filters AI games, started, full)
  const fetchJoinableSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await KubicKode.listJoinableSessions();

      if (result.success) {
        setAvailableSessions(result.data.sessions || []);
        return {
          success: true,
          sessions: result.data.sessions || [],
          total: result.data.total_sessions || 0,
        };
      } else {
        throw new Error(result.error || "Failed to fetch sessions");
      }
    } catch (err) {
      console.error("[useSessionBrowser] Failed to fetch all sessions:", err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [KubicKode]);

  // Fetch sessions by game type
  const fetchSessionsByGame = useCallback(
    async (gameVariantId, onlyJoinable = true) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await KubicKode.listSessionsByGame(
          gameVariantId,
          onlyJoinable
        );

        if (result.success) {
          const newSessions = result.data.sessions || [];

          setAvailableSessions((prevSessions) => {
            if (sessionsAreEqual(prevSessions, newSessions)) {
              return prevSessions;
            }
            return newSessions;
          });

          return {
            success: true,
            sessions: newSessions,
            total: result.data.total_sessions || 0,
            gameVariantId: result.data.game_variant_id,
            onlyJoinable: result.data.only_joinable,
          };
        } else {
          throw new Error(result.error || "Failed to fetch sessions by game");
        }
      } catch (err) {
        console.error(
          `[useSessionBrowser] Failed to fetch sessions for game ${gameVariantId}:`,
          err
        );
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setIsLoading(false);
      }
    },
    [KubicKode]
  );

  const sessionsAreEqual = (prevSessions, newSessions) => {
    if (prevSessions.length !== newSessions.length) return false;

    const prevMap = new Map(prevSessions.map((s) => [s.sessionId, s]));

    for (const newSession of newSessions) {
      const prevSession = prevMap.get(newSession.sessionId);
      if (!prevSession) return false;

      if (
        prevSession.participantCount.players !==
          newSession.participantCount.players ||
        prevSession.participantCount.spectators !==
          newSession.participantCount.spectators ||
        prevSession.started !== newSession.started ||
        prevSession.needsMorePlayers !== newSession.needsMorePlayers ||
        prevSession.inSyncPhase !== newSession.inSyncPhase ||
        prevSession.host?.name !== newSession.host?.name
      ) {
        return false;
      }
    }

    return true;
  };

  // Join a specific session by session ID
  const joinSpecificSession = useCallback(
    async (sessionId, participantName, participantType = "user") => {
      if (!sessionId || !participantName?.trim()) {
        const error = "Session ID and participant name are required";
        setError(error);
        return { success: false, error };
      }

      setIsLoading(true);
      setError(null);

      try {
        // Set the sessionId in KubicKode before joining
        KubicKode.sessionId = sessionId;

        let result;
        if (participantType === "spectator") {
          result = await KubicKode.spectateSession(participantName.trim());
        } else {
          result = await KubicKode.joinSession(
            participantName.trim(),
            participantType
          );
        }

        if (result.success) {
          return {
            success: true,
            sessionId,
            participantId: result.data.participant_id,
            participantType,
          };
        } else {
          throw new Error(result.error || "Failed to join session");
        }
      } catch (err) {
        console.error(
          `[useSessionBrowser] Failed to join session ${sessionId}:`,
          err
        );
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setIsLoading(false);
      }
    },
    [KubicKode]
  );

  // Auto-join the best available session for a game type
  const autoJoinSession = useCallback(
    async (
      gameVariantId,
      participantName,
      participantType = "user",
      createIfNone = true
    ) => {
      if (!gameVariantId || !participantName?.trim()) {
        const error = "Game variant ID and participant name are required";
        setError(error);
        return { success: false, error };
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await KubicKode.autoJoinSession(
          gameVariantId,
          participantName.trim(),
          participantType,
          createIfNone
        );

        if (result.success) {
          return {
            success: true,
            sessionId: result.data.session_id,
            participantId: result.data.participant_id,
            sessionCreated: result.data.session_created,
            lobbyStatus: result.data.lobby_status,
          };
        } else {
          throw new Error(result.error || "Failed to auto-join session");
        }
      } catch (err) {
        console.error(
          `[useSessionBrowser] Failed to auto-join ${gameVariantId}:`,
          err
        );
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setIsLoading(false);
      }
    },
    [KubicKode]
  );

  // Get detailed lobby status for a specific session
  const getSessionLobbyStatus = useCallback(
    async (sessionId) => {
      if (!sessionId) {
        const error = "Session ID is required";
        setError(error);
        return { success: false, error };
      }

      try {
        const result = await KubicKode.getSessionLobbyStatus(sessionId);

        if (result.success) {
          return {
            success: true,
            lobby: result.data.lobby,
          };
        } else {
          throw new Error(result.error || "Failed to get lobby status");
        }
      } catch (err) {
        console.error(
          `[useSessionBrowser] Failed to get lobby status for ${sessionId}:`,
          err
        );
        setError(err.message);
        return { success: false, error: err.message };
      }
    },
    [KubicKode]
  );

  // Clear current error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Clear available sessions
  const clearSessions = useCallback(() => {
    setAvailableSessions([]);
  }, []);

  return {
    // State
    availableSessions,
    isLoading,
    error,

    // Actions
    fetchJoinableSessions,
    fetchSessionsByGame,
    joinSpecificSession,
    autoJoinSession,
    getSessionLobbyStatus,

    // Utilities
    clearError,
    clearSessions,
  };
}

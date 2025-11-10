import { useState, useCallback } from "react";
import { useFetch } from "./useFetch";

/**
 * Custom hook for session discovery and joining
 * Handles browsing existing sessions, auto-joining, and direct session joining
 */
export function useSessionBrowser() {
  // State
  const [availableSessions, setAvailableSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch helper
  const { get, post } = useFetch();

  // Fetch all available sessions
  const fetchAllSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await get("/api/sessions/list");

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
  }, [get]);

  // Fetch sessions by game type
  const fetchSessionsByGame = useCallback(
    async (gameVariantId, onlyJoinable = true) => {
      setIsLoading(true);
      setError(null);

      try {
        const queryParams = onlyJoinable ? "?onlyJoinable=true" : "";
        const result = await get(
          `/api/sessions/game/${gameVariantId}${queryParams}`
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
    [get]
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

  // Game token management helpers
  const storeGameToken = useCallback((sessionId, participantId, gameToken) => {
    try {
      const tokens = getAllGameTokens();
      tokens[sessionId] = tokens[sessionId] || {};
      tokens[sessionId][participantId] = gameToken;
      localStorage.setItem("kubic_game_tokens", JSON.stringify(tokens));
    } catch (error) {
      console.error("[useSessionBrowser] Error storing game token:", error);
    }
  }, []);

  const getAllGameTokens = useCallback(() => {
    try {
      const stored = localStorage.getItem("kubic_game_tokens");
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error(
        "[useSessionBrowser] Error getting all game tokens:",
        error
      );
      return {};
    }
  }, []);

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
        const endpoint =
          participantType === "spectator"
            ? `/api/session/${sessionId}/spectate`
            : `/api/session/${sessionId}/join`;

        const result = await post(endpoint, {
          participantName: participantName.trim(),
          ...(participantType !== "spectator" && { participantType }),
        });

        if (result.success) {
          const participantId = result.data.participant_id;

          // Store the game token if it's provided
          if (result.data.game_token) {
            storeGameToken(sessionId, participantId, result.data.game_token);
          }

          return {
            success: true,
            sessionId,
            participantId,
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
    [post, storeGameToken]
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
        const result = await post(`/api/sessions/auto-join/${gameVariantId}`, {
          participantName: participantName.trim(),
          participantType,
          createIfNone,
        });

        if (result.success) {
          const sessionId = result.data.session_id;
          const participantId = result.data.participant_id;

          // Store the game token if it's provided
          if (result.data.game_token) {
            storeGameToken(sessionId, participantId, result.data.game_token);
          }

          return {
            success: true,
            sessionId,
            participantId,
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
    [post, storeGameToken]
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
        const result = await get(`/api/session/lobby/${sessionId}`);

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
    [get]
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
    fetchAllSessions,
    fetchSessionsByGame,
    joinSpecificSession,
    autoJoinSession,
    getSessionLobbyStatus,

    // Utilities
    clearError,
    clearSessions,
  };
}

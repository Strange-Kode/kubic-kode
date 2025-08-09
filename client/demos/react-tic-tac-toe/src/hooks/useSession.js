import { useState, useEffect, useCallback } from "react";
import { useFetch } from "./useFetch";

/**
 * Custom hook for session management
 * Handles session initialization, participant joining, and participant fetching
 */
export function useSession() {
  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [maxParticipants, setMaxParticipants] = useState(2); // default fallback
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState(null);

  // Fetch helper
  const { get, post } = useFetch();

  // No automatic initialization - session must be explicitly created

  // Initialize session with backend
  const initializeSession = useCallback(async (forceNew = false) => {
    // console.log("[useSession] Initializing session...");
    setIsSessionLoading(true);
    setSessionError(null);

    try {
      const result = forceNew 
        ? await post("/api/session/init/tic-tac-toe-classic", { forceNew: true })
        : await get("/api/session/init/tic-tac-toe-classic");

      if (result.success) {
        const newSessionId = result.data.session_id;
        setSessionId(newSessionId);
        // console.log(
        //   `[useSession] Session initialized: session_id=${newSessionId}`
        // );
        return { success: true, sessionId: newSessionId };
      } else {
        throw new Error(result.error || "Failed to initialize session");
      }
    } catch (error) {
      console.error("[useSession] Failed to initialize session:", error);
      setSessionError(error.message);
      return { success: false, error: error.message };
    } finally {
      setIsSessionLoading(false);
    }
  }, [get]);

  // Join session with participant name
  const joinSession = useCallback(
    async (name, participantType = "user", targetSessionId = null) => {
      const activeSessionId = targetSessionId || sessionId;
      
      if (!activeSessionId) {
        throw new Error("Session not initialized");
      }

      // console.log(`[useSession] Joining session with name: ${name}`);

      try {
        const result = await post(`/api/session/${activeSessionId}/join`, {
          participantName: name,
          participantType: participantType,
        });

        if (result.success) {
          const newParticipantId = result.data.participant_id;
          setParticipantId(newParticipantId);
          
          // If we joined a different session, update our session state
          if (targetSessionId && targetSessionId !== sessionId) {
            setSessionId(targetSessionId);
          }
          
          // console.log(
          //   `[useSession] Joined session: participant_id=${newParticipantId}`
          // );

          // Fetch updated participants list
          await fetchParticipants();

          return { success: true, participantId: newParticipantId };
        } else {
          throw new Error(result.error || "Failed to join session");
        }
      } catch (error) {
        console.error("[useSession] Failed to join session:", error);
        return { success: false, error: error.message };
      }
    },
    [sessionId, post]
  );

  // Add AI participant to session
  const addAIParticipant = useCallback(async () => {
    if (!sessionId) {
      throw new Error("Session not initialized");
    }

    try {
      const result = await post(`/api/session/${sessionId}/join`, {
        participantName: "AI Opponent",
        participantType: "computer",
      });

      if (result.success) {
        // Fetch updated participants list
        await fetchParticipants();
        return { success: true };
      } else {
        throw new Error(result.error || "Failed to add AI opponent");
      }
    } catch (error) {
      console.error("[useSession] Failed to add AI opponent:", error);
      return { success: false, error: error.message };
    }
  }, [sessionId, post]);

  // Join session as spectator (uses dedicated /spectate endpoint)
  const joinAsSpectator = useCallback(
    async (name) => {
      if (!sessionId) {
        throw new Error("Session not initialized");
      }

      try {
        const result = await post(`/api/session/${sessionId}/spectate`, {
          participantName: name,
        });

        if (result.success) {
          const newParticipantId = result.data.participant_id;
          setParticipantId(newParticipantId);

          // Fetch updated participants list
          await fetchParticipants();

          return { success: true, participantId: newParticipantId };
        } else {
          throw new Error(result.error || "Failed to join as spectator");
        }
      } catch (error) {
        console.error("[useSession] Failed to join as spectator:", error);
        return { success: false, error: error.message };
      }
    },
    [sessionId, post]
  );

  // Fetch session stats including participants and maxParticipants
  const fetchSessionStats = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    try {
      const result = await get(`/api/session/participants/stats/${sessionId}`);
      console.log("[useSession] Session stats result:", result);

      if (result.success) {
        const { maxParticipants: maxParts } = result.data;
        console.log("[useSession] Setting maxParticipants to:", maxParts);
        setMaxParticipants(maxParts);
      } else {
        console.error(
          "[useSession] Failed to fetch session stats:",
          result.error
        );
      }
    } catch (error) {
      console.error("[useSession] Error fetching session stats:", error);
    }
  }, [sessionId, get]);

  // Fetch participants for the current session
  const fetchParticipants = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    try {
      const result = await get(`/api/session/${sessionId}/participants`);

      if (result.success) {
        const participantsList = result.data;
        setParticipants(participantsList);
        // console.log(
        //   `[useSession] Participants updated: total=${participantsList.length}`,
        //   participantsList
        // );
      } else {
        console.error(
          "[useSession] Failed to fetch participants:",
          result.error
        );
      }
    } catch (error) {
      console.error("[useSession] Error fetching participants:", error);
    }
  }, [sessionId, get]);

  // Check if session is available for joining
  const checkSessionAvailability = useCallback(async () => {
    if (!sessionId) {
      return { available: false, reason: "No session initialized" };
    }

    try {
      const result = await get(`/api/session/participants/stats/${sessionId}`);

      if (result.success) {
        const { players, maxParticipants: maxParts, started } = result.data;
        const isFull = players >= maxParts;

        return {
          available: !isFull && !started,
          reason: started
            ? "Game already started"
            : isFull
            ? "Session is full"
            : "Available",
          participantCount: players,
          maxParticipants: maxParts,
          started,
        };
      } else {
        return { available: false, reason: "Session not found" };
      }
    } catch (error) {
      return { available: false, reason: error.message };
    }
  }, [sessionId, get]);

  // Always fetch participants and session stats when sessionId changes (even before joining)
  useEffect(() => {
    if (sessionId) {
      fetchParticipants();
      fetchSessionStats();
    }
  }, [sessionId, fetchParticipants, fetchSessionStats]);

  // Auto-fetch participants when sessionId or participantId changes
  useEffect(() => {
    if (sessionId && participantId) {
      fetchParticipants();
    }
  }, [sessionId, participantId, fetchParticipants]);

  // Determine if current user is host (first participant)
  const isHost =
    participants.length > 0 && participants[0]?.id === participantId;

  // Direct state sync function for session browser integration
  const syncSessionState = useCallback(async (newSessionId, newParticipantId) => {
    console.log("[useSession] Syncing state from external join:", {
      newSessionId,
      newParticipantId
    });
    
    if (newSessionId) setSessionId(newSessionId);
    if (newParticipantId) setParticipantId(newParticipantId);
    
    // Trigger a data refresh after state sync
    await fetchParticipants();
  }, [fetchParticipants]);

  // Leave current session
  const leaveSession = useCallback(async () => {
    if (!sessionId || !participantId) {
      return { success: false, error: "No active session to leave" };
    }

    console.log("[useSession] Leaving session:", { sessionId, participantId });

    try {
      const result = await post(`/api/session/${sessionId}/leave`, {
        participantId
      });

      if (result.success) {
        // Clear session state
        setSessionId(null);
        setParticipantId(null);
        setParticipants([]);
        console.log("[useSession] Successfully left session");
        return { success: true };
      } else {
        throw new Error(result.error || "Failed to leave session");
      }
    } catch (error) {
      console.error("[useSession] Error leaving session:", error);
      return { success: false, error: error.message };
    }
  }, [sessionId, participantId, post]);

  return {
    // Session state
    sessionId,
    participantId,
    participants,
    maxParticipants,
    isSessionLoading,
    sessionError,
    isHost,

    // Session actions
    initializeSession,
    joinSession,
    joinAsSpectator,
    addAIParticipant,
    fetchParticipants,
    checkSessionAvailability,
    syncSessionState,
    leaveSession,
  };
}

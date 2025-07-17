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
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  // Fetch helper
  const { get, post } = useFetch();

  // Initialize session on mount
  useEffect(() => {
    initializeSession();
  }, []);

  // Initialize session with backend
  const initializeSession = useCallback(async () => {
    // console.log("[useSession] Initializing session...");
    setIsSessionLoading(true);
    setSessionError(null);

    try {
      const result = await get("/api/session/init/tic-tac-toe-classic");

      if (result.success) {
        const newSessionId = result.data.session_id;
        setSessionId(newSessionId);
        // console.log(
        //   `[useSession] Session initialized: session_id=${newSessionId}`
        // );
      } else {
        throw new Error(result.error || "Failed to initialize session");
      }
    } catch (error) {
      console.error("[useSession] Failed to initialize session:", error);
      setSessionError(error.message);
    } finally {
      setIsSessionLoading(false);
    }
  }, [get]);

  // Join session with participant name
  const joinSession = useCallback(
    async (name) => {
      if (!sessionId) {
        throw new Error("Session not initialized");
      }

      // console.log(`[useSession] Joining session with name: ${name}`);

      try {
        const result = await post(`/api/session/${sessionId}/join`, {
          participantName: name,
        });

        if (result.success) {
          const newParticipantId = result.data.participant_id;
          setParticipantId(newParticipantId);
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
      const result = await get(`/api/session/${sessionId}/participants`);

      if (result.success) {
        const participantsList = result.data;
        const isFull = participantsList.length >= 2;

        return {
          available: !isFull,
          reason: isFull ? "Session is full" : "Available",
          participantCount: participantsList.length,
        };
      } else {
        return { available: false, reason: "Session not found" };
      }
    } catch (error) {
      return { available: false, reason: error.message };
    }
  }, [sessionId, get]);

  // Always fetch participants when sessionId changes (even before joining)
  useEffect(() => {
    if (sessionId) {
      fetchParticipants();
    }
  }, [sessionId, fetchParticipants]);

  // Auto-fetch participants when sessionId or participantId changes
  useEffect(() => {
    if (sessionId && participantId) {
      fetchParticipants();
    }
  }, [sessionId, participantId, fetchParticipants]);

  // Determine if current user is host (first participant)
  const isHost =
    participants.length > 0 && participants[0]?.id === participantId;

  return {
    // Session state
    sessionId,
    participantId,
    participants,
    isSessionLoading,
    sessionError,
    isHost,

    // Session actions
    initializeSession,
    joinSession,
    fetchParticipants,
    checkSessionAvailability,
  };
}

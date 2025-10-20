import { useState, useEffect, useCallback } from "react";
import "../../../../kubic-kode-helper.js";

export function useSession() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [sessionState, setSessionState] = useState({});

  const KubicKode = window.KubicKode;

  useEffect(() => {
    if (!KubicKode) return;

    const handleSessionStateUpdate = (state) => {
      setSessionState(state);
    };

    const handleParticipantsUpdated = () => {
      const newState = KubicKode.session.getState();
      setSessionState(newState);
    };

    const handleSessionReset = () => {
      const newState = KubicKode.session.getState();
      setSessionState(newState);
    };

    KubicKode.events.on("sessionStateUpdated", handleSessionStateUpdate);
    KubicKode.events.on("participantsUpdated", handleParticipantsUpdated);
    KubicKode.events.on("sessionReset", handleSessionReset);

    const initialState = KubicKode.session.getState();
    setSessionState(initialState);

    return () => {
      KubicKode.events.off("sessionStateUpdated", handleSessionStateUpdate);
      KubicKode.events.off("participantsUpdated", handleParticipantsUpdated);
      KubicKode.events.off("sessionReset", handleSessionReset);
    };
  }, [KubicKode]);

  return {
    sessionId: sessionState.id,
    participantId: sessionState.participantId,
    participants: sessionState.participants || [],
    maxPlayers: sessionState.maxPlayers,
    isSessionLoading: sessionState.isSessionLoading || isInitializing,
    sessionError: sessionState.sessionError,
    isHost: sessionState.isHost,

    initializeSession: async (gameType, forceNew) => {
      setIsInitializing(true);
      try {
        const result = await KubicKode.initializeSession(gameType, forceNew);
        if (result.success) {
          KubicKode.session.updateSession({
            sessionId: result.data.session_id,
          });
          // Fetch session stats to get maxPlayers and other session info
          const statsResult = await KubicKode.getSessionStats();
          if (statsResult.success) {
            KubicKode.session.updateSession({
              maxPlayers: statsResult.data.maxPlayers,
            });
          }
        }
        return result;
      } finally {
        setIsInitializing(false);
      }
    },

    joinSession: async (playerName, type) => {
      const result = await KubicKode.joinSession(playerName, type);
      if (result.success) {
        KubicKode.session.updateSession({
          participantId: result.data.participant_id,
        });

        const participantsResult = await KubicKode.getParticipants();
        if (participantsResult.success) {
          // The API returns participants as the data array directly, not nested
          const participants = Array.isArray(participantsResult.data)
            ? participantsResult.data
            : participantsResult.data.participants;
          KubicKode.session.updateParticipants(participants);

          // Check if current participant is host (first participant is typically host)
          const currentParticipant = participants.find(
            (p) => p.id === result.data.participant_id
          );
          if (currentParticipant) {
            const isHost =
              currentParticipant.is_host ||
              participants[0]?.id === result.data.participant_id;
            KubicKode.session.updateSession({ isHost });
          }

          // maxPlayers might be in the result or need to be fetched separately
          if (participantsResult.data.maxPlayers) {
            KubicKode.session.updateSession({
              maxPlayers: participantsResult.data.maxPlayers,
            });
          }
        }
      }
      return result;
    },

    joinAsSpectator: async (playerName) => {
      const result = await KubicKode.joinAsSpectator(playerName);
      if (result.success) {
        KubicKode.session.updateSession({
          participantId: result.data.participant_id,
        });
        const participantsResult = await KubicKode.getParticipants();
        if (participantsResult.success) {
          const participants = Array.isArray(participantsResult.data)
            ? participantsResult.data
            : participantsResult.data.participants;
          KubicKode.session.updateParticipants(participants);
          if (participantsResult.data.maxPlayers) {
            KubicKode.session.updateSession({
              maxPlayers: participantsResult.data.maxPlayers,
            });
          }
        }
      }
      return result;
    },

    addAIParticipant: async (aiName) => {
      const result = await KubicKode.addAIParticipant(aiName);
      if (result.success) {
        const participantsResult = await KubicKode.getParticipants();
        if (participantsResult.success) {
          const participants = Array.isArray(participantsResult.data)
            ? participantsResult.data
            : participantsResult.data.participants;
          KubicKode.session.updateParticipants(participants);
          if (participantsResult.data.maxPlayers) {
            KubicKode.session.updateSession({
              maxPlayers: participantsResult.data.maxPlayers,
            });
          }
        }
      }
      return result;
    },

    leaveSession: async () => {
      const result = await KubicKode.leaveSession();
      if (result.success) {
        KubicKode.session.reset();
      }
      return result;
    },

    fetchParticipants: async () => {
      const result = await KubicKode.getParticipants();
      if (result.success) {
        const participants = Array.isArray(result.data)
          ? result.data
          : result.data.participants;
        KubicKode.session.updateParticipants(participants);
        if (result.data.maxPlayers) {
          KubicKode.session.updateSession({
            maxPlayers: result.data.maxPlayers,
          });
        }
      }
      return result;
    },

    checkSessionAvailability: (sessionId) =>
      KubicKode.checkSessionAvailability(sessionId),
    syncSessionState: (newSessionId, newParticipantId) =>
      KubicKode.syncSessionState(newSessionId, newParticipantId),

    getGameToken: () => KubicKode.gameToken,
    storeGameToken: (token) => {
      KubicKode.gameToken = token;
    },
    clearGameToken: () => {
      KubicKode.gameToken = null;
    },
  };
}

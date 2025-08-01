import express from "express";
import { sessionManager } from "../session-manager.js"; // Holds all active GameSession instances
import { GameEventService } from "../game-event-service.js";
import { GameHistory } from "../game-history.js"; // GameHistory contains getValidEventTypes used for subscription validation

import { serializeRecursively } from "../../game-utility/game-utility.js";

const sessionRouter = express.Router();

// Init session, GET fallback (no turnConfig)
sessionRouter.get("/session/init/:gameId", (req, res) => {
  const { gameId } = req.params;
  let sessionState, session_created;
  if (sessionManager.hasSessions()) {
    sessionState = sessionManager.getSessions()[0];
    session_created = false;
  } else {
    sessionState = sessionManager.createSession(gameId);
    session_created = true;
  }
  console.log(`session-routes.js::session created: ${session_created}`);
  console.log(`session-routes.js::session id: ${sessionState.sessionId}`);
  res.json({
    session_id: sessionState.sessionId,
    session_created: session_created,
  });
});

// Init session, POST: allows passing options (but NOT turnConfig)
sessionRouter.post("/session/init/:gameId", (req, res) => {
  const { gameId } = req.params;
  const { forceNew, ...otherOptions } = req.body || {};
  let sessionState, session_created;
  
  // Check if we should force new session creation or reuse existing
  if (!forceNew && sessionManager.hasSessions()) {
    sessionState = sessionManager.getSessions()[0];
    session_created = false;
  } else {
    sessionState = sessionManager.createSession(gameId, { ...otherOptions });
    session_created = true;
  }
  console.log(`session-routes.js::session created: ${session_created}`);
  console.log(`session-routes.js::session id: ${sessionState.sessionId}`);
  res.json({
    session_id: sessionState.sessionId,
    session_created: session_created,
  });
});

// Join session
sessionRouter.post("/session/:sessionId/join", (req, res) => {
  const { sessionId } = req.params;
  const { participantName, participantType = "user" } = req.body;

  const gameSession = sessionManager.getSession(sessionId);

  if (!gameSession) {
    return res.status(404).json({ error: "Game session not found." });
  }

  try {
    let participantId = gameSession.addParticipant(
      participantName,
      participantType
    );
    let participant = gameSession.getParticipantById(participantId);

    res.json({ success: true, participant_id: participantId });

    // Broadcast the event after sending the response to avoid blocking the request
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "sessionParticipantJoined",
        payload: { participant: serializeRecursively(participant) },
      });
    } catch (broadcastError) {
      console.error("Broadcast error (non-blocking):", broadcastError);
      // Don't throw here - the join was successful, just the broadcast failed
    }
  } catch (err) {
    console.error("Join session error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Join session as spectator
sessionRouter.post("/session/:sessionId/spectate", (req, res) => {
  const { sessionId } = req.params;
  const { participantName } = req.body;

  const gameSession = sessionManager.getSession(sessionId);

  if (!gameSession) {
    return res.status(404).json({ error: "Game session not found." });
  }

  try {
    let participantId = gameSession.addParticipant(
      participantName,
      "spectator"
    );
    let participant = gameSession.getParticipantById(participantId);

    res.json({ success: true, participant_id: participantId });

    // Broadcast the event after sending the response to avoid blocking the request
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "sessionSpectatorJoined",
        payload: { participant: serializeRecursively(participant) },
      });
    } catch (broadcastError) {
      console.error("Broadcast error (non-blocking):", broadcastError);
      // Don't throw here - the join was successful, just the broadcast failed
    }
  } catch (err) {
    console.error("Join session as spectator error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Leave session
sessionRouter.post("/session/:sessionId/leave", (req, res) => {
  const { sessionId } = req.params;
  const { participantId } = req.body;

  // TODO: Validate that current user that's calling leave is authorized to do so.

  const gameSession = sessionManager.getSession(sessionId);

  if (!gameSession) {
    return res.status(404).json({ error: "Session not found." });
  }

  try {
    let participant = gameSession.getParticipantById(participantId);
    gameSession.removeParticipant(participantId);
    res.json({ success: true });

    // Broadcast the event after sending the response to avoid blocking the request
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "sessionParticipantLeft",
        payload: { participant: serializeRecursively(participant) },
      });
    } catch (broadcastError) {
      console.error("Broadcast error (non-blocking):", broadcastError);
      // Don't throw here - the leave was successful, just the broadcast failed
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// @deprecated, use next route instead
sessionRouter.get("/session/:sessionId/participants", (req, res) => {
  console.warn(
    "session-routes.js::get /session/:sessionId/participants is deprecated, use /session/participants/list/:sessionId instead"
  );
  const { sessionId } = req.params;

  const session = sessionManager.getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found." });
  }

  res.json(session.listParticipants());
});

// List participants
sessionRouter.get("/session/participants/list/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  const session = sessionManager.getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found." });
  }

  res.json(session.listParticipants());
});

// Get participant statistics
sessionRouter.get("/session/participants/stats/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  const gameSession = sessionManager.getSession(sessionId);

  if (!gameSession) {
    return res.status(404).json({ error: "Session not found." });
  }

  const allParticipants = gameSession.listParticipants();
  const playableParticipants = gameSession.getPlayableParticipants();
  const spectatorParticipants = gameSession.getSpectatorParticipants();

  res.json({
    sessionId: gameSession.sessionId,
    maxParticipants: gameSession.maxParticipants,
    total: allParticipants.length,
    players: playableParticipants.length,
    spectators: spectatorParticipants.length,
    canStart: playableParticipants.length >= gameSession.maxParticipants,
    started: gameSession.started,
  });
});

sessionRouter.get("/session/request-restart-vote/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);

  gameSession.startRestartVote();

  res.json({ vote_inited: true });

  // Broadcast the event after sending the response to avoid blocking the request
  try {
    GameEventService.broadcastToSession(gameSession, {
      type: "restartVoteStarted",
      payload: {
        participants: gameSession.getParticipants().map((p) => p.id),
      },
    });
  } catch (broadcastError) {
    console.error("Broadcast error (non-blocking):", broadcastError);
    // Don't throw here - the vote was started successfully, just the broadcast failed
  }
});

sessionRouter.post("/session/submit-restart-vote/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const { participantId, voteYes } = req.body;

  const gameSession = sessionManager.getSession(sessionId);

  try {
    gameSession.registerRestartVote(participantId, voteYes === true);

    res.json({ success: true });

    // Broadcast the event after sending the response to avoid blocking the request
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "restartVoteUpdate",
        payload: {
          participantId,
          vote: voteYes === true,
        },
      });

      if (gameSession.isRestartVoteComplete()) {
        const allAgreed = gameSession.getRestartVoteResult();

        GameEventService.broadcastToSession(gameSession, {
          type: "restartVoteResult",
          payload: {
            allAgreed,
            votes: gameSession.restartVote.votes,
          },
        });

        gameSession.clearRestartVote();
      }
    } catch (broadcastError) {
      console.error("Broadcast error (non-blocking):", broadcastError);
      // Don't throw here - the vote was registered successfully, just the broadcast failed
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get session game history with optional filters
sessionRouter.post("/session/history/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const filters = req.body || {};

  const gameSession = sessionManager.getSession(sessionId);

  if (!gameSession) {
    return res.status(404).json({ error: "Session not found." });
  }

  try {
    // Convert string dates to Date objects if provided
    const processedFilters = { ...filters };
    if (filters.startTime && typeof filters.startTime === "string") {
      processedFilters.startTime = new Date(filters.startTime);
    }
    if (filters.endTime && typeof filters.endTime === "string") {
      processedFilters.endTime = new Date(filters.endTime);
    }

    // Get filtered game history
    const history = gameSession.getGameHistory().getByFilters(processedFilters);

    res.json({
      success: true,
      sessionId: sessionId,
      totalEvents: history.length,
      history: history,
    });
  } catch (err) {
    console.error("Get session history error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Subscribe to game history event types
sessionRouter.post("/session/subscribe/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const { eventTypes } = req.body;

  const gameSession = sessionManager.getSession(sessionId);

  if (!gameSession) {
    return res.status(404).json({ error: "Session not found." });
  }

  if (!eventTypes || !Array.isArray(eventTypes) || eventTypes.length === 0) {
    return res.status(400).json({
      error:
        "eventTypes must be a non-empty array of game history event type strings.",
    });
  }

  try {
    // Validate that all requested event types are game history events
    const validGameHistoryEventTypes = GameHistory.getValidEventTypes();

    const invalidTypes = eventTypes.filter(
      (type) => !validGameHistoryEventTypes.includes(type)
    );
    if (invalidTypes.length > 0) {
      return res.status(400).json({
        error: `Cannot subscribe to non-game-history events: ${invalidTypes.join(
          ", "
        )}. Only game history events can be subscribed to.`,
        validGameHistoryEventTypes: validGameHistoryEventTypes,
      });
    }

    gameSession.subscribeToGameHistoryEvents(eventTypes);

    res.json({
      success: true,
      sessionId: sessionId,
      subscribedEventTypes: eventTypes,
      message: `Successfully subscribed to game history event types: ${eventTypes.join(
        ", "
      )}`,
    });
  } catch (err) {
    console.error("Subscribe to event types error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Unsubscribe from game history event types
sessionRouter.post("/session/unsubscribe/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const { eventTypes } = req.body;

  const gameSession = sessionManager.getSession(sessionId);

  if (!gameSession) {
    return res.status(404).json({ error: "Session not found." });
  }

  if (!eventTypes || !Array.isArray(eventTypes)) {
    return res.status(400).json({
      error: "eventTypes must be an array of game history event type strings.",
    });
  }

  try {
    // Validate that all requested event types are game history events
    const validGameHistoryEventTypes = GameHistory.getValidEventTypes();

    const invalidTypes = eventTypes.filter(
      (type) => !validGameHistoryEventTypes.includes(type)
    );
    if (invalidTypes.length > 0) {
      return res.status(400).json({
        error: `Cannot unsubscribe from non-game-history events: ${invalidTypes.join(
          ", "
        )}. Only game history events can be unsubscribed from.`,
        validGameHistoryEventTypes: validGameHistoryEventTypes,
      });
    }

    gameSession.unsubscribeFromGameHistoryEvents(eventTypes);

    res.json({
      success: true,
      sessionId: sessionId,
      unsubscribedEventTypes: eventTypes,
      message: `Successfully unsubscribed from game history event types: ${eventTypes.join(
        ", "
      )}`,
    });
  } catch (err) {
    console.error("Unsubscribe from event types error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Get current subscriptions for a session
sessionRouter.get("/session/subscriptions/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  const gameSession = sessionManager.getSession(sessionId);

  if (!gameSession) {
    return res.status(404).json({ error: "Session not found." });
  }

  try {
    const currentSubscriptions = gameSession.getGameHistorySubscriptions();

    res.json({
      success: true,
      sessionId: sessionId,
      subscribedEventTypes: currentSubscriptions,
      totalSubscriptions: currentSubscriptions.length,
      note: "Subscriptions only apply to game history events. Regular session events (joins, leaves, etc.) are always broadcast.",
    });
  } catch (err) {
    console.error("Get session subscriptions error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Test session routes
sessionRouter.get("/session/test", (req, res) => {
  res.json({
    status: "session works",
  });
});

export default sessionRouter;

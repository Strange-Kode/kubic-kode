import express from "express";
import { sessionManager } from "../session-manager.js"; // Holds all active GameSession instances
import { GameEventService } from "../game-event-service.js";

import { serializeRecursively } from "../../game-utility/game-utility.js";

const sessionRouter = express.Router();

// Init session, GET fallback (no turnConfig)
sessionRouter.get("/session/init/:gameId", (req, res) => {
  const { gameId } = req.params;
  let sessionState, session_created;
  if (sessionManager.hasSessions()) {
    sessionState = sessionManager.getSessions()[0];
    session_created = false;
  }
  else {
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
  const otherOptions = req.body || {};
  let sessionState, session_created;
  if (sessionManager.hasSessions()) {
    sessionState = sessionManager.getSessions()[0];
    session_created = false;
  }
  else {
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
  const { participantName } = req.body;

  const gameSession = sessionManager.getSession(sessionId);

  if (!gameSession) {
    return res.status(404).json({ error: "Game session not found." });
  }

  try {
    let participantId = gameSession.addParticipant(participantName);
    let participant = serializeRecursively(gameSession.getParticipantById(participantId));
    
    res.json({ success: true, participant_id: participantId });
    
    // Broadcast the event after sending the response to avoid blocking the request
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "sessionParticipantJoined",
        payload: { participant },
      });
    } catch (broadcastError) {
      console.error('Broadcast error (non-blocking):', broadcastError);
      // Don't throw here - the join was successful, just the broadcast failed
    }
    
  }
  catch (err) {
    console.error('Join session error:', err);
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
    let participant = serializeRecursively(gameSession.getParticipantById(participantId));
    gameSession.removeParticipant(participantId);
    res.json({ success: true });
    
    // Broadcast the event after sending the response to avoid blocking the request
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "sessionParticipantLeft",
        payload: { participant },
      });
    } catch (broadcastError) {
      console.error('Broadcast error (non-blocking):', broadcastError);
      // Don't throw here - the leave was successful, just the broadcast failed
    }
    
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// @deprecated, use next route instead
sessionRouter.get("/session/:sessionId/participants", (req, res) => {
  console.warn("session-routes.js::get /session/:sessionId/participants is deprecated, use /session/participants/list/:sessionId instead");
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
        participants: gameSession.getParticipants().map(p => p.id)
      }
    });
  } catch (broadcastError) {
    console.error('Broadcast error (non-blocking):', broadcastError);
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
          vote: voteYes === true
        }
      });

      if (gameSession.isRestartVoteComplete()) {
        const allAgreed = gameSession.getRestartVoteResult();

        GameEventService.broadcastToSession(gameSession, {
          type: "restartVoteResult",
          payload: {
            allAgreed,
            votes: gameSession.restartVote.votes
          }
        });

        gameSession.clearRestartVote();
      }
    } catch (broadcastError) {
      console.error('Broadcast error (non-blocking):', broadcastError);
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
    if (filters.startTime && typeof filters.startTime === 'string') {
      processedFilters.startTime = new Date(filters.startTime);
    }
    if (filters.endTime && typeof filters.endTime === 'string') {
      processedFilters.endTime = new Date(filters.endTime);
    }

    // Get filtered game history
    const history = gameSession.getGameHistory().getByFilters(processedFilters);
    
    res.json({
      success: true,
      sessionId: sessionId,
      totalEvents: history.length,
      history: history
    });
    
  } catch (err) {
    console.error('Get session history error:', err);
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

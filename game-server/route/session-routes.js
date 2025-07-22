import express from "express";
import { sessionManager } from "../session-manager.js"; // Holds all active GameSession instances
import { GameEventService } from "../game-event-service.js";

import { serializeRecursively } from "../../game-utility/game-utility.js";

const sessionRouter = express.Router();

// Creates and secures a singleton session for simplicity.
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
    
    GameEventService.broadcastToSession(gameSession, {
      type: "sessionParticipantJoined",
      payload: { participant },
    });
    
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
    
    GameEventService.broadcastToSession(gameSession, {
      type: "sessionParticipantLeft",
      payload: { participant },
    });
    
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List participants
sessionRouter.get("/session/:sessionId/participants", (req, res) => {
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

  GameEventService.broadcastToSession(gameSession, {
    type: "restartVoteStarted",
    payload: {
      participants: gameSession.getParticipants().map(p => p.id)
    }
  });

  res.json({ vote_inited: true });
});

sessionRouter.post("/session/submit-restart-vote/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const { participantId, voteYes } = req.body;

  const gameSession = sessionManager.getSession(sessionId);

  try {
    gameSession.registerRestartVote(participantId, voteYes === true);

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

    res.json({ success: true });

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Test session routes
sessionRouter.get("/session/test", (req, res) => {
  res.json({
    status: "session works",
  });
});

export default sessionRouter;

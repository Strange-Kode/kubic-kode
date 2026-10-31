import express from "express";
import { sessionManager } from "../session-manager.js"; // Holds all active GameSession instances
import { kubicLog } from "../../kubic-log.js";

import { validateSession, validateParticipant, validatePlayableParticipant } from "../../game-utility/game-utility.js";
import { modules as kubicModules } from "../../game-module/module-system/index.js";

const sessionRouter = express.Router();

// Create middleware instance with session manager
const validateSessionMiddleware = validateSession(sessionManager);

// Init session, GET fallback (no turnConfig)
sessionRouter.get("/session/init/:gameId", (req, res) => {
  const { gameId } = req.params;
  const result = kubicModules.session.initSession(sessionManager, gameId);
  res.json(result);
});

// Init session, POST: allows passing options (but NOT turnConfig)
sessionRouter.post("/session/init/:gameId", (req, res) => {
  const { gameId } = req.params;
  const options = req.body || {};
  const result = kubicModules.session.initSession(sessionManager, gameId, options);
  res.json(result);
});

// Join session
sessionRouter.post("/session/:sessionId/join", validateSessionMiddleware, async (req, res) => {
  const { participantName, participantType = "user" } = req.body;
  const gameSession = req.gameSession;

  try {
    const result = await kubicModules.participant.joinSession(gameSession, participantName, participantType);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Join session error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Join session as spectator
sessionRouter.post("/session/:sessionId/spectate", validateSessionMiddleware, async (req, res) => {
  const { participantName } = req.body;
  const gameSession = req.gameSession;

  try {
    const result = await kubicModules.participant.joinSession(gameSession, participantName, "spectator");
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Join session as spectator error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Leave session
sessionRouter.post("/session/:sessionId/leave", validateSessionMiddleware, (req, res) => {
  const { participantId } = req.body;
  const gameSession = req.gameSession;

  // TODO: Require participant token to be provided in the request body

  try {
    const result = kubicModules.participant.leaveSession(gameSession, participantId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});



// List participants
sessionRouter.get("/session/:sessionId/participants/list", validateSessionMiddleware, (req, res) => {
  const session = req.gameSession;

  res.json(kubicModules.participant.listParticipants(session));
});

// Get participant statistics
sessionRouter.get("/session/:sessionId/participants/stats", validateSessionMiddleware, (req, res) => {
  const gameSession = req.gameSession;

  res.json(kubicModules.participant.getParticipantStats(gameSession));
});

sessionRouter.get("/session/:sessionId/request-restart-vote", validateSessionMiddleware, (req, res) => {
  const gameSession = req.gameSession;

  const result = kubicModules.vote.startRestartVote(gameSession);
  res.json(result);
});

sessionRouter.post("/session/:sessionId/submit-restart-vote", validateSessionMiddleware, validatePlayableParticipant(sessionManager), (req, res) => {
  const { participantId, voteYes } = req.body;
  const gameSession = req.gameSession;

  try {
    const result = kubicModules.vote.submitRestartVote(gameSession, participantId, voteYes);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get session game history with optional filters
sessionRouter.post("/session/:sessionId/history", validateSessionMiddleware, (req, res) => {
  const filters = req.body || {};
  const gameSession = req.gameSession;

  try {
    const result = kubicModules.session.getGameHistory(gameSession, filters);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Get session history error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Subscribe to game history event types
sessionRouter.post("/session/:sessionId/subscribe", validateSessionMiddleware, (req, res) => {
  const { eventTypes } = req.body;
  const gameSession = req.gameSession;

  try {
    const result = kubicModules.subscription.subscribeToEvents(gameSession, eventTypes);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Subscribe to event types error:", err);
    if (err.invalidTypes) {
      return res.status(400).json({
        error: err.message,
        validGameHistoryEventTypes: err.validGameHistoryEventTypes,
      });
    }
    res.status(400).json({ error: err.message });
  }
});

// Unsubscribe from game history event types
sessionRouter.post("/session/:sessionId/unsubscribe", validateSessionMiddleware, (req, res) => {
  const { eventTypes } = req.body;
  const gameSession = req.gameSession;

  try {
    const result = kubicModules.subscription.unsubscribeFromEvents(gameSession, eventTypes);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Unsubscribe from event types error:", err);
    if (err.invalidTypes) {
      return res.status(400).json({
        error: err.message,
        validGameHistoryEventTypes: err.validGameHistoryEventTypes,
      });
    }
    res.status(400).json({ error: err.message });
  }
});

// Get current subscriptions for a session
sessionRouter.get("/session/:sessionId/subscriptions", validateSessionMiddleware, (req, res) => {
  const gameSession = req.gameSession;

  try {
    const result = kubicModules.session.getSubscriptions(gameSession);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Get session subscriptions error:", err);
    res.status(400).json({ error: err.message });
  }
});

// List all sessions with comprehensive lobby information
sessionRouter.get("/sessions/list", (req, res) => {
  try {
    const { onlyJoinable } = req.query;
    const result = kubicModules.session.listSessions(sessionManager, onlyJoinable === "true");
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::List sessions error:", err);
    res.status(500).json({ error: "Failed to retrieve sessions list." });
  }
});

// Get detailed lobby information for a specific session
sessionRouter.get("/session/:sessionId/lobby", validateSessionMiddleware, (req, res) => {
  const session = req.gameSession;
  
  try {
    const result = kubicModules.session.getLobbyStatus(session);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Get lobby status error:", err);
    res.status(500).json({ error: "Failed to retrieve lobby status." });
  }
});

// Get sessions by game variant
sessionRouter.get("/sessions/game/:gameVariantId", (req, res) => {
  const { gameVariantId } = req.params;
  const { onlyJoinable } = req.query;
  
  try {
    const result = kubicModules.session.getSessionsByVariant(sessionManager, gameVariantId, onlyJoinable === "true");
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Get sessions by game variant error:", err);
    res.status(500).json({ error: "Failed to retrieve sessions for game variant." });
  }
});

// Session Configuration Routes
// ---------------------------

// Set lobby configuration (host only)
sessionRouter.post("/session/:sessionId/config", validateSessionMiddleware, (req, res) => {
  const { participantId, config } = req.body;

  if (!participantId) {
    return res.status(400).json({ error: "participantId is required." });
  }

  if (!config || typeof config !== "object") {
    return res.status(400).json({ error: "config object is required." });
  }

  const session = req.gameSession;

  try {
    const result = kubicModules.lobby.setLobbyConfig(session, participantId, config);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Set lobby config error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Get lobby configuration
sessionRouter.get("/session/:sessionId/config", validateSessionMiddleware, (req, res) => {
  const session = req.gameSession;

  try {
    const result = kubicModules.lobby.getLobbyConfig(session);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Get lobby config error:", err);
    res.status(500).json({ error: "Failed to retrieve lobby configuration." });
  }
});

// Delete specific lobby configuration key (host only)
sessionRouter.delete("/session/:sessionId/config/:configKey", validateSessionMiddleware, (req, res) => {
  const { configKey } = req.params;
  const { participantId } = req.body;

  if (!participantId) {
    return res.status(400).json({ error: "participantId is required." });
  }

  const session = req.gameSession;

  try {
    const result = kubicModules.lobby.deleteLobbyConfig(session, participantId, configKey);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Delete lobby config error:", err);
    if (err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// Auto-join session for a game variant
sessionRouter.post("/sessions/auto-join/:gameVariantId", async (req, res) => {
  const { gameVariantId } = req.params;
  const { participantName, participantType = "user", createIfNone = true } = req.body;

  try {
    const result = await kubicModules.participant.autoJoinSession(
      sessionManager, 
      gameVariantId, 
      participantName, 
      participantType, 
      createIfNone
    );
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Auto-join session error:", err);
    if (err.message.includes("auto-creation is disabled")) {
      return res.status(404).json({ error: err.message, available_sessions: 0 });
    }
    res.status(400).json({ error: err.message });
  }
});

// Synchronization and Ready Check Routes
// --------------------------------------

// Start sync phase (host only)
sessionRouter.post("/session/:sessionId/sync/start", validateSessionMiddleware, (req, res) => {
  const { participantId } = req.body;

  if (!participantId) {
    return res.status(400).json({ error: "participantId is required." });
  }

  const session = req.gameSession;

  try {
    const result = kubicModules.lobby.startSyncPhase(session, participantId);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Start sync phase error:", err);
    if (err.message.includes("Only the host")) {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// Set participant ready state
sessionRouter.post("/session/:sessionId/ready", validateSessionMiddleware, validatePlayableParticipant(sessionManager), (req, res) => {
  const { participantId, ready } = req.body;

  if (typeof ready !== "boolean") {
    return res.status(400).json({ error: "ready must be a boolean value." });
  }

  const session = req.gameSession;

  try {
    const result = kubicModules.lobby.setParticipantReady(session, participantId, ready);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Set ready state error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Get ready states
sessionRouter.get("/session/:sessionId/ready", validateSessionMiddleware, (req, res) => {
  const session = req.gameSession;

  try {
    const result = kubicModules.lobby.getReadyStates(session);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Get ready states error:", err);
    res.status(500).json({ error: "Failed to retrieve ready states." });
  }
});

// Kick participant (host only)
sessionRouter.post("/session/:sessionId/kick", validateSessionMiddleware, (req, res) => {
  const { hostId, participantIdToKick } = req.body;

  if (!hostId || !participantIdToKick) {
    return res.status(400).json({ error: "hostId and participantIdToKick are required." });
  }

  const session = req.gameSession;

  try {
    const result = kubicModules.participant.kickParticipant(session, participantIdToKick, hostId);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Kick participant error:", err);
    if (err.message.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// Transfer host (current host only)
sessionRouter.post("/session/:sessionId/transfer-host", validateSessionMiddleware, (req, res) => {
  const { currentHostId, newHostId } = req.body;

  if (!currentHostId || !newHostId) {
    return res.status(400).json({ error: "currentHostId and newHostId are required." });
  }

  const session = req.gameSession;

  try {
    const result = kubicModules.participant.transferHost(session, currentHostId, newHostId);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Transfer host error:", err);
    if (err.message.includes("Only the current host")) {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message });
  }
});

// Chat Functionality Routes
// -------------------------

// Send chat message
sessionRouter.post("/session/:sessionId/chat", validateSessionMiddleware, validateParticipant(sessionManager), (req, res) => {
  const { participantId, message } = req.body;
  const session = req.gameSession;

  try {
    const participant = req.participant;
    const result = kubicModules.chat.sendChatMessage(session, participant, participantId, message);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Send chat message error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Get chat messages
sessionRouter.get("/session/:sessionId/chat", validateSessionMiddleware, (req, res) => {
  const { limit = 50 } = req.query;
  const session = req.gameSession;

  try {
    const result = kubicModules.chat.getChatMessages(session, limit);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Get chat messages error:", err);
    res.status(500).json({ error: "Failed to retrieve chat messages." });
  }
});

// Connection Management Routes
// ---------------------------

// Get session connection status
sessionRouter.get("/session/:sessionId/status", validateSessionMiddleware, (req, res) => {
  const session = req.gameSession;
  
  try {
    const result = kubicModules.session.getSessionStatus(session);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Get session status error:", err);
    res.status(500).json({ error: "Failed to retrieve session status." });
  }
});

// Get all sessions with status
sessionRouter.get("/sessions/status", (req, res) => {
  try {
    const result = kubicModules.session.getSessionsWithStatus(sessionManager);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Get sessions status error:", err);
    res.status(500).json({ error: "Failed to retrieve sessions status." });
  }
});

// Get viable sessions (sessions with enough connected players)
sessionRouter.get("/sessions/viable", (req, res) => {
  try {
    const result = kubicModules.session.getViableSessions(sessionManager);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Get viable sessions error:", err);
    res.status(500).json({ error: "Failed to retrieve viable sessions." });
  }
});

// Heartbeat endpoint for clients to confirm they're still alive
sessionRouter.post("/session/:sessionId/heartbeat", validateSessionMiddleware, validateParticipant(sessionManager), (req, res) => {
  const { participantId } = req.body;
  const session = req.gameSession;
  
  try {
    const result = kubicModules.participant.processHeartbeat(session, participantId);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Heartbeat error:", err);
    res.status(500).json({ error: "Failed to process heartbeat." });
  }
});

// Force disconnect a participant (admin function)
sessionRouter.post("/session/:sessionId/disconnect", validateSessionMiddleware, validateParticipant(sessionManager), (req, res) => {
  const { participantId, reason = "Admin disconnect" } = req.body;
  const session = req.gameSession;
  
  try {
    const participant = req.participant;
    const result = kubicModules.participant.handleDisconnection(session, participant, participantId, reason);
    res.json(result);
  } catch (err) {
    kubicLog.error("session-routes.js::Force disconnect error:", err);
    res.status(500).json({ error: "Failed to disconnect participant." });
  }
});

// Test session routes
sessionRouter.get("/session/test", (req, res) => {
  res.json({
    status: kubicModules.test.echo("session works"),
  });
});

export default sessionRouter;

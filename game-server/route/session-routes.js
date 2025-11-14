import express from "express";
import { sessionManager } from "../session-manager.js"; // Holds all active GameSession instances
import { GameEventService } from "../game-event-service.js";
import { GameHistory } from "../game-history.js"; // GameHistory contains getValidEventTypes used for subscription validation
import { kubicLog } from "../../kubic-log.js";

import { serializeRecursively, validateSession, validateParticipant, validatePlayableParticipant } from "../../game-utility/game-utility.js";

const sessionRouter = express.Router();

// Create middleware instance with session manager
const validateSessionMiddleware = validateSession(sessionManager);

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
  kubicLog.info(`session-routes.js::session created: ${session_created}`);
  kubicLog.info(`session-routes.js::session id: ${sessionState.getSessionId()}`);
  res.json({
    session_id: sessionState.getSessionId(),
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
  kubicLog.info(`session-routes.js::session created: ${session_created}`);
  kubicLog.info(`session-routes.js::session id: ${sessionState.getSessionId()}`);
  res.json({
    session_id: sessionState.getSessionId(),
    session_created: session_created,
  });
});

// Join session
sessionRouter.post("/session/:sessionId/join", validateSessionMiddleware, async (req, res) => {
  const { participantName, participantType = "user" } = req.body;
  const gameSession = req.gameSession;

  try {
    let participantId = gameSession.addParticipant(
      participantName,
      participantType
    );
    let participant = gameSession.getParticipantById(participantId);

    // Get the participant's game token
    const gameToken = await gameSession.generateParticipantToken(participantId);
    
    res.json({ 
      success: true, 
      participant_id: participantId,
      game_token: gameToken
    });

    // Broadcast the event after sending the response to avoid blocking the request
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::sessionParticipantJoined",
        payload: { participant: serializeRecursively(participant) },
      });
    } catch (broadcastError) {
      kubicLog.error("session-routes.js::Broadcast error (non-blocking):", broadcastError);
      // Don't throw here - the join was successful, just the broadcast failed
    }
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
    let participantId = gameSession.addParticipant(
      participantName,
      "spectator"
    );
    let participant = gameSession.getParticipantById(participantId);

    // Get the participant's game token
    const gameToken = await gameSession.generateParticipantToken(participantId);
    
    res.json({ 
      success: true, 
      participant_id: participantId,
      game_token: gameToken
    });

    // Broadcast the event after sending the response to avoid blocking the request
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::sessionSpectatorJoined",
        payload: { participant: serializeRecursively(participant) },
      });
    } catch (broadcastError) {
      kubicLog.error("session-routes.js::Broadcast error (non-blocking):", broadcastError);
      // Don't throw here - the join was successful, just the broadcast failed
    }
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
    let participant = gameSession.getParticipantById(participantId);
    gameSession.removeParticipant(participantId);
    res.json({ success: true });

    // Broadcast the event after sending the response to avoid blocking the request
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::sessionParticipantLeft",
        payload: { participant: serializeRecursively(participant) },
      });
    } catch (broadcastError) {
      kubicLog.error("session-routes.js::Broadcast error (non-blocking):", broadcastError);
      // Don't throw here - the leave was successful, just the broadcast failed
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});



// List participants
sessionRouter.get("/session/:sessionId/participants/list", validateSessionMiddleware, (req, res) => {
  const session = req.gameSession;

  res.json(session.listParticipants());
});

// Get participant statistics
sessionRouter.get("/session/:sessionId/participants/stats", validateSessionMiddleware, (req, res) => {
  const gameSession = req.gameSession;

  const allParticipants = gameSession.listParticipants();
  const playableParticipants = gameSession.getPlayableParticipants();
  const spectatorParticipants = gameSession.getSpectatorParticipants();

  res.json({
    sessionId: gameSession.getSessionId(),
    maxPlayers: gameSession.getMaxPlayers(),
    total: allParticipants.length,
    players: playableParticipants.length,
    spectators: spectatorParticipants.length,
    canStart: playableParticipants.length >= gameSession.getMaxPlayers(),
    started: gameSession.isStarted(),
  });
});

sessionRouter.get("/session/:sessionId/request-restart-vote", validateSessionMiddleware, (req, res) => {
  const gameSession = req.gameSession;

  // Check if a restart vote is already in progress
  if (gameSession.getVoteManager().isRestartVoteInProgress()) {
    return res.json({ vote_inited: true, message: "Restart vote already in progress" });
  }

  // Callback for when AI votes (for broadcasting)
  const onAiVote = (participantId, participantName) => {
    console.log(`[AI VOTE] Callback triggered for ${participantName} (${participantId})`);
    try {
      console.log(`[AI VOTE] Broadcasting kubic::restartVoteUpdate for ${participantId}`);
      // Broadcast AI vote update
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::restartVoteUpdate",
        payload: {
          participantId,
          vote: true,
        },
      });

      kubicLog.info(`session-routes.js::AI participant ${participantName} (${participantId}) auto-voted Yes`);

      // Check if voting is complete after AI vote
      if (gameSession.getVoteManager().isRestartVoteComplete()) {
        const allAgreed = gameSession.getVoteManager().getRestartVoteResult();

        GameEventService.broadcastToSession(gameSession, {
          type: "kubic::restartVoteResult",
          payload: {
            allAgreed,
            votes: gameSession.getVoteManager().getRestartVote().votes,
          },
        });

        gameSession.getVoteManager().clearRestartVote();
      }
    } catch (error) {
      kubicLog.error("session-routes.js::Error handling AI vote:", error);
    }
  };

  const participants = gameSession.getPlayableParticipants();
  console.log(`[AI VOTE] Starting restart vote with ${participants.length} participants:`,
    participants.map(p => `${p.name} (${p.type})`));

  gameSession.getVoteManager().startRestartVote(participants, onAiVote);

  res.json({ vote_inited: true });

  // Broadcast the event after sending the response to avoid blocking the request
  try {
    GameEventService.broadcastToSession(gameSession, {
      type: "kubic::restartVoteStarted",
      payload: {
        participants: gameSession.getParticipants().map((p) => p.id),
      },
    });
  } catch (broadcastError) {
    kubicLog.error("session-routes.js::Broadcast error (non-blocking):", broadcastError);
    // Don't throw here - the vote was started successfully, just the broadcast failed
  }
});

sessionRouter.post("/session/:sessionId/submit-restart-vote", validateSessionMiddleware, validatePlayableParticipant(sessionManager), (req, res) => {
  const { participantId, voteYes } = req.body;
  const gameSession = req.gameSession;
  const participant = req.participant;

  try {
    gameSession.getVoteManager().registerRestartVote(participantId, voteYes === true);

    res.json({ success: true });

    // Broadcast the event after sending the response to avoid blocking the request
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::restartVoteUpdate",
        payload: {
          participantId,
          vote: voteYes === true,
        },
      });

      if (gameSession.getVoteManager().isRestartVoteComplete()) {
        const allAgreed = gameSession.getVoteManager().getRestartVoteResult();

        GameEventService.broadcastToSession(gameSession, {
          type: "kubic::restartVoteResult",
          payload: {
            allAgreed,
            votes: gameSession.getVoteManager().getRestartVote().votes,
          },
        });

        gameSession.getVoteManager().clearRestartVote();
      }
    } catch (broadcastError) {
      kubicLog.error("session-routes.js::Broadcast error (non-blocking):", broadcastError);
      // Don't throw here - the vote was registered successfully, just the broadcast failed
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get session game history with optional filters
sessionRouter.post("/session/:sessionId/history", validateSessionMiddleware, (req, res) => {
  const filters = req.body || {};
  const gameSession = req.gameSession;

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
      sessionId: req.params.sessionId,
      totalEvents: history.length,
      history: history,
    });
  } catch (err) {
    kubicLog.error("session-routes.js::Get session history error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Subscribe to game history event types
sessionRouter.post("/session/:sessionId/subscribe", validateSessionMiddleware, (req, res) => {
  const { eventTypes } = req.body;
  const gameSession = req.gameSession;

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

    gameSession.getHistoryManager().subscribeToGameHistoryEvents(eventTypes);

    res.json({
      success: true,
      sessionId: req.params.sessionId,
      subscribedEventTypes: eventTypes,
      message: `Successfully subscribed to game history event types: ${eventTypes.join(
        ", "
      )}`,
    });
  } catch (err) {
    kubicLog.error("session-routes.js::Subscribe to event types error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Unsubscribe from game history event types
sessionRouter.post("/session/:sessionId/unsubscribe", validateSessionMiddleware, (req, res) => {
  const { eventTypes } = req.body;
  const gameSession = req.gameSession;

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

    gameSession.getHistoryManager().unsubscribeFromGameHistoryEvents(eventTypes);

    res.json({
      success: true,
      sessionId: req.params.sessionId,
      unsubscribedEventTypes: eventTypes,
      message: `Successfully unsubscribed from game history event types: ${eventTypes.join(
        ", "
      )}`,
    });
  } catch (err) {
    kubicLog.error("session-routes.js::Unsubscribe from event types error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Get current subscriptions for a session
sessionRouter.get("/session/:sessionId/subscriptions", validateSessionMiddleware, (req, res) => {
  const gameSession = req.gameSession;

  try {
    const currentSubscriptions = gameSession.getHistoryManager().getGameHistorySubscriptions();

    res.json({
      success: true,
      sessionId: req.params.sessionId,
      subscribedEventTypes: currentSubscriptions,
      totalSubscriptions: currentSubscriptions.length,
      note: "Subscriptions only apply to game history events. Regular session events (joins, leaves, etc.) are always broadcast.",
    });
  } catch (err) {
    kubicLog.error("session-routes.js::Get session subscriptions error:", err);
    res.status(400).json({ error: err.message });
  }
});

// List all sessions with comprehensive lobby information
sessionRouter.get("/sessions/list", (req, res) => {
  const { onlyJoinable } = req.query;

  try {
    let sessions = sessionManager.getSessions();

    // If onlyJoinable flag is set, filter to only sessions that need players
    if (onlyJoinable === "true") {
      sessions = sessions.filter(session => {
        const status = session.getLobbyStatus();
        const isPrivate = status.lobbyConfig?.isPrivate === true;
        return !status.started && status.needsMorePlayers && !isPrivate;
      });
    }

    const sessionList = sessions.map(session => session.getLobbyStatus());

    res.json({
      success: true,
      only_joinable: onlyJoinable === "true",
      total_sessions: sessionList.length,
      sessions: sessionList
    });
  } catch (err) {
    kubicLog.error("session-routes.js::List sessions error:", err);
    res.status(500).json({ error: "Failed to retrieve sessions list." });
  }
});

// Get detailed lobby information for a specific session
sessionRouter.get("/session/:sessionId/lobby", validateSessionMiddleware, (req, res) => {
  const session = req.gameSession;
  
  try {
    const lobbyStatus = session.getLobbyStatus();
    res.json({
      success: true,
      lobby: lobbyStatus
    });
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
    const allSessions = sessionManager.getSessions();
    let filteredSessions = allSessions.filter(session => 
      session.getGameVariantId() === gameVariantId
    );
    
    // If onlyJoinable flag is set, filter to only sessions that need players
    if (onlyJoinable === "true") {
      filteredSessions = filteredSessions.filter(session => {
        const status = session.getLobbyStatus();
        const isPrivate = status.lobbyConfig?.isPrivate === true;
        return !status.started && status.needsMorePlayers && !isPrivate;
      });
    }
    
    const sessionList = filteredSessions.map(session => session.getLobbyStatus());
    
    res.json({
      success: true,
      game_variant_id: gameVariantId,
      only_joinable: onlyJoinable === "true",
      total_sessions: sessionList.length,
      sessions: sessionList
    });
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
    // Validate that participant is the host
    if (!session.getParticipantManager().isHost(participantId)) {
      return res.status(403).json({ error: "Only the host can configure lobby settings." });
    }

    // Apply configuration changes
    const configChanges = [];
    for (const [key, value] of Object.entries(config)) {
      const oldValue = session.getLobbyManager().getLobbyConfig(key);
      session.getLobbyManager().setLobbyConfig(key, value, participantId);
      configChanges.push({ key, oldValue, newValue: value });
    }

    res.json({
      success: true,
      applied_config: config,
      changes: configChanges,
      full_config: session.getLobbyManager().getAllLobbyConfig()
    });

          // Broadcast configuration changes
    try {
      GameEventService.broadcastToSession(session, {
        type: "kubic::lobbyConfigUpdated",
        payload: {
          hostId: participantId,
          hostName: session.getParticipantManager().getHost().name,
          changes: configChanges,
          fullConfig: session.getLobbyManager().getAllLobbyConfig()
        }
      });

      // Add system message about config changes
      const changesList = configChanges.map(c => `${c.key}: ${c.newValue}`).join(", ");
      const systemMessage = session.getChatManager().addSystemMessage(`Host updated game settings: ${changesList}`);
      GameEventService.broadcastToSession(session, {
        type: "kubic::lobbyChatMessage",
        payload: { message: systemMessage }
      });
    } catch (broadcastError) {
      kubicLog.error("session-routes.js::Lobby config broadcast error (non-blocking):", broadcastError);
    }

  } catch (err) {
    kubicLog.error("session-routes.js::Set lobby config error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Get lobby configuration
sessionRouter.get("/session/:sessionId/config", validateSessionMiddleware, (req, res) => {
  const session = req.gameSession;

  try {
    res.json({
      success: true,
      session_id: req.params.sessionId,
      config: session.getLobbyManager().getAllLobbyConfig(),
      host: session.getParticipantManager().getHost()
    });
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
    const oldValue = session.getLobbyManager().getLobbyConfig(configKey);
    const deleted = session.getLobbyManager().deleteLobbyConfig(configKey, participantId);

    if (!deleted) {
      return res.status(404).json({ error: `Configuration key "${configKey}" not found.` });
    }

    res.json({
      success: true,
      deleted_key: configKey,
      old_value: oldValue,
      remaining_config: session.getLobbyManager().getAllLobbyConfig()
    });

    // Broadcast configuration deletion
    try {
      GameEventService.broadcastToSession(session, {
        type: "kubic::lobbyConfigDeleted",
        payload: {
        hostId: participantId,
        hostName: session.getParticipantManager().getHost().name,
        deletedKey: configKey,
        oldValue: oldValue,
        remainingConfig: session.getLobbyManager().getAllLobbyConfig()
        }
      });

      // Add system message
      const systemMessage = session.getChatManager().addSystemMessage(`Host removed setting: ${configKey}`);
      GameEventService.broadcastToSession(session, {
        type: "kubic::lobbyChatMessage",
        payload: { message: systemMessage }
      });
    } catch (broadcastError) {
      kubicLog.error("session-routes.js::Lobby config deletion broadcast error (non-blocking):", broadcastError);
    }

  } catch (err) {
    kubicLog.error("session-routes.js::Delete lobby config error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Auto-join session for a game variant
sessionRouter.post("/sessions/auto-join/:gameVariantId", async (req, res) => {
  const { gameVariantId } = req.params;
  const { participantName, participantType = "user", createIfNone = true } = req.body;

  if (!participantName || participantName.trim().length === 0) {
    return res.status(400).json({ error: "participantName is required." });
  }

  try {
    const allSessions = sessionManager.getSessions();
    
    // Find sessions that match criteria:
    // 1. Same game variant
    // 2. Not started
    // 3. Need more players
    // 4. Participant name not already in use
    const availableSessions = allSessions.filter(session => {
      if (session.getGameVariantId() !== gameVariantId) return false;
      if (session.isStarted()) return false;
      
      const status = session.getLobbyStatus();
      if (!status.needsMorePlayers) return false;

      // Don't auto-join into private games
      const isPrivate = status.lobbyConfig?.isPrivate === true;
      if (isPrivate) return false;

      // Check if participant name is already in use in this session
      const nameInUse = session.getParticipants().some(p => p.name === participantName.trim());
      if (nameInUse) return false;
      
      return true;
    });

    // Sort by preference: sessions with fewer players first (to balance)
    availableSessions.sort((a, b) => {
      const aPlayersCount = a.getPlayableParticipants().length;
      const bPlayersCount = b.getPlayableParticipants().length;
      return aPlayersCount - bPlayersCount;
    });

    let targetSession = null;
    let sessionCreated = false;

    if (availableSessions.length > 0) {
      // Join the first available session
      targetSession = availableSessions[0];
    } else if (createIfNone) {
      // Create new session if none available and createIfNone is true
      targetSession = sessionManager.createSession(gameVariantId);
      sessionCreated = true;
    } else {
      return res.status(404).json({ 
        error: "No available sessions found and auto-creation is disabled.",
        available_sessions: 0
      });
    }

    // Join the target session
    const participantId = targetSession.addParticipant(participantName.trim(), participantType);
    const participant = targetSession.getParticipantById(participantId);

    // Get the participant's game token
    const gameToken = await targetSession.generateParticipantToken(participantId);

    res.json({
      success: true,
      session_id: targetSession.getSessionId(),
      participant_id: participantId,
      game_token: gameToken,
      session_created: sessionCreated,
      lobby_status: targetSession.getLobbyStatus()
    });

    // Broadcast the join event
    try {
      const eventType = participantType === "spectator" ? "kubic::sessionSpectatorJoined" : "kubic::sessionParticipantJoined";
      GameEventService.broadcastToSession(targetSession, {
        type: eventType,
        payload: { participant: serializeRecursively(participant) },
      });

      // If this was auto-join, add system message
      if (!sessionCreated) {
        const systemMessage = targetSession.getChatManager().addSystemMessage(`${participantName} joined via auto-match`);
        GameEventService.broadcastToSession(targetSession, {
          type: "kubic::lobbyChatMessage",
          payload: { message: systemMessage },
        });
      }
    } catch (broadcastError) {
      kubicLog.error("session-routes.js::Auto-join broadcast error (non-blocking):", broadcastError);
    }

  } catch (err) {
    kubicLog.error("session-routes.js::Auto-join session error:", err);
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
    if (!session.getParticipantManager().isHost(participantId)) {
      return res.status(403).json({ error: "Only the host can start sync phase." });
    }

    if (session.isStarted()) {
      return res.status(400).json({ error: "Game has already started." });
    }

    const playableParticipants = session.getPlayableParticipants();
    if (playableParticipants.length < 2) {
      return res.status(400).json({ error: "Need at least 2 players to start sync phase." });
    }

    session.getLobbyManager().startSyncPhase();

    res.json({
      success: true,
      sync_phase: true,
      ready_states: session.getLobbyManager().getAllReadyStates(),
      participants: session.getPlayableParticipants().map(p => ({ id: p.id, name: p.name }))
    });

    // Broadcast sync phase start
    try {
      GameEventService.broadcastToSession(session, {
        type: "kubic::syncPhaseStarted",
        payload: {
          hostId: participantId,
          hostName: session.getHost().name,
          readyStates: session.getLobbyManager().getAllReadyStates(),
          participants: session.getPlayableParticipants()
        }
      });

      const systemMessage = session.getChatManager().addSystemMessage("Synchronization phase started. Please indicate when you're ready!");
      GameEventService.broadcastToSession(session, {
        type: "kubic::lobbyChatMessage",
        payload: { message: systemMessage }
      });
    } catch (broadcastError) {
      kubicLog.error("session-routes.js::Sync phase start broadcast error (non-blocking):", broadcastError);
    }

  } catch (err) {
    kubicLog.error("session-routes.js::Start sync phase error:", err);
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
  const participant = req.participant;

  try {
    session.getLobbyManager().setParticipantReady(participantId, ready);
    const participant = session.getParticipantById(participantId);
    const allReady = session.getLobbyManager().areAllParticipantsReady();

    res.json({
      success: true,
      participant_id: participantId,
      ready: ready,
      all_ready: allReady,
      ready_states: session.getLobbyManager().getAllReadyStates()
    });

    // Broadcast ready state change
    try {
      GameEventService.broadcastToSession(session, {
        type: "kubic::participantReadyChanged",
        payload: {
          participantId: participantId,
          participantName: participant.name,
          ready: ready,
          allReady: allReady,
          readyStates: session.getLobbyManager().getAllReadyStates()
        }
      });

      // Add chat message about ready state change
      const readyText = ready ? "ready" : "not ready";
      const systemMessage = session.getChatManager().addSystemMessage(`${participant.name} is ${readyText}`);
      GameEventService.broadcastToSession(session, {
        type: "kubic::lobbyChatMessage",
        payload: { message: systemMessage }
      });

      // If all participants are ready, notify
      if (allReady) {
        const allReadyMessage = session.getChatManager().addSystemMessage("All players are ready! Host can now start the game.");
        GameEventService.broadcastToSession(session, {
          type: "kubic::lobbyChatMessage",
          payload: { message: allReadyMessage }
        });
      }
    } catch (broadcastError) {
      kubicLog.error("session-routes.js::Ready state broadcast error (non-blocking):", broadcastError);
    }

  } catch (err) {
    kubicLog.error("session-routes.js::Set ready state error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Get ready states
sessionRouter.get("/session/:sessionId/ready", validateSessionMiddleware, (req, res) => {
  const session = req.gameSession;

  try {
    res.json({
      success: true,
      session_id: req.params.sessionId,
      in_sync_phase: session.getLobbyManager().isInSyncPhase(),
      all_ready: session.getLobbyManager().areAllParticipantsReady(),
      ready_states: session.getLobbyManager().getAllReadyStates(),
      playable_participants: session.getPlayableParticipants().map(p => ({ id: p.id, name: p.name }))
    });
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
    const participantToKick = session.getParticipantById(participantIdToKick);
    if (!participantToKick) {
      return res.status(404).json({ error: "Participant to kick not found." });
    }

    session.getLobbyManager().kickParticipant(participantIdToKick, hostId);

    res.json({
      success: true,
      kicked_participant: {
        id: participantToKick.id,
        name: participantToKick.name
      },
      remaining_participants: session.listParticipants()
    });

    // Broadcast kick event
    try {
      GameEventService.broadcastToSession(session, {
        type: "kubic::participantKicked",
        payload: {
          hostId: hostId,
          hostName: session.getParticipantManager().getHost().name,
          kickedParticipant: {
            id: participantToKick.id,
            name: participantToKick.name
          }
        }
      });

      const systemMessage = session.getChatManager().addSystemMessage(`${participantToKick.name} was removed from the session by the host`);
      GameEventService.broadcastToSession(session, {
        type: "kubic::lobbyChatMessage",
        payload: { message: systemMessage }
      });
    } catch (broadcastError) {
      kubicLog.error("session-routes.js::Kick participant broadcast error (non-blocking):", broadcastError);
    }

  } catch (err) {
    kubicLog.error("session-routes.js::Kick participant error:", err);
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
    if (!session.getParticipantManager().isHost(currentHostId)) {
      return res.status(403).json({ error: "Only the current host can transfer host privileges." });
    }

    const oldHost = session.getParticipantManager().getHost();
    session.getParticipantManager().transferHost(newHostId);
    const newHost = session.getParticipantManager().getHost();

    res.json({
      success: true,
      old_host: oldHost,
      new_host: newHost
    });

    // Broadcast host transfer
    try {
      GameEventService.broadcastToSession(session, {
        type: "kubic::hostTransferred",
        payload: {
          oldHost: oldHost,
          newHost: newHost
        }
      });

      const systemMessage = session.getChatManager().addSystemMessage(`${newHost.name} is now the host`);
      GameEventService.broadcastToSession(session, {
        type: "kubic::lobbyChatMessage",
        payload: { message: systemMessage }
      });
    } catch (broadcastError) {
      kubicLog.error("session-routes.js::Host transfer broadcast error (non-blocking):", broadcastError);
    }

  } catch (err) {
    kubicLog.error("session-routes.js::Transfer host error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Chat Functionality Routes
// -------------------------

// Send chat message
sessionRouter.post("/session/:sessionId/chat", validateSessionMiddleware, validateParticipant(sessionManager), (req, res) => {
  const { participantId, message } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "message is required and must be a non-empty string." });
  }

  if (message.trim().length > 500) {
    return res.status(400).json({ error: "Message cannot exceed 500 characters." });
  }

  const session = req.gameSession;

  try {
    const participant = req.participant;

    // Determine message type based on participant
    const messageType = session.getParticipantManager().isHost(participantId) ? "host" : "user";
    const chatMessage = session.getChatManager().addChatMessage(participantId, message, messageType);

    res.json({
      success: true,
      message: chatMessage
    });

    // Broadcast chat message
    try {
      GameEventService.broadcastToSession(session, {
        type: "kubic::lobbyChatMessage",
        payload: { message: chatMessage }
      });
    } catch (broadcastError) {
      kubicLog.error("session-routes.js::Chat message broadcast error (non-blocking):", broadcastError);
    }

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
    const messages = session.getChatManager().getChatMessages(parseInt(limit, 10));
    
    res.json({
      success: true,
      session_id: req.params.sessionId,
      total_messages: messages.length,
      messages: messages
    });
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
    const status = session.getSessionStatus();
    const participants = session.listParticipants();
    
    res.json({
      success: true,
      session_id: req.params.sessionId,
      status: status,
      participants: participants
    });
  } catch (err) {
    kubicLog.error("session-routes.js::Get session status error:", err);
    res.status(500).json({ error: "Failed to retrieve session status." });
  }
});

// Get all sessions with status
sessionRouter.get("/sessions/status", (req, res) => {
  try {
    const sessionsWithStatus = sessionManager.getSessionsWithStatus();
    const stats = sessionManager.getSessionStats();
    
    res.json({
      success: true,
      sessions: sessionsWithStatus,
      stats: stats
    });
  } catch (err) {
    kubicLog.error("session-routes.js::Get sessions status error:", err);
    res.status(500).json({ error: "Failed to retrieve sessions status." });
  }
});

// Get viable sessions (sessions with enough connected players)
sessionRouter.get("/sessions/viable", (req, res) => {
  try {
    const viableSessions = sessionManager.getViableSessions();
    
    res.json({
      success: true,
      sessions: viableSessions,
      count: viableSessions.length
    });
  } catch (err) {
    kubicLog.error("session-routes.js::Get viable sessions error:", err);
    res.status(500).json({ error: "Failed to retrieve viable sessions." });
  }
});

// Clean up inactive sessions
sessionRouter.post("/sessions/cleanup", (req, res) => {
  const { maxInactiveTime } = req.body || {};
  
  try {
    const inactiveTime = maxInactiveTime || 30 * 60 * 1000; // 30 minutes default
    sessionManager.cleanupInactiveSessions(inactiveTime);
    
    const stats = sessionManager.getSessionStats();
    
    res.json({
      success: true,
      message: "Session cleanup completed",
      stats: stats
    });
  } catch (err) {
    kubicLog.error("session-routes.js::Session cleanup error:", err);
    res.status(500).json({ error: "Failed to cleanup sessions." });
  }
});

// Heartbeat endpoint for clients to confirm they're still alive
sessionRouter.post("/session/:sessionId/heartbeat", validateSessionMiddleware, validateParticipant(sessionManager), (req, res) => {
  const { participantId } = req.body;
  const session = req.gameSession;
  
  try {
    const participant = req.participant;
    
    // Update participant connection status
    session.updateParticipantConnection(participantId, true);
    
    res.json({
      success: true,
      timestamp: Date.now(),
      participant_id: participantId
    });
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
    
    // Mark participant as disconnected
    session.handleParticipantDisconnection(participantId);
    
    // Broadcast disconnection event
    GameEventService.broadcastToSession(session, {
      type: "kubic::participantDisconnected",
      payload: {
        participantId: participantId,
        participantName: participant.name,
        reason: reason,
        disconnectedAt: new Date().toISOString()
      }
    });
    
    res.json({
      success: true,
      message: `Participant ${participant.name} has been disconnected`,
      participant_id: participantId
    });
  } catch (err) {
    kubicLog.error("session-routes.js::Force disconnect error:", err);
    res.status(500).json({ error: "Failed to disconnect participant." });
  }
});

// Test session routes
sessionRouter.get("/session/test", (req, res) => {
  res.json({
    status: "session works",
  });
});

export default sessionRouter;

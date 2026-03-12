/**
 * Game flow orchestration system factory
 * Lightweight orchestrator that manages flow state and coordinates WebSocket event handlers
 *
 * Responsibilities:
 * - Session phase management (loading, error, initializing, lobby, ready, active, terminated)
 * - Game phase tracking (null, starting, active, ended)
 * - Auto-start logic with multiple modes (manual, immediate, on-ai, on-full)
 * - Event handler setup/teardown (delegates to specialized handler modules)
 * - Flow state coordination (winner tracking, phase transitions)
 *
 * Phase Architecture:
 * - Session phases track the session lifecycle (mirrors backend GameSession._started)
 * - Game phases track individual game instances (mirrors backend _gameInstance state)
 * - A session can host multiple sequential game instances
 */

import { createGameEventHandlers } from './handlers/game-event-handlers.js';
import { createSessionEventHandlers } from './handlers/session-event-handlers.js';
import { createConnectionEventHandlers } from './handlers/connection-event-handlers.js';
import { createInactivityEventHandlers } from './handlers/inactivity-event-handlers.js';
import { createVotingEventHandlers } from './handlers/voting-event-handlers.js';
import { createConfigEventHandlers } from './handlers/config-event-handlers.js';

export function createFlowState(helper) {
  // Create all handler modules
  const gameHandlers = createGameEventHandlers(helper);
  const sessionHandlers = createSessionEventHandlers(helper);
  const connectionHandlers = createConnectionEventHandlers(helper);
  const inactivityHandlers = createInactivityEventHandlers(helper);
  const votingHandlers = createVotingEventHandlers(helper);
  const configHandlers = createConfigEventHandlers(helper);

  return {
    // Flow state
    gamePhase: null, // null (no game), 'starting', 'active', 'ended'
    winner: null,
    autoStartEnabled: true,
    autoStartMode: "on-full", // 'on-ai': auto-start when AI joins, 'on-full': auto-start when full, 'manual': never auto-start, 'immediate': start immediately

    /**
     * Get current session phase
     * Tracks the session lifecycle (not individual games)
     * @returns {string} Current session phase
     */
    getSessionPhase: () => {
      // Loading/error states take priority
      if (helper.session.isSessionLoading || helper.game.isGameLoading) {
        return "loading";
      }

      if (helper.session.sessionError || helper.game.gameError) {
        return "error";
      }

      // Session lifecycle phases
      if (!helper.sessionId) {
        return "initializing";
      }

      if (!helper.participantId) {
        return "lobby"; // In lobby but not joined yet
      }

      const playableCount = helper.session.getPlayableParticipants().length;

      if (playableCount < helper.session.maxPlayers) {
        return "lobby"; // In lobby, waiting for more players
      }

      // Session is active (can play games)
      return "active";
    },

    /**
     * Get current game phase
     * Tracks individual game instance state
     * @returns {string|null} Current game phase (null if no game)
     */
    getGamePhase: () => {
      return helper.flow.gamePhase;
    },

    /**
     * Check if conditions are met for auto-starting the game
     * @returns {boolean} True if game should auto-start
     */
    shouldAutoStart: () => {
      if (!helper.flow.autoStartEnabled) {
        return false;
      }
      if (helper.game.started) {
        return false;
      }

      const playableParticipants = helper.session.getPlayableParticipants();
      const playableCount = playableParticipants.length;

      // Check based on auto-start mode
      switch (helper.flow.autoStartMode) {
        case "manual":
          // Never auto-start - requires manual intervention
          return false;

        case "immediate":
          // Start as soon as session has at least one participant
          return playableCount >= 1;

        case "on-ai":
          // Auto-start only when an AI opponent joins
          const hasAI = playableParticipants.some(
            (p) => p.type === "computer"
          );
          return hasAI && playableCount === helper.session.maxPlayers;

        case "on-full":
        default:
          // Auto-start when max players reached (original behavior)
          return playableCount === helper.session.maxPlayers;
      }
    },

    /**
     * Check and auto-start game if conditions are met
     * Called automatically when participants change
     * @returns {Promise<void>}
     */
    checkAndAutoStart: async () => {
      if (!helper.flow.shouldAutoStart()) {
        return;
      }

      // Check if current participant is playable
      const currentParticipant = helper.session.getParticipant(
        helper.participantId
      );
      if (
        !currentParticipant ||
        (currentParticipant.type !== "user" &&
          currentParticipant.type !== "computer")
      ) {
        return;
      }

      try {
        const result = await helper.startGame();
        if (result.success) {
          helper.events.emit("gameAutoStarted");
        } else {
          console.error("[KubicKode.flow] Auto-start failed:", result.error);
        }
      } catch (error) {
        console.error("[KubicKode.flow] Auto-start error:", error);
      }
    },

    /**
     * Configure flow settings
     * @param {Object} options - Configuration options
     * @param {boolean} options.autoStartEnabled - Enable/disable auto-start
     * @param {string} options.autoStartMode - Auto-start mode: "on-ai", "on-full", "manual", "immediate"
     */
    configure: (options = {}) => {
      if (options.autoStartEnabled !== undefined) {
        helper.flow.autoStartEnabled = options.autoStartEnabled;
      }
      if (options.autoStartMode !== undefined) {
        const validModes = ["on-ai", "on-full", "manual", "immediate"];
        if (validModes.includes(options.autoStartMode)) {
          helper.flow.autoStartMode = options.autoStartMode;
        }
      }
    },

    /**
     * Get current flow state
     * @returns {Object} Current flow state with session and game phases
     */
    getState: () => ({
      sessionPhase: helper.flow.getSessionPhase(),
      gamePhase: helper.flow.getGamePhase(),
      winner: helper.flow.winner,
      autoStartEnabled: helper.flow.autoStartEnabled,
      autoStartMode: helper.flow.autoStartMode,
    }),

    /**
     * Reset flow state
     */
    reset: () => {
      helper.flow.gamePhase = null;
      helper.flow.winner = null;
      helper.events.emit("flowReset");
    },

    /**
     * Setup all WebSocket event handlers for game flow
     * Call this once after connecting WebSocket to automatically handle all game events
     * @returns {KubicKodeHelper} This instance for chaining
     */
    setupEventHandlers: () => {
      // Game lifecycle events (6 handlers)
      helper.events.on("kubic::playerWon", gameHandlers.handlePlayerWon);
      helper.events.on("kubic::gameTied", gameHandlers.handleGameTied);
      helper.events.on("kubic::gameStopped", gameHandlers.handleGameStopped);
      helper.events.on("kubic::turnPlayed", gameHandlers.handleTurnPlayed);
      helper.events.on("kubic::gameStarted", gameHandlers.handleGameStarted);
      helper.events.on("kubic::winCount", gameHandlers.handleWinCount);

      // Session lifecycle events (4 handlers)
      helper.events.on("kubic::sessionEnded", sessionHandlers.handleSessionEnded);
      helper.events.on("kubic::sessionParticipantJoined", sessionHandlers.handleSessionParticipantJoined);
      helper.events.on("kubic::sessionSpectatorJoined", sessionHandlers.handleSessionSpectatorJoined);
      helper.events.on("kubic::sessionParticipantLeft", sessionHandlers.handleSessionParticipantLeft);

      // Connection lifecycle events (4 handlers)
      helper.events.on("kubic::participantDisconnected", connectionHandlers.handleParticipantDisconnected);
      helper.events.on("kubic::participantRemoved", connectionHandlers.handleParticipantRemoved);
      helper.events.on("kubic::participantReconnected", connectionHandlers.handleParticipantReconnected);
      helper.events.on("kubic::connectionConfirmed", connectionHandlers.handleConnectionConfirmed);

      // Inactivity events (2 handlers)
      helper.events.on("kubic::timeLeft", inactivityHandlers.handleTimeLeft);
      helper.events.on("kubic::playerInactive", inactivityHandlers.handlePlayerInactive);

      // Restart voting events (3 handlers)
      helper.events.on("kubic::restartVoteStarted", votingHandlers.handleRestartVoteStarted);
      helper.events.on("kubic::restartVoteUpdate", votingHandlers.handleRestartVoteUpdate);
      helper.events.on("kubic::restartVoteResult", votingHandlers.handleRestartVoteResult);

      // Config events (2 handlers)
      helper.events.on("kubic::lobbyConfigUpdated", configHandlers.handleLobbyConfigUpdated);
      helper.events.on("kubic::lobbyConfigDeleted", configHandlers.handleLobbyConfigDeleted);

      return helper;
    },

    /**
     * Remove all WebSocket event handlers
     * Call this when disconnecting to clean up
     * @returns {KubicKodeHelper} This instance for chaining
     */
    teardownEventHandlers: () => {
      // Game lifecycle events
      helper.events.off("kubic::playerWon", gameHandlers.handlePlayerWon);
      helper.events.off("kubic::gameTied", gameHandlers.handleGameTied);
      helper.events.off("kubic::gameStopped", gameHandlers.handleGameStopped);
      helper.events.off("kubic::turnPlayed", gameHandlers.handleTurnPlayed);
      helper.events.off("kubic::gameStarted", gameHandlers.handleGameStarted);
      helper.events.off("kubic::winCount", gameHandlers.handleWinCount);

      // Session lifecycle events
      helper.events.off("kubic::sessionEnded", sessionHandlers.handleSessionEnded);
      helper.events.off("kubic::sessionParticipantJoined", sessionHandlers.handleSessionParticipantJoined);
      helper.events.off("kubic::sessionSpectatorJoined", sessionHandlers.handleSessionSpectatorJoined);
      helper.events.off("kubic::sessionParticipantLeft", sessionHandlers.handleSessionParticipantLeft);

      // Connection lifecycle events
      helper.events.off("kubic::participantDisconnected", connectionHandlers.handleParticipantDisconnected);
      helper.events.off("kubic::participantRemoved", connectionHandlers.handleParticipantRemoved);
      helper.events.off("kubic::participantReconnected", connectionHandlers.handleParticipantReconnected);
      helper.events.off("kubic::connectionConfirmed", connectionHandlers.handleConnectionConfirmed);

      // Inactivity events
      helper.events.off("kubic::timeLeft", inactivityHandlers.handleTimeLeft);
      helper.events.off("kubic::playerInactive", inactivityHandlers.handlePlayerInactive);

      // Restart voting events
      helper.events.off("kubic::restartVoteStarted", votingHandlers.handleRestartVoteStarted);
      helper.events.off("kubic::restartVoteUpdate", votingHandlers.handleRestartVoteUpdate);
      helper.events.off("kubic::restartVoteResult", votingHandlers.handleRestartVoteResult);

      // Config events
      helper.events.off("kubic::lobbyConfigUpdated", configHandlers.handleLobbyConfigUpdated);
      helper.events.off("kubic::lobbyConfigDeleted", configHandlers.handleLobbyConfigDeleted);

      return helper;
    },
  };
}

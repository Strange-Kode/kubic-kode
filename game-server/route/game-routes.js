import express from "express";
import { sessionManager } from "../session-manager.js"; // Holds all active GameSession instances
import { GameEventService } from "../game-event-service.js";
import { InactivityManager } from "../../game-utility/inactivity-manager.js";

const gameRouter = express.Router();

import { serializeRecursively } from "../../game-utility/game-utility.js";

gameRouter.get("/game/start/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();
  const sessionParticipants = gameSession.getParticipants();

  if (gameInstance.getGameEngine().isGameStarted()) {
    const currentPlayer = gameInstance.getGameEngine().getCurrentPlayer();
    return res.json({
      current_player_id: currentPlayer.getPlayerId(),
      game_started: true,
      status: "Game already previously started",
    });
  }

  // Step 1: Add participants as players to your game
  const playerMappings = {}
  for (let i = 0; i < sessionParticipants.length; i++) {
    let participant = sessionParticipants[i];
    let player = gameInstance.addPlayer(participant.name);
    playerMappings[participant.id] = player;
  }

  // Step 2: Start the game session (if not already started)
  gameSession.markStarted();

  // Step 3: Start the game instance
  gameInstance.startGame();

  // Step 4: Return the current player
  const currentPlayer = gameInstance.getGameEngine().getCurrentPlayer();
  res.json({
    current_player_id: currentPlayer.getPlayerId(),
    game_started: true,
    status: "New game created",
  });

  GameEventService.broadcastToSession(gameSession, {
    type: "gameStarted",
    payload: { playerMappings: serializeRecursively(playerMappings) },
  });
});

gameRouter.get("/game/stop/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();

  if (!gameInstance.getGameEngine().isGameStarted()) {
    return res.status(200).json({
      game_stopped: true,
      message: "Game was already stopped",
    });
  }

  gameInstance.getGameEngine().stopGame();

  res.json({
    game_stopped: true,
  });

  GameEventService.broadcastToSession(gameSession, {
    type: "gameStopped",
  });
});

// Used to get current turn (=> current player id)
gameRouter.get("/game/get-current-player/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();

  res.json({
    current_player_id: gameInstance
      .getGameEngine()
      .getCurrentPlayer()
      .getPlayerId(),
  });
});

gameRouter.get("/game/is-active/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();

  res.json({
    is_active: gameInstance.getGameEngine().isGameStarted(),
  });
});

gameRouter.get("/game/get-tilemap/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();

  res.json(serializeRecursively(gameInstance.getGameEngine().getTileMap()));
});

export default gameRouter;

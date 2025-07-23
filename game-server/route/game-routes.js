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

  const response = {};
  if (gameInstance.getGameEngine().isGameStarted()) {
    response.game_started = true;
    response.status = "Game already previously started";
    const currentPlayers = gameInstance.getGameEngine().getCurrentTurnPlayers();
    if (gameInstance.engine.getPlayStyle() === "single-set") {
      response.current_player_id = currentPlayers.getPlayerId();
    }
    else {
      response.current_turn_players = currentPlayers;
    }
    return res.json(response);
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
  if (gameInstance.getGameEngine().getPlayStyle() === "single-set") {
    response.current_player_id = currentPlayers.getPlayerId();
  }
  else {
    const currentPlayers = gameInstance.getGameEngine().getCurrentTurnPlayers();
    response.current_turn_players = currentPlayers;
  }
  res.json(response);

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

// Used to get current turn (=> current player id) (only used for single-set for legacy reasons)
// @deprecated (use /game/get-current-players/:sessionId instead)
gameRouter.get("/game/get-current-player/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();
  const gameEngine = gameInstance.getGameEngine();
  const playStyle = gameEngine.playStyle;
  res.json({
    play_style: playStyle,
    current_player_id: gameEngine.getCurrentPlayer().getPlayerId(),
  });
});

// Used to get current turn (=> current player ids)
gameRouter.get("/game/get-current-players/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();
  const gameEngine = gameInstance.getGameEngine();
  const playStyle = gameEngine.playStyle;
  const currentTurnPlayers = gameEngine.getCurrentTurnPlayers();
  res.json({
    play_style: playStyle,
    current_turn_players: currentTurnPlayers,
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

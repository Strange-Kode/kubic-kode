import express from "express";
import { sessionManager } from "./session-manager.js"; // Holds all active GameSession instances

const gameRouter = express.Router();

import { serializeRecursively } from "../game-utility.js";

gameRouter.get("/game/start/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();
  const sessionParticipants = gameSession.getParticipants();

  if (gameInstance.getGameEngine().isGameStarted()) {
    const currentPlayer = gameInstance.getGameEngine().getCurrentPlayer();
    return res.json({
      current_player_id: currentPlayer.id,
      game_started: true,
      status: "game already previously started",
    });
  }

  // Step 1: Add participants as players to your game
  for (let i = 0; i < sessionParticipants.length; i++) {
    let participant = sessionParticipants[i];
    gameInstance.addPlayer(participant.name);
  }

  // Step 2: Start the game session
  gameSession.markStarted();

  // Step 3: Start the game instance
  gameInstance.startGame();

  // Step 4: Return the current player
  const currentPlayer = gameInstance.getGameEngine().getCurrentPlayer();
  res.json({
    current_player_id: currentPlayer.id,
    game_started: true,
    status: "new game created",
  });
});

gameRouter.get("/game/stop/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();

  if (!gameInstance.getGameEngine().isGameStarted()) {
    throw new Error(
      `Attempting to stop unstarted game with session id: ${sessionId}`
    );
  }

  // Step 1: End the game session
  gameSession.markEnded();

  // Step 2: Stop the game instance
  gameInstance.getGameEngine().stopGame();

  res.json({
    game_stopped: true,
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

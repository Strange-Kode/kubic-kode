import express from 'express';
import { sessionManager } from './session-manager.js';  // Holds all active GameSession instances
import { gameRegistry } from './game-server/game-registry.js';

const gameRouter = express.Router();

gameRouter.get('/game/start/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    const gameSession = sessionManager.getSession(sessionId);
    const gameInstance = gameSession.getGameInstance();
    const sessionParticipants = gameSession.getParticipants();
    
    // Step 1: Add participants as players to your game
    for (let i = 0; i < sessionParticipants; i++) {
        let participant = sessionParticipants[i];
        gameInstance.addPlayer(participant.name);
    }
    
    // Step 2: Start the game session
    gameSession.markStarted();
        
        
    // Step 3: Start the game instance
    gameInstance.startGame();
    
    // Step 4: Return the current player
    const currentPlayer = gameInstance.getCurrentPlayer();
    res.json({
        current_player_id: currentPlayer.getPlayerId(),
        game_started: true
    });
    
});

gameRouter.get('/game/stop/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const gameSession = sessionManager.getSession(sessionId);
    const gameInstance = gameSession.getGameInstance();
    
    // Step 1: Stop the game session
    gameSession.markEnded();
    
    // Step 2: Stop the game instance
    gameInstance.stopGame();
    
    res.json({
        game_stopped: true
    });
});

export default gameRouter;

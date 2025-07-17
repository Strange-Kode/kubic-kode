import express from 'express';
import { sessionManager } from './session-manager.js';  // Holds all active GameSession instances
import { InactivityManager } from '../game-utility/inactivity-manager.js';

const gameRouter = express.Router();

gameRouter.get('/game/start/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    
    const gameSession = sessionManager.getSession(sessionId);
    const gameInstance = gameSession.getGameInstance();
    const sessionParticipants = gameSession.getParticipants();
    
    if (gameInstance.getGameEngine().isGameStarted()) {
        return res.json({
            current_player_id: currentPlayer.getPlayerId(),
            game_started: true,
            status: 'game already previously started'
        });
    }
    
    // Step 1: Add participants as players to your game
    for (let i = 0; i < sessionParticipants; i++) {
        let participant = sessionParticipants[i];
        gameInstance.addPlayer(participant.name);
    }
    
    // Step 2: Start the game session
    gameSession.markStarted();
        
    // Step 3: Start the game instance
    gameInstance.startGame();
    
    // Step 5: Return the current player
    const currentPlayer = gameInstance.getCurrentPlayer();
    res.json({
        current_player_id: currentPlayer.getPlayerId(),
        game_started: true,
        status: 'new game created'
    });
});

gameRouter.get('/game/stop/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const gameSession = sessionManager.getSession(sessionId);
    const gameInstance = gameSession.getGameInstance();
    
    if (!gameInstance.getGameEngine().isGameStarted()) {
        throw new Error(`Attempting to stop unstarted game with session id: ${sessionId}`);
    }
    
    // Step 1: End the game session
    gameSession.markEnded();
    
    // Step 2: Stop the game instance
    gameInstance.stopGame();
    
    res.json({
        game_stopped: true
    });
});

// Used to get current turn (=> current player id)
gameRouter.get('/game/get-current-player/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const gameSession = sessionManager.getSession(sessionId);
    const gameInstance = gameSession.getGameInstance();
    
    res.json({
        current_player_id: gameInstance.getGameEngine().getCurrentPlayer().id
    });
});

gameRouter.get('/game/is-active/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const gameSession = sessionManager.getSession(sessionId);
    const gameInstance = gameSession.getGameInstance();
    
    res.json({
        is_active: gameInstance.getGameEngine().isGameStarted()
    });
});

export default gameRouter;

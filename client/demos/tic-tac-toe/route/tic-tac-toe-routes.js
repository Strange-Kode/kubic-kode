import express from 'express';
import { sessionManager } from '../../../../game-server/session-manager.js';  // Holds all active GameSession instances
import { gameRegistry } from '../../../../game-server/game-registry.js';

import { GameEventService } from '../../../../game-server/game-event-service.js';

const ticTacToeRouter = express.Router();

// Plays turn and returns game state of the player round (e.g. did current player win?)
// round status also contains if move is invalid
ticTacToeRouter.post('/tic-tac-toe/play-turn/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { playerId, xPos, yPos } = req.body;
    
    // TODO: Add validation to playerId (is it playerIds turn to play?)
    
    const gameSession = sessionManager.getSession(sessionId);
    const gameInstance = gameSession.getGameInstance();
    
    let roundStatus = gameInstance.playTurn(xPos, yPos);
    GameEventService.broadcastToSession(sessionId, {
        type: 'turnPlayed',
        payload: { roundStatus }
    });
    res.json(round_status);
});

export default ticTacToeRouter;

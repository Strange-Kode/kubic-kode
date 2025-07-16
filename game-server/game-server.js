import express from 'express';
const app = express();
const PORT = 3000;

import sessionRouter from './session-routes.js';
import gameRouter from './game-routes.js';
import { gameRegistry } from './game-server/game-registry.js';
import { TicTacToeGame, ticTacToeRouter } from '../client/demo/tic-tac-toe/tic-tac-toe.js';

function TicTacToeClassicFactory(sessionId) {
    return new TicTacToeGame({ sessionId, gridSize: 3, winCondition: 3 });
}

function TicTacToe5x5Factory(sessionId) {
    return new TicTacToeGame({ sessionId, gridSize: 5, winCondition: 4 });
}

const gameRouters = [
    { path: '/api/tic-tac-toe', router: ticTacToeRouter }
];

// List of known games
gameRegistry.register('tic-tac-toe-classic', TicTacToeClassicFactory);
gameRegistry.register('tic-tac-toe-5x5', TicTacToe5x5Factory);

// Middleware to parse JSON bodies
app.use(express.json());

// Register the routers
app.use('/api', sessionRouter);
app.use('/api', gameRouter);

// Dynamically register game specific routers
gameRouters.forEach(({ path, router }) => {
    app.use(path, router);
});

app.get('/', (req, res) => {
    res.send('It works!');
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

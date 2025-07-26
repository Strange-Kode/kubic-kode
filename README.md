# kubic-kode

**kubic-kode** is a modular 2D turn-based tilemap game engine, built for rapid development of grid-based games such as strategy, puzzle, and board games. It provides core abstractions for tilemaps, turn sequencing, and game state management.

The project features a Node.js/Express backend for multiplayer session handling and real-time communication via WebSockets, alongside a React-based frontend demo (e.g., tic-tac-toe) to illustrate integration and usage. kubic-kode is designed for extensibility, enabling developers to prototype and deploy custom turn-based games with minimal setup.

## Requirements

- [Node.js](https://nodejs.org/) (version 20.x or later recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- Git (for cloning the repository)

## Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/Strange-Kode/kubic-kode.git
   cd kubic-kode
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Copy and configure the environment file for the React demo:
   ```sh
   cp client/demos/react-tic-tac-toe/.env.example client/demos/react-tic-tac-toe/.env
   # Edit client/demos/react-tic-tac-toe/.env as needed
   ```

## Usage

### Start the Backend
Run the backend server (default port: 3000):
```sh
npm run dev-server
```

### Start the Frontend Demo
In a separate terminal, start the React demo (default port: 3001):
```sh
npm run start-frontend
```

The frontend will be available at [http://localhost:3001](http://localhost:3001) and will communicate with the backend at [http://localhost:3000](http://localhost:3000).

## Game Options System

kubic-kode includes a flexible game options system that allows games to define which options are configurable and which are frozen (constant).

### Game Options Types

1. **Configurable Options**: Can be changed by clients through the API
2. **Frozen Options**: Cannot be changed and are part of the game's core rules

### Available Game Variants

- **tic-tac-toe-classic**: Standard 3x3 TicTacToe (gridSize and winCondition are frozen)
- **tic-tac-toe-configurable**: Configurable grid size (3-10) and win condition

### API Endpoints

#### Get Game Options
```bash
GET /api/game/options/:sessionId
```

Returns information about available game options:
```json
{
  "available": true,
  "configurable": {
    "gridSize": 3,
    "winCondition": 3
  },
  "frozen": {},
  "metadata": {
    "gridSize": {
      "type": "configurable",
      "defaultValue": 3,
      "validator": "function(value) { ... }"
    }
  }
}
```

#### Start Game with Options
```bash
POST /api/game/start/:sessionId
Content-Type: application/json

{
  "gridSize": 5,
  "winCondition": 4
}
```

### Example Usage

1. **Create a session with configurable TicTacToe**:
   ```bash
   POST /api/session/init/tic-tac-toe-configurable
   ```

2. **Check available options**:
   ```bash
   GET /api/game/options/:sessionId
   ```

3. **Start game with custom options**:
   ```bash
   POST /api/game/start/:sessionId
   {
     "gridSize": 5,
     "winCondition": 4
   }
   ```

### Error Handling

If invalid options are provided, the API returns:
```json
{
  "error": true,
  "message": "Invalid game options",
  "details": [
    "Option 'gridSize' is frozen and cannot be changed from 3 to 5"
  ],
  "ignored": [
    "Unknown option 'unknownOption'"
  ]
}
```

## Architecture

### Core Components

- **Game Engine**: Manages turn sequencing, player entities, and tile maps
- **Game Interface**: Contract that all games must implement
- **Game Options**: System for managing configurable and frozen game options
- **Session Management**: Handles multiplayer sessions and participant management
- **WebSocket Communication**: Real-time game state updates

### Game Development

To create a new game:

1. Implement the `GameInterface` contract
2. Define game options using the `GameOptions` class
3. Register the game with the `GameRegistry`
4. Create game-specific routes if needed

Example game options definition:
```javascript
// Frozen options (cannot be changed)
this.gameOptions.addFrozen('gridSize', 3);

// Configurable options with validation
this.gameOptions.addConfigurable('maxRounds', 10, (value) => {
  if (value < 1 || value > 100) {
    return 'Max rounds must be between 1 and 100';
  }
  return true;
});
```

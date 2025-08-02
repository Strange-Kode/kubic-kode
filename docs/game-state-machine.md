# Game State Machine (GSM)

kubic-kode includes an optional **Game State Machine (GSM)** for complex games that require structured state management, multiple screens, transitions, pause/resume functionality, inventory systems, or multiple game phases.

## When to Use GSM

**Use GSM for complex games with:**
- Multiple screens/phases (menu, gameplay, pause, game over)
- Complex transitions (intro sequences, cutscenes)
- Inventory/character management systems
- Game scenes and pause/resume functionality
- Multiple game modes or states

**Use procedural code for simple games with:**
- Single gameplay screen
- Direct game logic without complex state management
- Minimal transitions between screens

## Enabling GSM

Enable the Game State Machine when creating your GameEngine:

```javascript
// Simple game (procedural)
const engine = new GameEngine(3, 3);

// Complex game (with GSM)
const engine = new GameEngine(50, 50, { useStateMachine: true });
```

The setup script (`node game-script/setup-game.js`) will automatically recommend GSM based on your game's complexity and configure it accordingly.

## Core GSM Classes

### GameState
```javascript
import { GameState } from "kubic-kode";

class MenuState extends GameState {
  constructor(stateMachine) {
    super("menu", stateMachine);
  }

  async onEnter(fromState, data = {}) {
    await super.onEnter(fromState, data);
    // Show menu UI, load menu assets, etc.
  }

  async onExit(toState, data = {}) {
    // Hide menu UI, cleanup, etc.
    await super.onExit(toState, data);
  }

  handlePlayerAction(playerId, action, data) {
    if (action === "start_game") {
      this.getStateMachine().transitionTo("gameplay");
    }
  }
}
```

### StateTransition
```javascript
import { StateTransition } from "kubic-kode";

// Automatic transition when game ends
const gameEndTransition = new StateTransition(
  "gameplay", 
  "game_over", 
  (context) => context.gameEnded === true,
  { automatic: true }
);

// Manual transition triggered by player action
const pauseTransition = new StateTransition(
  "gameplay",
  "paused",
  (context) => context.pauseRequested === true
);
```

## GSM Tic-Tac-Toe Example

Here's how the built-in tic-tac-toe could be implemented using GSM:

```javascript
import { GameEngine, GameState, StateTransition, GameStateMachine } from "kubic-kode";
import PlayerEntity from "./game-entity/player-entity.js";

// Game States
class MenuState extends GameState {
  constructor(stateMachine) {
    super("menu", stateMachine);
  }

  async onEnter(fromState, data = {}) {
    await super.onEnter(fromState, data);
    console.log("📋 Game Menu - Ready to start!");
  }

  handlePlayerAction(playerId, action, data) {
    if (action === "start_game") {
      this.getStateMachine().transitionTo("gameplay", { playerId });
    }
  }
}

class GameplayState extends GameState {
  constructor(stateMachine) {
    super("gameplay", stateMachine);
    this._winner = null;
  }

  async onEnter(fromState, data = {}) {
    await super.onEnter(fromState, data);
    const engine = this.getStateMachine().getGameEngine();
    engine.resetTileMap();
    engine.startGame();
    console.log("🎮 Game Started!");
  }

  handlePlayerAction(playerId, action, data) {
    if (action === "make_move") {
      const result = this._playMove(playerId, data.x, data.y);
      
      if (result.player_has_won) {
        this._winner = result.player_id;
        this.getStateMachine().setGlobalData("winner", this._winner);
        this.getStateMachine().setGlobalData("gameEnded", true);
      } else if (action === "pause_game") {
        this.getStateMachine().transitionTo("paused");
      }
    }
  }

  _playMove(playerId, x, y) {
    const engine = this.getStateMachine().getGameEngine();
    const currentPlayer = engine.getPlayerById(playerId);
    
    if (engine.getTileMap().getTile(x, y)) {
      return { status: "invalid", type: "occupied_tile", player_has_won: false };
    }

    const mark = currentPlayer.placeMark({ x, y });
    engine.getTileMap().setTile(x, y, mark);

    if (this._checkWinCondition(mark)) {
      engine.stopGame();
      return { status: "ok", player_has_won: true, player_id: playerId };
    }
    
    engine.nextTurn();
    return { status: "ok", player_has_won: false, player_id: playerId };
  }

  _checkWinCondition(lastMark) {
    // Win condition logic (same as procedural version)
    return false; // Simplified for example
  }
}

class PausedState extends GameState {
  constructor(stateMachine) {
    super("paused", stateMachine);
  }

  async onEnter(fromState, data = {}) {
    await super.onEnter(fromState, data);
    console.log("⏸️ Game Paused");
  }

  handlePlayerAction(playerId, action, data) {
    if (action === "resume_game") {
      this.getStateMachine().transitionTo("gameplay");
    } else if (action === "quit_game") {
      this.getStateMachine().transitionTo("menu");
    }
  }
}

class GameOverState extends GameState {
  constructor(stateMachine) {
    super("game_over", stateMachine);
  }

  async onEnter(fromState, data = {}) {
    await super.onEnter(fromState, data);
    const winner = this.getStateMachine().getGlobalData("winner");
    console.log(`🏆 Game Over! Winner: ${winner || "Draw"}`);
  }

  handlePlayerAction(playerId, action, data) {
    if (action === "play_again") {
      this.getStateMachine().transitionTo("gameplay");
    } else if (action === "main_menu") {
      this.getStateMachine().transitionTo("menu");
    }
  }
}

// Main Game Class
class TicTacToeGSMGame {
  constructor() {
    // Enable GSM in engine
    this._engine = new GameEngine(3, 3, { 
      playStyle: "single-set", 
      useStateMachine: true 
    });
    
    this._setupStateMachine();
  }

  _setupStateMachine() {
    const gsm = this._engine.getStateMachine();
    
    // Add states
    gsm.addState(new MenuState(gsm))
       .addState(new GameplayState(gsm))
       .addState(new PausedState(gsm))
       .addState(new GameOverState(gsm));

    // Add transitions
    gsm.addSimpleTransition("menu", "gameplay", 
        (context) => context.gameStartRequested === true)
       .addSimpleTransition("gameplay", "paused", 
        (context) => context.pauseRequested === true)
       .addSimpleTransition("paused", "gameplay", 
        (context) => context.resumeRequested === true)
       .addSimpleTransition("gameplay", "game_over", 
        (context) => context.gameEnded === true, 
        { automatic: true })
       .addSimpleTransition("game_over", "menu", 
        (context) => context.returnToMenu === true);

    // Set initial state
    gsm.setInitialState("menu");
  }

  getGameEngine() {
    return this._engine;
  }

  playTurn(playerId, x, y, metadata = {}) {
    // Forward to state machine
    this._engine.handlePlayerAction(playerId, "make_move", { x, y, ...metadata });
    
    // Return appropriate response based on current state
    const currentState = this._engine.getCurrentGameState();
    const winner = this._engine.getStateMachine().getGlobalData("winner");
    
    return {
      status: "ok",
      player_has_won: !!winner,
      player_id: playerId,
      current_state: currentState?.getName()
    };
  }

  // Additional GSM-specific methods
  pauseGame() {
    this._engine.getStateMachine().setGlobalData("pauseRequested", true);
  }

  resumeGame() {
    this._engine.getStateMachine().setGlobalData("resumeRequested", true);
  }

  getCurrentState() {
    return this._engine.getCurrentGameState()?.getName();
  }
}
```

## GSM API Reference

### GameStateMachine Methods

#### Core State Management
- `addState(state)` - Register a new state
- `getState(stateName)` - Get a state by name
- `getAllStates()` - Get all registered states
- `getCurrentState()` - Get current active state
- `getPreviousState()` - Get previous state
- `setInitialState(stateName)` - Set starting state
- `transitionTo(stateName, data)` - Transition to new state

#### Transitions
- `addTransition(transition)` - Add a state transition
- `addSimpleTransition(from, to, condition, options)` - Add transition (convenience method)
- `triggerTransition(toState, context)` - Manually trigger transition
- `checkAutomaticTransitions(context)` - Check/execute automatic transitions

#### State Machine Control
- `update(deltaTime)` - Update state machine (call every frame)
- `pause()` - Pause the state machine
- `resume()` - Resume the state machine
- `isPaused()` - Check if paused
- `reset()` - Reset state machine

#### Event and Action Handling
- `handleEvent(eventType, eventData)` - Handle game events
- `handlePlayerAction(playerId, action, data)` - Handle player actions

#### Data Management
- `setGlobalData(key, value)` - Set global shared data
- `getGlobalData(key)` - Get global data
- `getAllGlobalData()` - Get all global data
- `getStateHistory()` - Get state transition history
- `goBack(data)` - Return to previous state

### GameState Methods

#### Lifecycle Methods (Override in subclasses)
- `onEnter(fromState, data)` - Called when entering state
- `onExit(toState, data)` - Called when exiting state
- `update(deltaTime)` - Called each frame while active
- `handleEvent(eventType, eventData)` - Handle game events
- `handlePlayerAction(playerId, action, data)` - Handle player actions

#### Utility Methods
- `getName()` - Get state name
- `getStateMachine()` - Get parent state machine
- `isActive()` - Check if state is currently active

### StateTransition

#### Constructor
```javascript
new StateTransition(fromState, toState, condition, options)
```

#### Options
- `priority` - Transition priority (higher = checked first)
- `data` - Data to pass during transition
- `automatic` - Whether transition happens automatically when condition is met

## GSM Benefits

1. **Organized Code Structure**: Clear separation of concerns for each game phase
2. **Easy State Management**: Built-in state tracking and transitions
3. **Pause/Resume Support**: Automatic pause state handling
4. **Event-Driven Design**: Clean event handling per state
5. **Debugging**: Clear state history and transition logging
6. **Extensibility**: Easy to add new states and transitions

## GSM vs Procedural Comparison

| Feature | Procedural | GSM |
|---------|------------|-----|
| **Code Structure** | Linear, method-based | State-based, organized |
| **Complexity** | Low overhead | Higher abstraction |
| **Transitions** | Manual if/else logic | Automatic transition system |
| **Pause/Resume** | Manual implementation | Built-in support |
| **Event Handling** | Centralized | Per-state handling |
| **Best For** | Simple games | Complex games with multiple phases |

Choose GSM when your game needs structured state management; use procedural code for straightforward, single-screen games.

## Best Practices

### State Design
- Keep states focused on a single responsibility
- Use descriptive state names (`"main_menu"`, `"gameplay"`, `"paused"`)
- Implement proper cleanup in `onExit()` methods

### Transitions
- Use automatic transitions for predictable state changes
- Use manual transitions for user-triggered actions
- Set appropriate priorities for overlapping transition conditions

### Data Management
- Use global data for information needed across multiple states
- Keep state-specific data within the state class
- Use transition data for temporary information during state changes

### Error Handling
- Always check if GSM is enabled before using state machine methods
- Handle cases where transitions might fail
- Implement fallback behaviors for unexpected states
# KubicKode Error System

The KubicKode Error System provides a comprehensive, standardized approach to error handling throughout the codebase. It consists of a base `KubicKodeError` class and specialized subclasses for different error types, along with utility functions and error codes.

## Overview

The error system is designed to:

- Provide consistent error handling across the entire codebase
- Include contextual information for better debugging
- Support different severity levels (error, warn, info)
- Integrate with the existing `kubicLog` system
- Generate standardized API responses
- Enable easy error categorization and handling

## Base Class: KubicKodeError

The `KubicKodeError` class extends the standard `Error` class and adds:

- **Error codes**: Categorized error identifiers
- **Context**: Additional metadata about the error
- **Timestamp**: When the error occurred
- **Severity**: Error importance level
- **Automatic logging**: Integration with kubicLog
- **Response formatting**: Standardized API responses

### Basic Usage

```javascript
import { KubicKodeError } from '../game-engine/kubic-kode-error.js';

// Create a basic error
throw new KubicKodeError("Something went wrong", {
  code: "CUSTOM_ERROR",
  context: { userId: 123, action: "login" },
  severity: "error"
});
```

## Specialized Error Classes

### KubicValidationError

For input validation failures.

```javascript
import { KubicValidationError } from '../game-engine/kubic-kode-error.js';

throw new KubicValidationError(
  "Invalid email format",
  "email",
  "invalid-email",
  { context: { form: "registration" } }
);
```

### KubicSessionError

For session-related issues.

```javascript
import { KubicSessionError } from '../game-engine/kubic-kode-error.js';

throw new KubicSessionError(
  "Session not found",
  "session-123",
  { context: { action: "join" } }
);
```

### KubicGameError

For game-specific issues.

```javascript
import { KubicGameError } from '../game-engine/kubic-kode-error.js';

throw new KubicGameError(
  "Invalid move",
  "tic-tac-toe",
  1,
  { context: { position: { x: 5, y: 5 } } }
);
```

### KubicParticipantError

For participant-related issues.

```javascript
import { KubicParticipantError } from '../game-engine/kubic-kode-error.js';

throw new KubicParticipantError(
  "Participant name already exists",
  1,
  "Alice",
  { context: { sessionId: "session-123" } }
);
```

### KubicAuthenticationError

For authentication and authorization issues.

```javascript
import { KubicAuthenticationError } from '../game-engine/kubic-kode-error.js';

throw new KubicAuthenticationError(
  "Invalid game token",
  "token-123",
  { context: { endpoint: "/api/game/play-turn" } }
);
```

### KubicNetworkError

For network and communication issues.

```javascript
import { KubicNetworkError } from '../game-engine/kubic-kode-error.js';

throw new KubicNetworkError(
  "Connection timeout",
  "http://localhost:4000/api/session",
  408,
  { context: { retryAttempt: 3 } }
);
```

### KubicStateError

For state machine issues.

```javascript
import { KubicStateError } from '../game-engine/kubic-kode-error.js';

throw new KubicStateError(
  "Invalid state transition",
  "waiting",
  "started",
  { context: { gameId: "tic-tac-toe" } }
);
```

### KubicNotFoundError

For resource not found issues.

```javascript
import { KubicNotFoundError } from '../game-engine/kubic-kode-error.js';

throw new KubicNotFoundError(
  "Game variant not found",
  "game_variant",
  "unknown-game",
  { context: { availableVariants: ["tic-tac-toe", "connect-four"] } }
);
```

### KubicConflictError

For resource conflicts.

```javascript
import { KubicConflictError } from '../game-engine/kubic-kode-error.js';

throw new KubicConflictError(
  "Game variant already registered",
  "game_variant",
  "tic-tac-toe",
  { context: { existingFactory: "TicTacToeGame" } }
);
```

### KubicPermissionError

For access control issues.

```javascript
import { KubicPermissionError } from '../game-engine/kubic-kode-error.js';

throw new KubicPermissionError(
  "Spectator cannot perform game actions",
  "start_game",
  "game_session",
  { context: { participantType: "spectator" } }
);
```

### KubicSystemError

For system and internal issues.

```javascript
import { KubicSystemError } from '../game-engine/kubic-kode-error.js';

throw new KubicSystemError(
  "Database connection failed",
  "database",
  { context: { connectionString: "***" } }
);
```

### KubicWebSocketError

For WebSocket and real-time communication issues.

```javascript
import { KubicWebSocketError } from '../game-engine/kubic-kode-error.js';

throw new KubicWebSocketError(
  "WebSocket connection failed",
  "connection",
  "ws-123",
  { context: { url: "ws://localhost:4000" } }
);
```

### KubicGameOptionsError

For game options and configuration issues.

```javascript
import { KubicGameOptionsError } from '../game-engine/kubic-kode-error.js';

throw new KubicGameOptionsError(
  "Option is locked during gameplay",
  "difficulty",
  "userspace",
  "hard",
  { context: { gameState: "started" } }
);
```

## ErrorFactory

The `ErrorFactory` provides convenient static methods for creating specific error types:

```javascript
import { ErrorFactory } from '../game-engine/kubic-kode-error.js';

// Create validation error
throw ErrorFactory.validation(
  "Invalid grid size",
  "gridSize",
  0,
  { context: { minValue: 3, maxValue: 10 } }
);

// Create session error
throw ErrorFactory.session(
  "Session is full",
  "session-123",
  { context: { maxPlayers: 2, currentParticipants: 2 } }
);

// Create game error
throw ErrorFactory.game(
  "Not player's turn",
  "tic-tac-toe",
  1,
  { context: { currentPlayer: 2 } }
);

// Create participant error
throw ErrorFactory.participant(
  "Participant not found",
  999,
  null,
  { context: { sessionId: "session-123" } }
);
```

## Error Codes

The `ErrorCodes` enumeration provides consistent error code constants:

```javascript
import { ErrorCodes } from '../game-engine/kubic-kode-error.js';

throw new KubicKodeError("Session not found", {
  code: ErrorCodes.SESSION_NOT_FOUND,
  context: { sessionId: "invalid-session" }
});
```

### Available Error Codes

#### Validation Errors
- `VALIDATION_ERROR`
- `INVALID_INPUT`
- `MISSING_REQUIRED_FIELD`
- `INVALID_FORMAT`

#### Configuration Errors
- `CONFIGURATION_ERROR`
- `INVALID_OPTION`
- `MISSING_CONFIGURATION`

#### Session Errors
- `SESSION_ERROR`
- `SESSION_NOT_FOUND`
- `SESSION_FULL`
- `SESSION_ALREADY_STARTED`
- `SESSION_NOT_STARTED`

#### Game Errors
- `GAME_ERROR`
- `GAME_NOT_FOUND`
- `GAME_ALREADY_STARTED`
- `GAME_NOT_STARTED`
- `INVALID_MOVE`
- `NOT_PLAYER_TURN`

#### Participant Errors
- `PARTICIPANT_ERROR`
- `PARTICIPANT_NOT_FOUND`
- `PARTICIPANT_NAME_EXISTS`
- `PARTICIPANT_ALREADY_JOINED`
- `PARTICIPANT_NOT_PLAYABLE`

#### Authentication Errors
- `AUTHENTICATION_ERROR`
- `INVALID_TOKEN`
- `MISSING_TOKEN`
- `TOKEN_EXPIRED`
- `TOKEN_MISMATCH`

#### Network Errors
- `NETWORK_ERROR`
- `CONNECTION_FAILED`
- `TIMEOUT`
- `HTTP_ERROR`

#### State Errors
- `STATE_ERROR`
- `INVALID_STATE_TRANSITION`
- `STATE_NOT_FOUND`

#### Resource Errors
- `NOT_FOUND_ERROR`
- `CONFLICT_ERROR`
- `RESOURCE_EXISTS`

#### Permission Errors
- `PERMISSION_ERROR`
- `ACCESS_DENIED`
- `INSUFFICIENT_PERMISSIONS`

#### System Errors
- `SYSTEM_ERROR`
- `INTERNAL_ERROR`
- `UNKNOWN_ERROR`

#### WebSocket Errors
- `WEBSOCKET_ERROR`
- `WEBSOCKET_CONNECTION_FAILED`
- `WEBSOCKET_MESSAGE_ERROR`

#### Game Options Errors
- `GAME_OPTIONS_ERROR`
- `OPTION_NOT_FOUND`
- `OPTION_LOCKED`
- `INVALID_OPTION_VALUE`

## Utility Functions

### withErrorHandling

Wrap async functions with automatic error handling:

```javascript
import { withErrorHandling } from '../game-engine/kubic-kode-error.js';

const safeFunction = withErrorHandling(async (data) => {
  // Your async code here
  return processData(data);
}, "DataProcessor");

// Usage
try {
  const result = await safeFunction(data);
} catch (error) {
  // error is now a KubicKodeError with proper context
  console.error(error.toDetails());
}
```

### createErrorResponse

Convert any error to a standardized API response:

```javascript
import { createErrorResponse } from '../game-engine/kubic-kode-error.js';

// In an API endpoint
try {
  // Your API logic
} catch (error) {
  const response = createErrorResponse(error);
  res.status(400).json(response);
}
```

## Integration Examples

### Replacing Existing Error Throws

**Before:**

```javascript
throw new Error("Session not found");
```

**After:**

```javascript
import { KubicSessionError } from '../game-engine/kubic-kode-error.js';

throw new KubicSessionError("Session not found", sessionId);
```

### API Error Handling

```javascript
import { createErrorResponse, ErrorFactory } from '../game-engine/kubic-kode-error.js';

app.post('/api/session/:sessionId/join', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { participantName, participantType } = req.body;
    
    // Validate input
    if (!participantName) {
      throw ErrorFactory.validation("Participant name is required", "participantName");
    }
    
    // Your logic here
    const result = await sessionManager.addParticipant(sessionId, participantName, participantType);
    
    res.json(result);
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    res.status(400).json(errorResponse);
  }
});
```

### Game Logic Error Handling

```javascript
import { KubicGameError, ErrorFactory } from '../game-engine/kubic-kode-error.js';

class TicTacToeGame {
  playTurn(playerId, x, y) {
    // Validate player turn
    if (this.currentPlayer !== playerId) {
      throw ErrorFactory.game(
        "Not player's turn",
        this.gameId,
        playerId,
        { context: { currentPlayer: this.currentPlayer } }
      );
    }
    
    // Validate move
    if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) {
      throw ErrorFactory.game(
        "Invalid position",
        this.gameId,
        playerId,
        { context: { position: { x, y }, gridSize: this.gridSize } }
      );
    }
    
    // Your game logic here
  }
}
```

### WebSocket Error Handling

```javascript
import { KubicWebSocketError, ErrorFactory } from '../game-engine/kubic-kode-error.js';

wss.on('connection', (ws) => {
  try {
    // WebSocket connection logic
  } catch (error) {
    const wsError = ErrorFactory.websocket(
      "Failed to establish WebSocket connection",
      "connection",
      ws.id,
      { context: { remoteAddress: ws._socket.remoteAddress } }
    );
    
    ws.send(JSON.stringify(wsError.toResponse()));
  }
});
```

## Best Practices

### 1. Use Specific Error Types

Choose the most appropriate error class for your use case:

```javascript
// Good
throw new KubicValidationError("Invalid email", "email", email);

// Avoid
throw new KubicKodeError("Invalid email", { code: "VALIDATION_ERROR" });
```

### 2. Provide Context

Always include relevant context information:

```javascript
// Good
throw new KubicGameError("Invalid move", gameId, playerId, {
  context: { position: { x, y }, board: currentBoard }
});

// Avoid
throw new KubicGameError("Invalid move");
```

### 3. Use ErrorFactory for Common Cases

Use the factory methods for standard error patterns:

```javascript
// Good
throw ErrorFactory.validation("Required field missing", "username");

// Avoid
throw new ValidationError("Required field missing", "username");
```

### 4. Handle Errors Appropriately

Use try-catch blocks and convert standard errors:

```javascript
try {
  await someAsyncOperation();
} catch (error) {
  if (error instanceof KubicKodeError) {
    throw error; // Already a KubicKodeError
  }
  
  // Convert standard errors
  throw KubicKodeError.fromError(error, {
    code: ErrorCodes.INTERNAL_ERROR,
    context: { operation: "someAsyncOperation" }
  });
}
```

### 5. Use Severity Levels Appropriately

- `error`: For critical issues that prevent normal operation
- `warn`: For issues that don't prevent operation but should be addressed
- `info`: For informational messages that might be useful for debugging

## Migration Guide

### Step 1: Import Error Classes

Add imports to files that throw errors:

```javascript
import { 
  KubicKodeError, 
  KubicValidationError, 
  KubicSessionError,
  ErrorFactory,
  ErrorCodes 
} from '../game-engine/kubic-kode-error.js';
```

### Step 2: Replace Error Throws

Replace `throw new Error()` with appropriate error classes:

```javascript
// Before
throw new Error("Session not found");

// After
throw new KubicSessionError("Session not found", sessionId);
```

### Step 3: Update Error Handling

Update catch blocks to handle KubicKodeError instances:

```javascript
// Before
} catch (error) {
  console.error(error.message);
}

// After
} catch (error) {
  if (error instanceof KubicKodeError) {
    console.error(error.toDetails());
  } else {
    console.error(error.message);
  }
}
```

### Step 4: Update API Responses

Use `createErrorResponse` for consistent API error responses:

```javascript
// Before
res.status(400).json({ error: error.message });

// After
res.status(400).json(createErrorResponse(error));
```

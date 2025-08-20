# KubicKode Testing Suite

This directory contains comprehensive end-to-end tests for the KubicKode game system. The test suite validates complete game flow from session creation to game completion, including WebSocket communication, multiplayer scenarios, and game-specific functionality.

## Overview

The testing suite provides:

- **Complete Game Flow Testing**: Tests the entire user journey from joining a session to completing a game
- **WebSocket Communication Testing**: Verifies real-time communication between clients and server
- **Multiplayer Scenario Testing**: Tests multiple players joining and playing together
- **Game Logic Testing**: Validates win conditions, move validation, and game state management
- **Session Management Testing**: Tests session isolation, participant handling, and cleanup
- **API Endpoint Testing**: Validates all REST API endpoints and error handling

## Files

- `tic-tac-toe-game-test.js` - **Main test suite** - Comprehensive tic-tac-toe game testing
- `lobby-system-test.js` - **Lobby system test suite** - Comprehensive lobby functionality testing
- `e2e-test-runner.js` - Base testing framework with HTTP and WebSocket utilities
- `README.md` - This documentation file

## Prerequisites

1. **Server Running**: Make sure your KubicKode server is running:
   ```bash
   npm run start-server
   ```

2. **Dependencies**: Install the required testing dependencies:
   ```bash
   npm install
   ```

## Quick Start

### Run All Tests

```bash
# Run the complete test suite (recommended)
npm run test:all

# Run individual test suites
npm run test:tic-tac-toe    # Game logic and flow tests
npm run test:lobby          # Lobby system tests
npm test                    # Default (runs tic-tac-toe tests)
```

### Prerequisites

1. **Server Running**: Make sure your KubicKode server is running:
   ```bash
   npm run start-server
   ```

2. **Dependencies**: Ensure all dependencies are installed:
   ```bash
   npm install
   ```

## Test Scenarios

The main test suite (`tic-tac-toe-game-test.js`) runs three comprehensive test scenarios:

### 1. Complete Tic-Tac-Toe Game ✅

Tests the entire game lifecycle with a full 5-move game:

1. **Session Initialization**: Creates a fresh game session
2. **Player Joining**: Two players join with proper participant types
3. **WebSocket Connection**: Establishes real-time communication for both players
4. **Game Start**: Starts the game with participant authentication
5. **Gameplay**: Plays 5 strategic moves leading to a win condition
6. **Win Detection**: Validates win conditions and game state
7. **Game Restart**: Tests restarting with proper session management
8. **Session Cleanup**: Ensures proper resource cleanup

### 2. Game Configurations Test ✅

Tests different game configurations:

- **Classic 3x3**: Standard tic-tac-toe configuration
- **Grid Size Validation**: Verifies proper grid dimensions
- **Game Options**: Tests configuration parameter handling

### 3. WebSocket Events Test ✅

Comprehensive real-time communication testing:

- **Session Isolation**: Creates isolated test sessions
- **Event Monitoring**: Monitors all WebSocket events during gameplay
- **Game Start Events**: Validates game initialization broadcasts  
- **Move Events**: Tests real-time move synchronization
- **Event Timing**: Ensures proper event sequencing

## Test Output

The test suite provides detailed output showing each step:

```
🎯 Tic-Tac-Toe Game Test Runner
================================

🔍 Checking server availability...
✅ Server is running and responding

🎯 Starting Tic-Tac-Toe Specific Tests
============================================================

🎯 Running: Complete Tic-Tac-Toe Game
  📋 Step 1: Initializing session...
  ✅ Session created: abc123-def456
  👥 Step 2: Joining players...
  ✅ Players joined: 1, 2
  🔌 Step 3: Connecting WebSockets...
  🎮 Step 4: Starting the game...
  ✅ Game started: 1
  🎯 Step 5: Playing the game...
    🎯 Move 1 (X): (0, 0)
    🎯 Move 2 (O): (1, 1)
    🎯 Move 3 (X): (0, 1)
    🎯 Move 4 (O): (2, 2)
    🎯 Move 5 (X): (0, 2)
    🏆 Player X wins!
  🎉 Complete Tic-Tac-Toe Game completed successfully!

⚙️ Running: Game Configurations Test
  🧪 Testing: Classic 3x3...
  ✅ Grid size: 1.7320508075688772x1.7320508075688772
  🎉 Game Configurations Test completed!

📡 Running: WebSocket Events Test
  🎉 WebSocket Events Test completed!

============================================================
📊 TIC-TAC-TOE TEST REPORT
============================================================
Total Tests: 3
Passed: 3
Failed: 0
Duration: 6745ms
✅ PASS Test 1: Success (5 moves)
✅ PASS Test 2: Success
✅ PASS Test 3: Success

🎉 All Tic-Tac-Toe tests passed successfully!
```

## Lobby System Test Suite

The lobby system test (`lobby-system-test.js`) provides comprehensive testing of all lobby functionality including host management, session configuration, auto-join, chat, ready checks, and validation scenarios.

### Lobby Test Coverage ✅

- **Complete Lobby Flow**: Session creation, host assignment, configuration, auto-join, chat, sync, and validation
- **API Endpoints**: All 15+ new lobby endpoints (session listing, config, chat, ready states, participant management)
- **WebSocket Events**: Real-time broadcasting for all lobby actions and state changes
- **Validation Scenarios**: Host privileges, unique usernames, data validation, and error handling

### Running Lobby Tests

```bash
npm run test:lobby          # Lobby tests only
npm run test:all           # All tests (tic-tac-toe + lobby)
```

## Configuration Options

### Test Runner Configuration

The test runner is preconfigured with optimal settings:

```javascript
const testRunner = new TicTacToeGameTest({
  baseUrl: "http://localhost:3000",    // Server URL
  wsUrl: "ws://localhost:3000",        // WebSocket URL  
  timeout: 10000,                      // Request timeout (ms)
  retryAttempts: 3,                    // Retry attempts for failed requests
  retryDelay: 1000                     // Delay between retries (ms)
});
```

### Key Features

- **Session Isolation**: Each test gets a fresh session using `forceNew: true`
- **Proper Participant Types**: Uses `"user"` participant type (not `"human"`)
- **Complete API Coverage**: Tests all tic-tac-toe specific endpoints
- **WebSocket Monitoring**: Captures and validates all real-time events
- **Error Handling**: Comprehensive error detection and reporting

## Extending the Framework

### Adding New Test Scenarios

1. **Create a new test class**:

```javascript
import E2ETestRunner from "./e2e-test-runner.js";

class CustomGameTest extends E2ETestRunner {
  async testCustomScenario() {
    // Your test logic here
  }
}
```

2. **Add test methods**:

```javascript
async testCustomScenario() {
  const testName = "Custom Scenario";
  console.log(`\n🧪 Running: ${testName}`);
  
  try {
    // Test implementation
    console.log(`  🎉 ${testName} completed successfully!`);
    return { success: true };
  } catch (error) {
    console.error(`  ❌ ${testName} failed:`, error.message);
    return { success: false, error: error.message };
  }
}
```

### Testing Different Game Types

The framework is designed to work with any game type. To test a new game:

1. **Register the game** on the server
2. **Use the game ID** in test calls
3. **Implement game-specific logic** if needed

Example for a new game:

```javascript
// Test with a different game
const result = await this.testCompleteGameFlow("my-new-game");

// Test with game-specific options
const startResponse = await this.makeRequest(`/api/game/start/${sessionId}`, {
  method: "POST",
  body: JSON.stringify({
    customOption: "value"
  })
});
```

## Troubleshooting

### Common Issues

1. **Server Not Running**:
   ```
   💥 Tic-Tac-Toe test runner failed: Request failed: connect ECONNREFUSED
   ```
   **Solution**: Start the server with `npm run start-server`

2. **Missing Dependencies**:
   ```
   Error [ERR_MODULE_NOT_FOUND]: Cannot find package "node-fetch"
   ```
   **Solution**: Install dependencies with `npm install`

3. **Session Full Error**:
   ```
   ❌ Player join failed: Game session is full
   ```
   **Solution**: This is automatically handled by session isolation (tests use `forceNew: true`)

4. **WebSocket Connection Issues**:
   ```
   [session-id] websocket_connected: { participantId: null }
   ```
   **Solution**: Ensure participants are joined before connecting WebSockets

5. **Participant Type Error**:
   ```
   ❌ Invalid participant type specified: human
   ```
   **Solution**: Use `"user"`, `"computer"`, or `"spectator"` (not `"human"`)

### Debug Mode

For detailed debugging, you can modify the test runner to show more information:

```javascript
// In e2e-test-runner.js, uncomment console.log statements
console.log(`[useGameWebSocket] WebSocket opened for session: ${sessionId}`);
console.log(`[useGameWebSocket] Received WebSocket message:`, data);
```

### Manual Testing

You can also run individual test methods for debugging:

```javascript
const testRunner = new E2ETestRunner();
await testRunner.testCompleteGameFlow();
```

## Integration with CI/CD

The test suite is designed to work with continuous integration systems:

```yaml
# Example GitHub Actions workflow
name: KubicKode Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: "18"
      - run: npm install
      - run: npm run start-server &
      - run: sleep 5  # Wait for server to start
      - run: npm test  # Runs the complete test suite
```

## Performance Considerations

- **Test Duration**: Full test suite typically takes 6-8 seconds
- **Resource Usage**: Tests create multiple WebSocket connections with proper cleanup
- **Server Load**: Tests generate realistic tic-tac-toe game traffic
- **Memory Usage**: Event logs are cleared after each test
- **Session Isolation**: Each test creates fresh sessions to avoid interference

## Best Practices

1. **Session Isolation**: Each test uses `forceNew: true` for independent sessions
2. **Proper Participant Types**: Always use `"user"`, `"computer"`, or `"spectator"`
3. **WebSocket Timing**: Connect WebSockets after obtaining participant IDs
4. **Error Handling**: Include comprehensive error checking and reporting
5. **Real-time Testing**: Validate WebSocket events and game state synchronization
6. **Complete Game Flow**: Test full gameplay scenarios, not just individual moves
7. **Resource Cleanup**: Properly close connections and clean up sessions

## Contributing

When extending the test suite:

1. **Extend TicTacToeGameTest**: Add new test methods to the existing class
2. **Follow Session Isolation**: Use `forceNew: true` for independent test sessions
3. **Include Comprehensive Validation**: Test API responses, WebSocket events, and game state
4. **Add Descriptive Output**: Include clear console messages for test progress
5. **Test Error Scenarios**: Validate both success and failure paths
6. **Update Documentation**: Keep this README current with any changes

### Example New Test Method

```javascript
async testNewFeature() {
  const testName = "New Feature Test";
  console.log(`\n🧪 Running: ${testName}`);
  
  try {
    // Create isolated session
    const initResponse = await this.makeRequest("/api/session/init/tic-tac-toe-classic", {
      method: "POST",
      body: JSON.stringify({ forceNew: true })
    });
    
    // Your test logic here...
    
    console.log(`  🎉 ${testName} completed successfully!`);
    return { success: true };
  } catch (error) {
    console.error(`  ❌ ${testName} failed:`, error.message);
    return { success: false, error: error.message };
  }
}
```

## Support

If you encounter issues with the testing framework:

1. Check the troubleshooting section above
2. Verify your server is running and accessible
3. Check the server logs for errors
4. Ensure all dependencies are installed
5. Try running tests individually to isolate issues

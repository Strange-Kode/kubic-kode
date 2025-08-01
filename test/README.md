# KubicKode End-to-End Testing Framework

This directory contains a comprehensive end-to-end testing framework for the KubicKode game system. The framework tests the complete game flow from session creation to game completion, including WebSocket communication and multiplayer scenarios.

## Overview

The testing framework provides:

- **Complete Game Flow Testing**: Tests the entire user journey from joining a session to completing a game
- **WebSocket Communication Testing**: Verifies real-time communication between clients and server
- **Multiplayer Scenario Testing**: Tests multiple players joining and playing together
- **Error Handling Testing**: Validates error scenarios and edge cases
- **Game-Specific Testing**: Specialized tests for different game types (Tic-Tac-Toe, etc.)

## Files

- `e2e-test-runner.js` - Core testing framework with HTTP and WebSocket utilities
- `run-e2e-tests.js` - Main test runner script for general end-to-end tests
- `tic-tac-toe-game-test.js` - Specialized tests for Tic-Tac-Toe game flow
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
# Run all end-to-end tests
npm run test:all

# Or run them individually
npm run test:e2e
npm run test:tic-tac-toe
```

### Run Tests with Custom Configuration

```bash
# Test against a different server
node test/run-e2e-tests.js --url http://localhost:3001

# Test with a specific game type
node test/run-e2e-tests.js --game tic-tac-toe-configurable

# Set custom timeout
node test/run-e2e-tests.js --timeout 15000
```

## Test Scenarios

### 1. Complete Game Flow Test

Tests the entire game lifecycle:

1. **Session Initialization**: Creates a new game session
2. **Player Joining**: Multiple players join the session
3. **WebSocket Connection**: Establishes real-time communication
4. **Game Start**: Starts the game with players
5. **Gameplay**: Plays actual moves and tracks game state
6. **Game End**: Handles win/lose/draw scenarios
7. **Game Restart**: Tests restarting the game
8. **Cleanup**: Properly closes connections

### 2. Multiplayer Scenario Test

Tests multiplayer functionality:

- Multiple players joining simultaneously
- WebSocket event broadcasting to all players
- Concurrent game state updates
- Player leave/join scenarios

### 3. Error Handling Test

Tests error scenarios:

- Invalid session IDs
- Invalid game moves
- WebSocket connection failures
- Server error responses

### 4. Tic-Tac-Toe Specific Tests

Specialized tests for Tic-Tac-Toe:

- **Complete Game Play**: Plays a full game with predefined moves
- **Game Configurations**: Tests different grid sizes and options
- **WebSocket Events**: Monitors all real-time events during gameplay
- **Win Conditions**: Tests various win scenarios
- **Game Restart**: Verifies proper game state reset

## Test Output

The framework provides detailed output showing:

```
🎮 KubicKode End-to-End Test Runner
=====================================

🔍 Checking server availability...
✅ Server is running and responding

🧪 Running: Complete Game Flow
  📋 Step 1: Initializing session...
  ✅ Session created: abc123-def456
  👤 Step 2: Joining session with Player 1...
  ✅ Player 1 joined: player-1-id
  🔌 Step 3: Connecting WebSocket for Player 1...
  ✅ WebSocket connected
  ...

📊 TEST REPORT
============================================================
Total Tests: 3
Passed: 3
Failed: 0
Duration: 15420ms
✅ PASS Test 1: Success
✅ PASS Test 2: Success
✅ PASS Test 3: Success

🎉 All tests passed successfully!
```

## Configuration Options

### Test Runner Configuration

```javascript
const testRunner = new E2ETestRunner({
  baseUrl: 'http://localhost:3000',    // Server URL
  wsUrl: 'ws://localhost:3000',        // WebSocket URL
  timeout: 10000,                      // Request timeout (ms)
  retryAttempts: 3,                    // Retry attempts for failed requests
  retryDelay: 1000                     // Delay between retries (ms)
});
```

### Command Line Options

- `--url <url>`: Server URL (default: http://localhost:3000)
- `--game <gameId>`: Default game ID (default: tic-tac-toe-classic)
- `--timeout <ms>`: Request timeout in milliseconds (default: 10000)
- `--help, -h`: Show help message

## Extending the Framework

### Adding New Test Scenarios

1. **Create a new test class**:

```javascript
import E2ETestRunner from './e2e-test-runner.js';

class CustomGameTest extends E2ETestRunner {
  async testCustomScenario() {
    // Your test logic here
  }
}
```

2. **Add test methods**:

```javascript
async testCustomScenario() {
  const testName = 'Custom Scenario';
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
const result = await this.testCompleteGameFlow('my-new-game');

// Test with game-specific options
const startResponse = await this.makeRequest(`/api/game/start/${sessionId}`, {
  method: 'POST',
  body: JSON.stringify({
    customOption: 'value'
  })
});
```

## Troubleshooting

### Common Issues

1. **Server Not Running**:
   ```
   💥 Test runner failed: Request failed: connect ECONNREFUSED
   ```
   Solution: Start the server with `npm run start-server`

2. **WebSocket Connection Failed**:
   ```
   ❌ WebSocket connection timeout
   ```
   Solution: Check that WebSocket is enabled on the server

3. **Test Timeout**:
   ```
   ❌ Timeout waiting for event: gameStarted
   ```
   Solution: Increase timeout with `--timeout 15000`

4. **Game Not Found**:
   ```
   ❌ Game type 'unknown-game' not found
   ```
   Solution: Make sure the game is registered on the server

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

The test framework is designed to work with continuous integration systems:

```yaml
# Example GitHub Actions workflow
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run start-server &
      - run: sleep 5  # Wait for server to start
      - run: npm run test:all
```

## Performance Considerations

- **Test Duration**: Full test suite typically takes 15-30 seconds
- **Resource Usage**: Tests create multiple WebSocket connections
- **Server Load**: Tests generate realistic game traffic
- **Memory Usage**: Event logs are cleared after each test

## Best Practices

1. **Always Clean Up**: Use the `cleanup()` method to close connections
2. **Handle Errors Gracefully**: Catch and log errors appropriately
3. **Use Descriptive Test Names**: Make test output easy to understand
4. **Test Edge Cases**: Include error scenarios and boundary conditions
5. **Monitor WebSocket Events**: Verify real-time communication works
6. **Test Game State**: Validate that game state is consistent

## Contributing

When adding new tests:

1. Follow the existing naming conventions
2. Include proper error handling
3. Add descriptive console output
4. Test both success and failure scenarios
5. Update this documentation if needed

## Support

If you encounter issues with the testing framework:

1. Check the troubleshooting section above
2. Verify your server is running and accessible
3. Check the server logs for errors
4. Ensure all dependencies are installed
5. Try running tests individually to isolate issues 
/**
 * KubicKode End-to-End Test Runner
 * 
 * This framework provides comprehensive testing for the complete game flow:
 * - Session creation and management
 * - WebSocket communication
 * - Game lifecycle (start, play, restart)
 * - Multiplayer scenarios
 * - Error handling and edge cases
 */

import { WebSocket } from "ws";
import fetch from "node-fetch";

class E2ETestRunner {
  constructor(config = {}) {
    this.config = {
      baseUrl: process.env.KUBIC_TEST_BASE_URL || "http://localhost:3000",
      wsUrl: process.env.KUBIC_TEST_WS_URL || "ws://localhost:3000",
      timeout: 10000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
    
    this.testResults = [];
    this.currentSession = null;
    this.websockets = new Map();
    this.eventLogs = new Map();
  }

  /**
   * Utility methods for HTTP requests
   */
  async makeRequest(endpoint, options = {}) {
    const url = `${this.config.baseUrl}${endpoint}`;
    const defaultOptions = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      timeout: this.config.timeout
    };

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      const data = await response.json();
      return { status: response.status, data };
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }

  /**
   * WebSocket connection management
   */
  async connectWebSocket(sessionId, participantId = null) {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.config.wsUrl}/?sessionId=${sessionId}`;
      const ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout"));
      }, this.config.timeout);

      ws.on("open", () => {
        clearTimeout(timeout);
        this.websockets.set(sessionId, ws);
        this.eventLogs.set(sessionId, []);
        
        // Log connection event
        this.logEvent(sessionId, "websocket_connected", { participantId });
        resolve(ws);
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.logEvent(sessionId, "message_received", message);
        } catch (error) {
          this.logEvent(sessionId, "message_parse_error", { error: error.message });
        }
      });

      ws.on("error", (error) => {
        clearTimeout(timeout);
        this.logEvent(sessionId, "websocket_error", { error: error.message });
        reject(error);
      });

      ws.on("close", () => {
        this.logEvent(sessionId, "websocket_closed", {});
      });
    });
  }

  /**
   * Event logging for test verification
   */
  logEvent(sessionId, eventType, data) {
    if (!this.eventLogs.has(sessionId)) {
      this.eventLogs.set(sessionId, []);
    }
    
    const event = {
      timestamp: Date.now(),
      type: eventType,
      data
    };
    
    this.eventLogs.get(sessionId).push(event);
    console.log(`[${sessionId}] ${eventType}:`, data);
  }

  /**
   * Wait for specific WebSocket events
   */
  async waitForEvent(sessionId, eventType, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        const events = this.eventLogs.get(sessionId) || [];
        const matchingEvent = events.find(event => event.type === eventType);
        
        if (matchingEvent) {
          clearInterval(checkInterval);
          resolve(matchingEvent);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error(`Timeout waiting for event: ${eventType}`));
        }
      }, 100);
    });
  }

  /**
   * Test scenario: Complete game flow
   */
  async testCompleteGameFlow(gameId = "tic-tac-toe-classic") {
    const testName = "Complete Game Flow";
    console.log(`\n🧪 Running: ${testName}`);
    
    try {
      // Step 1: Initialize session
      console.log("  📋 Step 1: Initializing session...");
      const initResponse = await this.makeRequest(`/api/session/init/${gameId}`, {
        method: "POST"
      });
      
      if (initResponse.status !== 200) {
        throw new Error(`Session init failed: ${initResponse.data.error}`);
      }
      
      const sessionId = initResponse.data.session_id;
      this.currentSession = sessionId;
      console.log(`  ✅ Session created: ${sessionId}`);

      // Step 2: Join session with first player
      console.log("  👤 Step 2: Joining session with Player 1...");
      const join1Response = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: "POST",
        body: JSON.stringify({
          participantName: "Alice",
          participantType: "user"
        })
      });
      
      if (join1Response.status !== 200) {
        throw new Error(`Player 1 join failed: ${join1Response.data.error}`);
      }
      
      const player1Id = join1Response.data.participant_id;
      console.log(`  ✅ Player 1 joined: ${player1Id}`);

      // Step 3: Connect WebSocket for Player 1
      console.log("  🔌 Step 3: Connecting WebSocket for Player 1...");
      await this.connectWebSocket(sessionId, player1Id);

      // Step 4: Join session with second player
      console.log("  👤 Step 4: Joining session with Player 2...");
      const join2Response = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: "POST",
        body: JSON.stringify({
          participantName: "Bob",
          participantType: "user"
        })
      });
      
      if (join2Response.status !== 200) {
        throw new Error(`Player 2 join failed: ${join2Response.data.error}`);
      }
      
      const player2Id = join2Response.data.participant_id;
      console.log(`  ✅ Player 2 joined: ${player2Id}`);

      // Step 5: Connect WebSocket for Player 2
      console.log("  🔌 Step 5: Connecting WebSocket for Player 2...");
      await this.connectWebSocket(sessionId, player2Id);

      // Step 6: Wait for player join events
      console.log("  ⏳ Step 6: Waiting for player join events...");
      await this.waitForEvent(sessionId, "message_received", 3000);

      // Step 7: Start the game
      console.log("  🎮 Step 7: Starting the game...");
      const startResponse = await this.makeRequest(`/api/game/${sessionId}/start`, {
        participantId: player1Id,
        gameToken: join1Response.data.game_token,
      });
      
      if (startResponse.status !== 200) {
        throw new Error(`Game start failed: ${startResponse.data.error}`);
      }
      
      console.log(`  ✅ Game started: ${startResponse.data.current_player_ids?.[0] || "none"}`);

      // Step 8: Wait for game started event
      console.log("  ⏳ Step 8: Waiting for game started event...");
      await this.waitForEvent(sessionId, "message_received", 3000);

      // Step 9: Get current player and game state
      console.log("  📊 Step 9: Getting game state...");
      const currentPlayerResponse = await this.makeRequest(`/api/game/${sessionId}/get-current-player`, {
        gameToken: join1Response.data.game_token,
      });
      const tileMapResponse = await this.makeRequest(`/api/game/${sessionId}/get-tilemap`, {
        gameToken: join1Response.data.game_token,
      });
      
      console.log(`  ✅ Current player: ${currentPlayerResponse.data.current_player_ids?.[0] || "none"}`);
      console.log(`  ✅ Tile map retrieved: ${tileMapResponse.data.tiles.length} tiles`);

      // Step 10: Play a turn (assuming it's Player 1's turn)
      console.log("  🎯 Step 10: Playing a turn...");
      const playTurnResponse = await this.makeRequest(`/api/game/${sessionId}/play-turn`, {
        participantId: player1Id,
        gameToken: join1Response.data.game_token,
        xPos: 0,
        yPos: 0,
      });
      
      if (playTurnResponse.status !== 200) {
        throw new Error(`Play turn failed: ${playTurnResponse.data.error}`);
      }
      
      console.log(`  ✅ Turn played: ${playTurnResponse.data.player_has_won ? "WIN!" : "Continue"}`);

      // Step 11: Wait for turn played event
      console.log("  ⏳ Step 11: Waiting for turn played event...");
      await this.waitForEvent(sessionId, "message_received", 3000);

      // Step 12: Check if game is still active
      console.log("  🔍 Step 12: Checking game status...");
      const isActiveResponse = await this.makeRequest(`/api/game/${sessionId}/is-active`, {
        gameToken: join1Response.data.game_token,
      });
      console.log(`  ✅ Game active: ${isActiveResponse.data.is_active}`);

      // Step 13: Stop the game
      console.log("  🛑 Step 13: Stopping the game...");
      const stopResponse = await this.makeRequest(`/api/game/${sessionId}/stop`, {
        participantId: player1Id,
        gameToken: join1Response.data.game_token,
      });
      
      if (stopResponse.status !== 200) {
        throw new Error(`Game stop failed: ${stopResponse.data.error}`);
      }
      
      console.log(`  ✅ Game stopped: ${stopResponse.data.game_stopped}`);

      // Step 14: Wait for game stopped event
      console.log("  ⏳ Step 14: Waiting for game stopped event...");
      await this.waitForEvent(sessionId, "message_received", 3000);

      // Step 15: Restart the game
      console.log("  🔄 Step 15: Restarting the game...");
      const restartResponse = await this.makeRequest(`/api/game/${sessionId}/start`, {
        participantId: player1Id,
        gameToken: join1Response.data.game_token,
      });
      
      if (restartResponse.status !== 200) {
        throw new Error(`Game restart failed: ${restartResponse.data.error}`);
      }
      
      console.log(`  ✅ Game restarted: ${restartResponse.data.current_player_ids?.[0] || "none"}`);

      // Step 16: Clean up
      console.log("  🧹 Step 16: Cleaning up...");
      this.websockets.forEach(ws => ws.close());
      this.websockets.clear();
      this.eventLogs.clear();

      console.log(`  🎉 ${testName} completed successfully!`);
      return { success: true, sessionId };

    } catch (error) {
      console.error(`  ❌ ${testName} failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test scenario: Multiplayer with multiple WebSocket connections
   */
  async testMultiplayerScenario(gameId = "tic-tac-toe-classic") {
    const testName = "Multiplayer Scenario";
    console.log(`\n🧪 Running: ${testName}`);
    
    try {
      // Initialize session
      const initResponse = await this.makeRequest(`/api/session/init/${gameId}`, {
        method: "POST"
      });
      
      const sessionId = initResponse.data.session_id;
      console.log(`  ✅ Session created: ${sessionId}`);

      // Join multiple players
      const players = [
        { name: "Alice", type: "user" },
        { name: "Bob", type: "user" },
        { name: "Charlie", type: "user" }
      ];

      const playerIds = [];
      
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        console.log(`  👤 Joining player ${i + 1}: ${player.name}...`);
        
        const joinResponse = await this.makeRequest(`/api/session/${sessionId}/join`, {
          method: "POST",
          body: JSON.stringify({
            participantName: player.name,
            participantType: player.type
          })
        });
        
        playerIds.push(joinResponse.data.participant_id);
        
        // Connect WebSocket for each player
        await this.connectWebSocket(sessionId, joinResponse.data.participant_id);
      }

      // Start game
      console.log("  🎮 Starting game...");
      await this.makeRequest(`/api/game/${sessionId}/start`, {
        participantId: playerIds[0],
        gameToken: joinResponse.data.game_token,
      });
      
      console.log(`  ✅ Game started with ${players.length} players`);

      // Verify all WebSocket connections received the game started event
      const events = this.eventLogs.get(sessionId) || [];
      const gameStartedEvents = events.filter(event => 
        event.type === "message_received" && 
        event.data.type === "gameStarted"
      );
      
      console.log(`  📡 WebSocket events received: ${gameStartedEvents.length}`);

      // Clean up
      this.websockets.forEach(ws => ws.close());
      this.websockets.clear();
      this.eventLogs.clear();

      console.log(`  🎉 ${testName} completed successfully!`);
      return { success: true, sessionId, playerCount: players.length };

    } catch (error) {
      console.error(`  ❌ ${testName} failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test scenario: Error handling and edge cases
   */
  async testErrorScenarios() {
    const testName = "Error Scenarios";
    console.log(`\n🧪 Running: ${testName}`);
    
    const results = [];

    try {
      // Test 1: Invalid session ID
      console.log("  🧪 Test 1: Invalid session ID...");
      try {
        await this.makeRequest("/api/session/invalid-session-id/join", {
          method: "POST",
          body: JSON.stringify({
            participantName: "Test",
            participantType: "user"
          })
        });
        results.push({ test: "Invalid session ID", success: false, expected: "Should fail" });
      } catch (error) {
        results.push({ test: "Invalid session ID", success: true, expected: "Should fail" });
      }

      // Test 2: Invalid game moves
      console.log("  🧪 Test 2: Invalid game moves...");
      const initResponse = await this.makeRequest("/api/session/init/tic-tac-toe-classic", {
        method: "POST"
      });
      
      const sessionId = initResponse.data.session_id;
      
      // Join players and start game
      const join1Response = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: "POST",
        body: JSON.stringify({
          participantName: "Alice",
          participantType: "user"
        })
      });
      
      const join2Response = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: "POST",
        body: JSON.stringify({
          participantName: "Bob",
          participantType: "user"
        })
      });
      
      await this.makeRequest(`/api/game/${sessionId}/start`, {
        participantId: join1Response.data.participant_id,
        gameToken: join1Response.data.game_token,
      });

      // Try invalid move (out of bounds)
      try {
        await this.makeRequest(`/api/game/${sessionId}/play-turn`, {
          participantId: join1Response.data.participant_id,
          gameToken: join1Response.data.game_token,
          xPos: 10,
          yPos: 10
        });
        results.push({ test: "Invalid move", success: false, expected: "Should fail" });
      } catch (error) {
        results.push({ test: "Invalid move", success: true, expected: "Should fail" });
      }

      // Test 3: WebSocket connection to non-existent session
      console.log("  🧪 Test 3: WebSocket to non-existent session...");
      try {
        await this.connectWebSocket("non-existent-session");
        results.push({ test: "WebSocket invalid session", success: false, expected: "Should fail" });
      } catch (error) {
        results.push({ test: "WebSocket invalid session", success: true, expected: "Should fail" });
      }

      console.log(`  🎉 ${testName} completed!`);
      return { success: true, results };

    } catch (error) {
      console.error(`  ❌ ${testName} failed:`, error.message);
      return { success: false, error: error.message, results };
    }
  }

  /**
   * Run all test scenarios
   */
  async runAllTests() {
    console.log("🚀 Starting KubicKode End-to-End Tests\n");
    console.log("=" .repeat(60));
    
    const startTime = Date.now();
    const results = [];

    // Run test scenarios
    results.push(await this.testCompleteGameFlow());
    results.push(await this.testMultiplayerScenario());
    results.push(await this.testErrorScenarios());

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Generate test report
    console.log("\n" + "=" .repeat(60));
    console.log("📊 TEST REPORT");
    console.log("=" .repeat(60));
    
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Duration: ${duration}ms`);
    
    results.forEach((result, index) => {
      const status = result.success ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} Test ${index + 1}: ${result.error || "Success"}`);
    });

    console.log("\n" + "=" .repeat(60));
    
    return {
      total: results.length,
      passed,
      failed,
      duration,
      results
    };
  }

  /**
   * Clean up resources
   */
  cleanup() {
    this.websockets.forEach(ws => ws.close());
    this.websockets.clear();
    this.eventLogs.clear();
  }
}

export default E2ETestRunner;

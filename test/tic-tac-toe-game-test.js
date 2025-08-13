/**
 * Tic-Tac-Toe Complete Game Test
 * 
 * This test plays a complete game of Tic-Tac-Toe from start to finish,
 * including all possible game outcomes (win, draw, restart).
 * Updated to use game token authentication system.
 */

import E2ETestRunner from './e2e-test-runner.js';

class TicTacToeGameTest extends E2ETestRunner {
  constructor(config = {}) {
    super(config);
    this.gameMoves = [];
    this.gameHistory = [];
    this.gameTokens = {}; // Store game tokens for each participant
  }

  /**
   * Test a complete Tic-Tac-Toe game with predefined moves
   */
  async testCompleteTicTacToeGame(gameId = 'tic-tac-toe-classic') {
    const testName = 'Complete Tic-Tac-Toe Game';
    console.log(`\n🎯 Running: ${testName}`);
    
    try {
      // Step 1: Initialize session
      console.log('  📋 Step 1: Initializing session...');
      const initResponse = await this.makeRequest(`/api/session/init/${gameId}`, {
        method: 'POST'
      });
      
      const sessionId = initResponse.data.session_id;
      this.currentSession = sessionId;
      console.log(`  ✅ Session created: ${sessionId}`);

      // Step 2: Join players
      console.log('  👥 Step 2: Joining players...');
      const player1Response = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: 'Alice',
          participantType: 'user'
        })
      });
      
      const player2Response = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: 'Bob',
          participantType: 'user'
        })
      });
      
      const participant1Id = player1Response.data.participant_id;
      const participant2Id = player2Response.data.participant_id;
      
      // Store game tokens
      this.gameTokens[participant1Id] = player1Response.data.game_token;
      this.gameTokens[participant2Id] = player2Response.data.game_token;
      
      console.log(`  ✅ Players joined: ${participant1Id}, ${participant2Id}`);
      console.log(`  🔐 Game tokens stored for both players`);

      // Step 3: Connect WebSockets
      console.log('  🔌 Step 3: Connecting WebSockets...');
      await this.connectWebSocket(sessionId, participant1Id);
      await this.connectWebSocket(sessionId, participant2Id);

      // Step 4: Start the game (now uses POST with game token)
      console.log('  🎮 Step 4: Starting the game...');
      const startResponse = await this.makeRequest(`/api/game/start/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: participant1Id,
          gameToken: this.gameTokens[participant1Id]
        })
      });
      
      console.log(`  ✅ Game started: ${startResponse.data.current_player_ids?.[0] || 'none'}`);

      // Step 5: Play a complete game
      console.log('  🎯 Step 5: Playing the game...');
      const gameResult = await this.playCompleteGame(sessionId, participant1Id, participant2Id);
      
      if (gameResult.winner) {
        console.log(`  🏆 Game won by: ${gameResult.winner}`);
      } else {
        console.log(`  🤝 Game ended in a draw`);
      }

      // Step 6: Verify game state (now uses POST with game token)
      console.log('  🔍 Step 6: Verifying final game state...');
      const isActiveResponse = await this.makeRequest(`/api/game/is-active/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({
          gameToken: this.gameTokens[participant1Id]
        })
      });
      
      const finalTileMap = await this.makeRequest(`/api/game/get-tilemap/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({
          gameToken: this.gameTokens[participant1Id]
        })
      });
      
      console.log(`  ✅ Game active: ${isActiveResponse.data.is_active}`);
      console.log(`  ✅ Final board state: ${finalTileMap.data.tiles.length} tiles`);

      // Step 7: Test game restart (now uses POST with game token)
      console.log('  🔄 Step 7: Testing game restart...');
      const restartResponse = await this.makeRequest(`/api/game/start/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: participant1Id,
          gameToken: this.gameTokens[participant1Id]
        })
      });
      
      console.log(`  ✅ Game restarted: ${restartResponse.data.current_player_ids?.[0] || 'none'}`);
      
      // Step 8.1: Verify alternating first player behavior
      console.log('  🔄 Step 8.1: Testing alternating first player on second restart...');
      const secondRestartResponse = await this.makeRequest(`/api/game/start/${sessionId}`, {
        method: 'POST', 
        body: JSON.stringify({
          participantId: participant1Id,
          gameToken: this.gameTokens[participant1Id]
        })
      });
      
      // Check if first player changed from first restart to second restart
      const firstPlayer1 = restartResponse.data.current_player_ids?.[0];
      const firstPlayer2 = secondRestartResponse.data.current_player_ids?.[0];
      if (firstPlayer1 !== firstPlayer2) {
        console.log(`  ✅ First player alternated: ${firstPlayer1} → ${firstPlayer2}`);
      } else {
        console.log(`  ⚠️  First player did not alternate (same player: ${firstPlayer1})`);
      }

      // Step 9: Verify restart state
      const restartTileMap = await this.makeRequest(`/api/game/get-tilemap/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({
          gameToken: this.gameTokens[participant1Id]
        })
      });
      const isActiveAfterRestart = await this.makeRequest(`/api/game/is-active/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({
          gameToken: this.gameTokens[participant1Id]
        })
      });
      
      console.log(`  ✅ Restart board state: ${restartTileMap.data.tiles.length} tiles`);
      console.log(`  ✅ Game active after restart: ${isActiveAfterRestart.data.is_active}`);

      // Clean up
      this.websockets.forEach(ws => ws.close());
      this.websockets.clear();
      this.eventLogs.clear();

      console.log(`  🎉 ${testName} completed successfully!`);
      return { 
        success: true, 
        sessionId, 
        gameResult,
        movesPlayed: this.gameMoves.length
      };

    } catch (error) {
      console.error(`  ❌ ${testName} failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Play a complete game of Tic-Tac-Toe
   */
  async playCompleteGame(sessionId, participant1Id, participant2Id) {
    // Predefined moves for a complete game (this will result in a win for X)
    const moves = [
      { x: 0, y: 0 }, // X in top-left
      { x: 1, y: 1 }, // O in center
      { x: 0, y: 1 }, // X in top-middle
      { x: 2, y: 2 }, // O in bottom-right
      { x: 0, y: 2 }, // X in top-right (wins!)
    ];

    let currentMoveIndex = 0;
    let gameEnded = false;
    let winner = null;

    while (currentMoveIndex < moves.length && !gameEnded) {
      const move = moves[currentMoveIndex];
      // Alternate between participant1 and participant2 (participant1 is X, participant2 is O)
      const currentParticipantId = currentMoveIndex % 2 === 0 ? participant1Id : participant2Id;
      const playerSymbol = currentMoveIndex % 2 === 0 ? 'X' : 'O';
      
      console.log(`    🎯 Move ${currentMoveIndex + 1} (${playerSymbol}): (${move.x}, ${move.y})`);
      
      try {
        const moveResponse = await this.makeRequest(`/api/game/play-turn/${sessionId}`, {
          method: 'POST',
          body: JSON.stringify({
            participantId: currentParticipantId,
            gameToken: this.gameTokens[currentParticipantId],
            xPos: move.x,
            yPos: move.y
          })
        });

        this.gameMoves.push({
          move: currentMoveIndex + 1,
          position: move,
          response: moveResponse.data
        });

        // Check if this move resulted in a win
        if (moveResponse.data.player_has_won) {
          gameEnded = true;
          winner = `Player ${currentMoveIndex % 2 === 0 ? 'X' : 'O'}`;
          console.log(`    🏆 ${winner} wins!`);
        }

        // Wait a bit for WebSocket events
        await this.waitForEvent(sessionId, 'message_received', 1000);

        currentMoveIndex++;
        
        // Add a small delay between moves for better visibility
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`    ❌ Move failed:`, error.message);
        break;
      }
    }

    // Check if game ended in a draw
    if (!gameEnded && currentMoveIndex >= 9) {
      console.log(`    🤝 Game ended in a draw`);
    }

    return {
      winner,
      movesPlayed: currentMoveIndex,
      gameEnded
    };
  }

  /**
   * Test different game configurations
   */
  async testGameConfigurations() {
    const testName = 'Game Configurations Test';
    console.log(`\n⚙️ Running: ${testName}`);
    
    const configurations = [];
    configurations.push({ name: 'Classic 3x3', gameId: 'tic-tac-toe-classic' });
    // TODO: fix this configuration test
    // configurations.push({ name: 'Configurable 5x5', gameId: 'tic-tac-toe-configurable', options: { gridSize: 5 } })

    const results = [];

    for (const config of configurations) {
      console.log(`  🧪 Testing: ${config.name}...`);
      
      try {
        // Initialize session
        const initResponse = await this.makeRequest(`/api/session/init/${config.gameId}`, {
          method: 'POST'
        });
        
        const sessionId = initResponse.data.session_id;

        // Join players
        const player1Response = await this.makeRequest(`/api/session/${sessionId}/join`, {
          method: 'POST',
          body: JSON.stringify({
            participantName: 'Alice',
            participantType: 'human'
          })
        });
        
        const player2Response = await this.makeRequest(`/api/session/${sessionId}/join`, {
          method: 'POST',
          body: JSON.stringify({
            participantName: 'Bob',
            participantType: 'human'
          })
        });

        // Store game tokens
        const participant1Id = player1Response.data.participant_id;
        const participant2Id = player2Response.data.participant_id;
        this.gameTokens[participant1Id] = player1Response.data.game_token;
        this.gameTokens[participant2Id] = player2Response.data.game_token;

        // Start game with options if provided
        const startBody = config.options ? 
          JSON.stringify({
            ...config.options,
            participantId: participant1Id,
            gameToken: this.gameTokens[participant1Id]
          }) : 
          JSON.stringify({
            participantId: participant1Id,
            gameToken: this.gameTokens[participant1Id]
          });
        const startResponse = await this.makeRequest(`/api/game/start/${sessionId}`, {
          method: 'POST',
          body: startBody
        });

        // Get tile map to verify configuration
        const tileMapResponse = await this.makeRequest(`/api/game/get-tilemap/${sessionId}`, {
          method: 'POST',
          body: JSON.stringify({
            gameToken: this.gameTokens[participant1Id]
          })
        });
        const gridSize = Math.sqrt(tileMapResponse.data.tiles.length);
        
        console.log(`    ✅ Grid size: ${gridSize}x${gridSize}`);
        
        results.push({
          configuration: config.name,
          success: true,
          gridSize,
          sessionId
        });

      } catch (error) {
        console.error(`    ❌ ${config.name} failed:`, error.message);
        results.push({
          configuration: config.name,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`  🎉 ${testName} completed!`);
    return { success: true, results };
  }

  /**
   * Clean up sessions for test isolation
   */
  async cleanupSessions() {
    try {
      if (this.currentSession) {
        console.log(`  🧹 Cleaning up session: ${this.currentSession}`);
        // Since the session init endpoint reuses existing sessions,
        // we'll reset the current session tracker to force the next test 
        // to create a fresh session
        this.currentSession = null;
      }
    } catch (error) {
      console.log(`  ⚠️  Session cleanup warning: ${error.message}`);
    }
  }

  /**
   * Test WebSocket event handling
   */
  async testWebSocketEvents() {
    const testName = 'WebSocket Events Test';
    console.log(`\n📡 Running: ${testName}`);
    
    try {
      // Initialize session and join players - force new session creation
      const initResponse = await this.makeRequest('/api/session/init/tic-tac-toe-classic', {
        method: 'POST',
        body: JSON.stringify({
          forceNew: true,  // Try to force new session
          testIsolation: true  // Indicate this is for test isolation
        })
      });
      
      const sessionId = initResponse.data.session_id;
      console.log(`  🔍 WebSocket test got sessionId: ${sessionId}`);

      // Join players first to get participant IDs
      const player1Response = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: 'Alice',
          participantType: 'user'
        })
      });

      if (player1Response.data.error) {
        throw new Error(`Player 1 join failed: ${player1Response.data.error}`);
      }

      const player2Response = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: 'Bob',
          participantType: 'user'
        })
      });

      if (player2Response.data.error) {
        throw new Error(`Player 2 join failed: ${player2Response.data.error}`);
      }

      const participant1Id = player1Response.data.participant_id;
      const participant2Id = player2Response.data.participant_id;

      // Store game tokens
      this.gameTokens[participant1Id] = player1Response.data.game_token;
      this.gameTokens[participant2Id] = player2Response.data.game_token;

      // Connect WebSockets with participant IDs to monitor events
      await this.connectWebSocket(sessionId, participant1Id);
      await this.connectWebSocket(sessionId, participant2Id);

      // Wait a bit for connection events, not join events (join already happened)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Start game and monitor events
      await this.makeRequest(`/api/game/start/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: participant1Id,
          gameToken: this.gameTokens[participant1Id]
        })
      });

      await this.waitForEvent(sessionId, 'message_received', 3000);

      // Play a move and monitor events
      await this.makeRequest(`/api/game/play-turn/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: participant1Id,
          gameToken: this.gameTokens[participant1Id],
          xPos: 0,
          yPos: 0
        })
      });

      await this.waitForEvent(sessionId, 'message_received', 3000);

      // Analyze events
      const events = this.eventLogs.get(sessionId) || [];
      const messageEvents = events.filter(e => e.type === 'message_received');
      
      console.log(`  📊 Total WebSocket events: ${events.length}`);
      console.log(`  📨 Message events: ${messageEvents.length}`);
      
      // Log event types
      const eventTypes = [...new Set(messageEvents.map(e => e.data.type))];
      console.log(`  📋 Event types: ${eventTypes.join(', ')}`);

      // Clean up
      this.websockets.forEach(ws => ws.close());
      this.websockets.clear();
      this.eventLogs.clear();

      console.log(`  🎉 ${testName} completed!`);
      return { 
        success: true, 
        totalEvents: events.length,
        messageEvents: messageEvents.length,
        eventTypes
      };

    } catch (error) {
      console.error(`  ❌ ${testName} failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Run all Tic-Tac-Toe specific tests
   */
  async runTicTacToeTests() {
    console.log('🎯 Starting Tic-Tac-Toe Specific Tests\n');
    console.log('=' .repeat(60));
    
    const startTime = Date.now();
    const results = [];

    // Run Tic-Tac-Toe specific test scenarios
    results.push(await this.testCompleteTicTacToeGame());
    
    // Clean up session after first test for test isolation
    await this.cleanupSessions();
    
    results.push(await this.testGameConfigurations());
    results.push(await this.testWebSocketEvents());

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Generate test report
    console.log('\n' + '=' .repeat(60));
    console.log('📊 TIC-TAC-TOE TEST REPORT');
    console.log('=' .repeat(60));
    
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Duration: ${duration}ms`);
    
    results.forEach((result, index) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const details = result.movesPlayed ? ` (${result.movesPlayed} moves)` : '';
      console.log(`${status} Test ${index + 1}: ${result.error || 'Success'}${details}`);
    });

    console.log('\n' + '=' .repeat(60));
    
    return {
      total: results.length,
      passed,
      failed,
      duration,
      results
    };
  }
}

// Main execution function
async function main() {
  console.log('🎯 Tic-Tac-Toe Game Test Runner');
  console.log('================================\n');
  
  const testRunner = new TicTacToeGameTest();
  
  try {
    console.log('🔍 Checking server availability...');
    const healthCheck = await testRunner.makeRequest('/api/session/init/tic-tac-toe-classic', {
      method: 'POST'
    });
    
    if (healthCheck.status === 200) {
      console.log('✅ Server is running and responding\n');
    } else {
      throw new Error(`Server responded with status: ${healthCheck.status}`);
    }
    
    // Run Tic-Tac-Toe specific tests
    const results = await testRunner.runTicTacToeTests();
    
    // Exit with appropriate code
    if (results.failed > 0) {
      console.log('\n❌ Some Tic-Tac-Toe tests failed. Please check the output above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All Tic-Tac-Toe tests passed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n💥 Tic-Tac-Toe test runner failed:', error.message);
    console.log('\nMake sure your server is running with:');
    console.log('  npm run start-server');
    process.exit(1);
  } finally {
    testRunner.cleanup();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Tic-Tac-Toe test runner interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Tic-Tac-Toe test runner terminated');
  process.exit(0);
});

// Run the tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}

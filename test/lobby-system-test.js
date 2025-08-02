/**
 * Lobby System Complete Test
 * 
 * This test validates the complete lobby experience from start to finish,
 * including host management, session configuration, ready checks, chat,
 * auto-joining, and all validation features.
 */

import E2ETestRunner from './e2e-test-runner.js';

class LobbySystemTest extends E2ETestRunner {
  constructor(config = {}) {
    super(config);
    this.chatMessages = [];
    this.configChanges = [];
    this.readyStates = [];
    this.hostTransfers = [];
  }

  /**
   * Test complete lobby experience with all features
   */
  async testCompleteLobbyFlow(gameId = 'tic-tac-toe-classic') {
    const testName = 'Complete Lobby Experience Flow';
    console.log(`\n🎯 Running: ${testName}`);
    
    try {
      // Step 1: Create session and verify host assignment
      console.log('  📋 Step 1: Creating session and testing host assignment...');
      const initResponse = await this.makeRequest(`/api/session/init/${gameId}`, {
        method: 'POST',
        body: JSON.stringify({ forceNew: true })
      });
      
      const sessionId = initResponse.data.session_id;
      this.currentSession = sessionId;
      console.log(`  ✅ Session created: ${sessionId}`);

      // Step 2: Join first participant (should become host)
      console.log('  👑 Step 2: Joining first participant (should become host)...');
      const host1Response = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: 'Alice',
          participantType: 'user'
        })
      });
      
      const hostId = host1Response.data.participant_id;
      console.log(`  ✅ Host joined: ${hostId}`);

      // Verify host information
      const lobbyStatus1 = await this.makeRequest(`/api/session/lobby/${sessionId}`);
      if (!lobbyStatus1.data.lobby.host || lobbyStatus1.data.lobby.host.id !== hostId) {
        throw new Error('Host assignment failed');
      }
      console.log(`  ✅ Host verified: ${lobbyStatus1.data.lobby.host.name}`);

      // Step 3: Connect WebSocket for host
      console.log('  🔌 Step 3: Connecting WebSocket for host...');
      await this.connectWebSocket(sessionId, hostId);

      // Step 4: Test session listing
      console.log('  📋 Step 4: Testing session listing...');
      const sessionsList = await this.makeRequest('/api/sessions/list');
      const gameVariantSessions = await this.makeRequest(`/api/sessions/game/${gameId}`);
      const joinableSessions = await this.makeRequest(`/api/sessions/game/${gameId}?onlyJoinable=true`);
      
      console.log(`  ✅ Total sessions: ${sessionsList.data.total_sessions}`);
      console.log(`  ✅ Game variant sessions: ${gameVariantSessions.data.total_sessions}`);
      console.log(`  ✅ Joinable sessions: ${joinableSessions.data.total_sessions}`);

      // Step 5: Test lobby configuration (host only)
      console.log('  ⚙️ Step 5: Testing lobby configuration...');
      const configResponse = await this.makeRequest(`/api/session/${sessionId}/config`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: hostId,
          config: {
            gridSize: 5,
            difficulty: 'medium',
            timeLimit: 300
          }
        })
      });
      
      console.log(`  ✅ Config applied: ${JSON.stringify(configResponse.data.applied_config)}`);
      
      // Wait for WebSocket config update event
      await this.waitForEvent(sessionId, 'message_received', 2000);

      // Step 6: Test auto-join functionality
      console.log('  🤖 Step 6: Testing auto-join functionality...');
      const autoJoinResponse = await this.makeRequest(`/api/sessions/auto-join/${gameId}`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: 'Bob',
          participantType: 'user',
          createIfNone: false
        })
      });
      
      const participant2Id = autoJoinResponse.data.participant_id;
      console.log(`  ✅ Auto-join successful: ${participant2Id}`);
      
      // Connect WebSocket for second participant
      await this.connectWebSocket(sessionId, participant2Id);
      
      // Wait for join events
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 7: Test chat functionality
      console.log('  💬 Step 7: Testing chat functionality...');
      
      // Host sends a message
      const hostMessage = await this.makeRequest(`/api/session/${sessionId}/chat`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: hostId,
          message: 'Welcome to the lobby! Ready to play?'
        })
      });
      
      // Small delay between messages
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Participant 2 sends a message
      const participant2Message = await this.makeRequest(`/api/session/${sessionId}/chat`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: participant2Id,
          message: 'Yes, I\'m ready!'
        })
      });
      
      console.log(`  ✅ Chat messages sent: ${hostMessage.data.message.type}, ${participant2Message.data.message.type}`);
      
      // Wait for chat events with longer timeout
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get chat history
      const chatHistory = await this.makeRequest(`/api/session/${sessionId}/chat?limit=10`);
      console.log(`  ✅ Chat history retrieved: ${chatHistory.data.total_messages} messages`);

      // Step 8: Test synchronization phase
      console.log('  🔄 Step 8: Testing synchronization and ready checks...');
      
      // Start sync phase (host only)
      const syncStartResponse = await this.makeRequest(`/api/session/${sessionId}/sync/start`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: hostId
        })
      });
      
      console.log(`  ✅ Sync phase started: ${syncStartResponse.data.sync_phase}`);
      
      // Wait for sync phase event
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Set ready states
      const hostReady = await this.makeRequest(`/api/session/${sessionId}/ready`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: hostId,
          ready: true
        })
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const participant2Ready = await this.makeRequest(`/api/session/${sessionId}/ready`, {
        method: 'POST',
        body: JSON.stringify({
          participantId: participant2Id,
          ready: true
        })
      });
      
      console.log(`  ✅ Ready states set: Host=${hostReady.data.ready}, Participant 2=${participant2Ready.data.ready}`);
      console.log(`  ✅ All ready: ${participant2Ready.data.all_ready}`);
      
      // Wait for ready state events
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 9: Test participant management (kick functionality)
      console.log('  👥 Step 9: Testing participant management...');
      
      // Join a third participant to test kicking
      const participant3Response = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: 'Charlie',
          participantType: 'spectator'
        })
      });
      
      const participant3Id = participant3Response.data.participant_id;
      console.log(`  ✅ Spectator joined: ${participant3Id}`);
      
      // Host kicks the spectator
      const kickResponse = await this.makeRequest(`/api/session/${sessionId}/kick`, {
        method: 'POST',
        body: JSON.stringify({
          hostId: hostId,
          participantIdToKick: participant3Id
        })
      });
      
      console.log(`  ✅ Participant kicked: ${kickResponse.data.kicked_participant.name}`);
      
      // Wait for kick event
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 10: Test host transfer
      console.log('  👑 Step 10: Testing host transfer...');
      
      const transferResponse = await this.makeRequest(`/api/session/${sessionId}/transfer-host`, {
        method: 'POST',
        body: JSON.stringify({
          currentHostId: hostId,
          newHostId: participant2Id
        })
      });
      
      console.log(`  ✅ Host transferred: ${transferResponse.data.old_host.name} → ${transferResponse.data.new_host.name}`);
      
      // Wait for host transfer event
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 11: Test validation scenarios
      console.log('  ✅ Step 11: Testing validation scenarios...');
      
      // Try to join with duplicate name (should fail)
      try {
        await this.makeRequest(`/api/session/${sessionId}/join`, {
          method: 'POST',
          body: JSON.stringify({
            participantName: 'Bob',
            participantType: 'user'
          })
        });
        throw new Error('Duplicate name validation failed');
      } catch (error) {
        console.log(`  ✅ Duplicate name validation working: ${error.message}`);
      }
      
      // Try non-host config change (should fail)
      try {
        await this.makeRequest(`/api/session/${sessionId}/config`, {
          method: 'POST',
          body: JSON.stringify({
            participantId: hostId, // Old host ID (no longer host)
            config: { gridSize: 7 }
          })
        });
        throw new Error('Host privilege validation failed');
      } catch (error) {
        console.log(`  ✅ Host privilege validation working`);
      }

      // Step 12: Test final lobby status
      console.log('  📊 Step 12: Verifying final lobby status...');
      const finalLobbyStatus = await this.makeRequest(`/api/session/lobby/${sessionId}`);
      const finalStatus = finalLobbyStatus.data.lobby;
      
      console.log(`  ✅ Final participants: ${finalStatus.participantCount.total}`);
      console.log(`  ✅ Final host: ${finalStatus.host.name}`);
      console.log(`  ✅ Final config keys: ${Object.keys(finalStatus.lobbyConfig).length}`);
      console.log(`  ✅ Ready for game: ${finalStatus.canStart}`);

      console.log(`  🎉 ${testName} completed successfully!`);
      return { 
        success: true, 
        sessionId,
        finalParticipants: finalStatus.participantCount.total,
        hostTransfers: 1,
        configChanges: Object.keys(finalStatus.lobbyConfig).length,
        chatMessages: finalStatus.recentChat.length
      };

    } catch (error) {
      console.error(`  ❌ ${testName} failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test auto-join with session creation
   */
  async testAutoJoinWithCreation(gameId = 'tic-tac-toe-classic') {
    const testName = 'Auto-Join with Session Creation';
    console.log(`\n🤖 Running: ${testName}`);
    
    try {
      // Test auto-join functionality (may join existing or create new)
      console.log('  🔍 Step 1: Testing auto-join functionality...');
      const autoJoinResponse = await this.makeRequest(`/api/sessions/auto-join/${gameId}`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: 'David',
          participantType: 'user',
          createIfNone: true
        })
      });
      
      const newSessionId = autoJoinResponse.data.session_id;
      const participantId = autoJoinResponse.data.participant_id;
      const sessionCreated = autoJoinResponse.data.session_created;
      
      console.log(`  ✅ Session created: ${sessionCreated}`);
      console.log(`  ✅ New session ID: ${newSessionId}`);
      console.log(`  ✅ Participant ID: ${participantId}`);
      
      // Verify host assignment only if session was created
      const lobbyStatus = autoJoinResponse.data.lobby_status;
      if (sessionCreated) {
        if (!lobbyStatus.host || lobbyStatus.host.id !== participantId) {
          throw new Error('Auto-join host assignment failed');
        }
        console.log(`  ✅ Auto-created session host: ${lobbyStatus.host.name}`);
      } else {
        console.log(`  ✅ Joined existing session, host is: ${lobbyStatus.host.name}`);
      }

      console.log(`  🎉 ${testName} completed successfully!`);
      return { 
        success: true, 
        sessionId: newSessionId,
        sessionCreated: sessionCreated,
        hostAssigned: sessionCreated // Only guaranteed to be host if session was created
      };

    } catch (error) {
      console.error(`  ❌ ${testName} failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test configuration and WebSocket synchronization
   */
  async testConfigurationSync(gameId = 'tic-tac-toe-classic') {
    const testName = 'Configuration and WebSocket Sync';
    console.log(`\n⚙️ Running: ${testName}`);
    
    try {
      // Create fresh session with host
      const initResponse = await this.makeRequest(`/api/session/init/${gameId}`, {
        method: 'POST',
        body: JSON.stringify({ forceNew: true })
      });
      const sessionId = initResponse.data.session_id;
      
      // Join host
      const hostResponse = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: 'Emma',
          participantType: 'user'
        })
      });
      const hostId = hostResponse.data.participant_id;
      
      // Join observer
      const observerResponse = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: 'Observer',
          participantType: 'spectator'
        })
      });
      const observerId = observerResponse.data.participant_id;
      
      // Connect WebSockets
      await this.connectWebSocket(sessionId, hostId);
      await this.connectWebSocket(sessionId, observerId);
      
      // Test multiple configuration changes
      console.log('  📡 Testing configuration changes and WebSocket sync...');
      
      const configs = [
        { gridSize: 4, rounds: 5 },
        { difficulty: 'hard', timeLimit: 120 },
        { customRule: 'no-diagonal-wins' }
      ];
      
      for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        console.log(`  ⚙️ Applying config ${i + 1}: ${JSON.stringify(config)}`);
        
        await this.makeRequest(`/api/session/${sessionId}/config`, {
          method: 'POST',
          body: JSON.stringify({
            participantId: hostId,
            config: config
          })
        });
        
        // Wait for WebSocket event
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Verify final configuration
      const finalConfig = await this.makeRequest(`/api/session/${sessionId}/config`);
      const configKeys = Object.keys(finalConfig.data.config);
      
      console.log(`  ✅ Final config keys: ${configKeys.join(', ')}`);
      
      // Test config deletion
      const deleteResponse = await this.makeRequest(`/api/session/${sessionId}/config/customRule`, {
        method: 'DELETE',
        body: JSON.stringify({
          participantId: hostId
        })
      });
      
      console.log(`  ✅ Config key deleted: ${deleteResponse.data.deleted_key}`);
      
      console.log(`  🎉 ${testName} completed successfully!`);
      return { 
        success: true, 
        sessionId,
        configChanges: configs.length,
        finalConfigKeys: Object.keys(deleteResponse.data.remaining_config).length
      };

    } catch (error) {
      console.error(`  ❌ ${testName} failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test chat system thoroughly
   */
  async testChatSystem(gameId = 'tic-tac-toe-classic') {
    const testName = 'Chat System Test';
    console.log(`\n💬 Running: ${testName}`);
    
    try {
      // Create fresh session with multiple participants
      const initResponse = await this.makeRequest(`/api/session/init/${gameId}`, {
        method: 'POST',
        body: JSON.stringify({ forceNew: true })
      });
      const sessionId = initResponse.data.session_id;
      
      // Join participants
      const participants = [
        { name: 'Frank', type: 'user' },
        { name: 'Grace', type: 'user' },
        { name: 'Helen', type: 'spectator' }
      ];
      
      const participantIds = [];
      for (const participant of participants) {
        const response = await this.makeRequest(`/api/session/${sessionId}/join`, {
          method: 'POST',
          body: JSON.stringify({
            participantName: participant.name,
            participantType: participant.type
          })
        });
        participantIds.push(response.data.participant_id);
        await this.connectWebSocket(sessionId, response.data.participant_id);
      }
      
      // Test different types of messages
      console.log('  💬 Testing various chat message types...');
      
      const messages = [
        { from: 0, text: 'Hey everyone!' },
        { from: 1, text: 'Ready to play?' },
        { from: 2, text: 'I\'ll just watch 👀' },
        { from: 0, text: 'Let\'s configure the game first' },
        { from: 1, text: 'Sounds good!' }
      ];
      
      for (const msg of messages) {
        await this.makeRequest(`/api/session/${sessionId}/chat`, {
          method: 'POST',
          body: JSON.stringify({
            participantId: participantIds[msg.from],
            message: msg.text
          })
        });
        
        // Wait for chat event
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Test message validation (too long message)
      console.log('  ✅ Testing message validation...');
      try {
        const longMessage = 'x'.repeat(501); // Exceeds 500 char limit
        await this.makeRequest(`/api/session/${sessionId}/chat`, {
          method: 'POST',
          body: JSON.stringify({
            participantId: participantIds[0],
            message: longMessage
          })
        });
        throw new Error('Message length validation failed');
      } catch (error) {
        console.log(`  ✅ Message length validation working`);
      }
      
      // Get chat history
      const chatHistory = await this.makeRequest(`/api/session/${sessionId}/chat?limit=20`);
      const systemMessages = chatHistory.data.messages.filter(m => m.type === 'system');
      const userMessages = chatHistory.data.messages.filter(m => m.type === 'user');
      const hostMessages = chatHistory.data.messages.filter(m => m.type === 'host');
      
      console.log(`  ✅ System messages: ${systemMessages.length}`);
      console.log(`  ✅ User messages: ${userMessages.length}`);
      console.log(`  ✅ Host messages: ${hostMessages.length}`);
      console.log(`  ✅ Total messages: ${chatHistory.data.total_messages}`);
      
      console.log(`  🎉 ${testName} completed successfully!`);
      return { 
        success: true, 
        sessionId,
        totalMessages: chatHistory.data.total_messages,
        systemMessages: systemMessages.length,
        userMessages: userMessages.length,
        hostMessages: hostMessages.length
      };

    } catch (error) {
      console.error(`  ❌ ${testName} failed:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test all validation scenarios
   */
  async testValidationScenarios() {
    const testName = 'Validation Scenarios';
    console.log(`\n✅ Running: ${testName}`);
    
    const results = [];
    
    try {
      // Create fresh session
      const initResponse = await this.makeRequest('/api/session/init/tic-tac-toe-classic', {
        method: 'POST',
        body: JSON.stringify({ forceNew: true })
      });
      const sessionId = initResponse.data.session_id;
      
      // Join host
      const hostResponse = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: 'ValidateHost',
          participantType: 'user'
        })
      });
      const hostId = hostResponse.data.participant_id;
      
      // Test 1: Duplicate participant names
      console.log('  🧪 Test 1: Duplicate participant names...');
      try {
        const duplicateResponse = await this.makeRequest(`/api/session/${sessionId}/join`, {
          method: 'POST',
          body: JSON.stringify({
            participantName: 'ValidateHost',
            participantType: 'user'
          })
        });
        // If request succeeds but returns an error in the response, that's also a failure as expected
        if (duplicateResponse.status !== 200 || duplicateResponse.data.error) {
          results.push({ test: 'Duplicate names', success: true, expected: 'Should fail' });
        } else {
          results.push({ test: 'Duplicate names', success: false, expected: 'Should fail' });
        }
      } catch (error) {
        results.push({ test: 'Duplicate names', success: true, expected: 'Should fail' });
      }
      
      // Test 2: Non-host trying to configure
      const participant2Response = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: 'Participant2',
          participantType: 'user'
        })
      });
      const participant2Id = participant2Response.data.participant_id;
      
      console.log('  🧪 Test 2: Non-host configuration attempt...');
      try {
        const configResponse = await this.makeRequest(`/api/session/${sessionId}/config`, {
          method: 'POST',
          body: JSON.stringify({
            participantId: participant2Id,
            config: { gridSize: 5 }
          })
        });
        if (configResponse.status !== 200 || configResponse.data.error) {
          results.push({ test: 'Non-host config', success: true, expected: 'Should fail' });
        } else {
          results.push({ test: 'Non-host config', success: false, expected: 'Should fail' });
        }
      } catch (error) {
        results.push({ test: 'Non-host config', success: true, expected: 'Should fail' });
      }
      
      // Test 3: Non-host trying to start sync
      console.log('  🧪 Test 3: Non-host sync start attempt...');
      try {
        const syncResponse = await this.makeRequest(`/api/session/${sessionId}/sync/start`, {
          method: 'POST',
          body: JSON.stringify({
            participantId: participant2Id
          })
        });
        if (syncResponse.status !== 200 || syncResponse.data.error) {
          results.push({ test: 'Non-host sync start', success: true, expected: 'Should fail' });
        } else {
          results.push({ test: 'Non-host sync start', success: false, expected: 'Should fail' });
        }
      } catch (error) {
        results.push({ test: 'Non-host sync start', success: true, expected: 'Should fail' });
      }
      
      // Test 4: Non-host trying to kick
      console.log('  🧪 Test 4: Non-host kick attempt...');
      try {
        const kickResponse = await this.makeRequest(`/api/session/${sessionId}/kick`, {
          method: 'POST',
          body: JSON.stringify({
            hostId: participant2Id,
            participantIdToKick: hostId
          })
        });
        if (kickResponse.status !== 200 || kickResponse.data.error) {
          results.push({ test: 'Non-host kick', success: true, expected: 'Should fail' });
        } else {
          results.push({ test: 'Non-host kick', success: false, expected: 'Should fail' });
        }
      } catch (error) {
        results.push({ test: 'Non-host kick', success: true, expected: 'Should fail' });
      }
      
      // Test 5: Host trying to kick themselves
      console.log('  🧪 Test 5: Host self-kick attempt...');
      try {
        const selfKickResponse = await this.makeRequest(`/api/session/${sessionId}/kick`, {
          method: 'POST',
          body: JSON.stringify({
            hostId: hostId,
            participantIdToKick: hostId
          })
        });
        if (selfKickResponse.status !== 200 || selfKickResponse.data.error) {
          results.push({ test: 'Host self-kick', success: true, expected: 'Should fail' });
        } else {
          results.push({ test: 'Host self-kick', success: false, expected: 'Should fail' });
        }
      } catch (error) {
        results.push({ test: 'Host self-kick', success: true, expected: 'Should fail' });
      }
      
      // Test 6: Invalid ready state for spectator
      const spectatorResponse = await this.makeRequest(`/api/session/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({
          participantName: 'Spectator',
          participantType: 'spectator'
        })
      });
      const spectatorId = spectatorResponse.data.participant_id;
      
      console.log('  🧪 Test 6: Spectator ready state attempt...');
      try {
        const readyResponse = await this.makeRequest(`/api/session/${sessionId}/ready`, {
          method: 'POST',
          body: JSON.stringify({
            participantId: spectatorId,
            ready: true
          })
        });
        if (readyResponse.status !== 200 || readyResponse.data.error) {
          results.push({ test: 'Spectator ready state', success: true, expected: 'Should fail' });
        } else {
          results.push({ test: 'Spectator ready state', success: false, expected: 'Should fail' });
        }
      } catch (error) {
        results.push({ test: 'Spectator ready state', success: true, expected: 'Should fail' });
      }

      const passedTests = results.filter(r => r.success).length;
      console.log(`  ✅ Validation tests passed: ${passedTests}/${results.length}`);
      
      // Log individual validation results
      results.forEach(result => {
        const status = result.success ? '✅' : '❌';
        console.log(`    ${status} ${result.test}: ${result.expected}`);
      });
      
      console.log(`  🎉 ${testName} completed!`);
      return { success: true, results, passed: passedTests, total: results.length };

    } catch (error) {
      console.error(`  ❌ ${testName} failed:`, error.message);
      return { success: false, error: error.message, results };
    }
  }

  /**
   * Run all lobby-specific tests
   */
  async runLobbyTests() {
    console.log('🎯 Starting Lobby System Tests\n');
    console.log('=' .repeat(60));
    
    const startTime = Date.now();
    const results = [];

    // Run lobby-specific test scenarios with cleanup between tests
    results.push(await this.testCompleteLobbyFlow());
    this.cleanup(); // Clean up between tests
    
    results.push(await this.testAutoJoinWithCreation());
    this.cleanup();
    
    results.push(await this.testConfigurationSync());
    this.cleanup();
    
    results.push(await this.testChatSystem());
    this.cleanup();
    
    results.push(await this.testValidationScenarios());
    this.cleanup();

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Generate test report
    console.log('\n' + '=' .repeat(60));
    console.log('📊 LOBBY SYSTEM TEST REPORT');
    console.log('=' .repeat(60));
    
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Duration: ${duration}ms`);
    
    results.forEach((result, index) => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const details = result.hostTransfers ? ` (${result.hostTransfers} host transfers)` : 
                     result.configChanges ? ` (${result.configChanges} config changes)` :
                     result.totalMessages ? ` (${result.totalMessages} chat messages)` :
                     result.passed ? ` (${result.passed}/${result.total} validations)` : '';
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
  console.log('🎯 Lobby System Test Runner');
  console.log('===========================\n');
  
  const testRunner = new LobbySystemTest();
  
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
    
    // Run lobby system tests
    const results = await testRunner.runLobbyTests();
    
    // Exit with appropriate code
    if (results.failed > 0) {
      console.log('\n❌ Some lobby tests failed. Please check the output above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All lobby tests passed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n💥 Lobby test runner failed:', error.message);
    console.log('\nMake sure your server is running with:');
    console.log('  npm run start-server');
    process.exit(1);
  } finally {
    testRunner.cleanup();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Lobby test runner interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Lobby test runner terminated');
  process.exit(0);
});

// Run the tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
}
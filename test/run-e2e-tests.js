#!/usr/bin/env node

/**
 * KubicKode End-to-End Test Runner Script
 * 
 * Usage:
 *   node test/run-e2e-tests.js
 *   node test/run-e2e-tests.js --game tic-tac-toe-configurable
 *   node test/run-e2e-tests.js --url http://localhost:3001
 */

import E2ETestRunner from './e2e-test-runner.js';

// Parse command line arguments
const args = process.argv.slice(2);
const config = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--url' && args[i + 1]) {
    config.baseUrl = args[i + 1];
    config.wsUrl = args[i + 1].replace('http', 'ws');
    i++;
  } else if (arg === '--game' && args[i + 1]) {
    config.defaultGame = args[i + 1];
    i++;
  } else if (arg === '--timeout' && args[i + 1]) {
    config.timeout = parseInt(args[i + 1]);
    i++;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
KubicKode End-to-End Test Runner

Usage:
  node test/run-e2e-tests.js [options]

Options:
  --url <url>           Server URL (default: http://localhost:3000)
  --game <gameId>       Default game ID (default: tic-tac-toe-classic)
  --timeout <ms>        Request timeout in milliseconds (default: 10000)
  --help, -h           Show this help message

Examples:
  node test/run-e2e-tests.js
  node test/run-e2e-tests.js --url http://localhost:3001
  node test/run-e2e-tests.js --game tic-tac-toe-configurable
  node test/run-e2e-tests.js --timeout 15000
`);
    process.exit(0);
  }
}

async function main() {
  console.log('🎮 KubicKode End-to-End Test Runner');
  console.log('=====================================\n');
  
  // Check if server is running
  const testRunner = new E2ETestRunner(config);
  
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
    
    // Run all tests
    const results = await testRunner.runAllTests();
    
    // Exit with appropriate code
    if (results.failed > 0) {
      console.log('\n❌ Some tests failed. Please check the output above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed successfully!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('\n💥 Test runner failed:', error.message);
    console.log('\nMake sure your server is running with:');
    console.log('  npm run start-server');
    console.log('\nOr check the server URL with:');
    console.log('  node test/run-e2e-tests.js --url <your-server-url>');
    process.exit(1);
  } finally {
    testRunner.cleanup();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Test runner interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Test runner terminated');
  process.exit(0);
});

// Run the tests
main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
}); 
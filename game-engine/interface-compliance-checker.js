import { gameContract } from './game-contract.js';

// Utility to check if a game class implements the required contract
export function checkGameContractCompliance(gameInstance, className = 'GameInstance') {
  try {
    return gameContract.validateGameInstance(gameInstance, className);
  } catch (error) {
    console.error(`❌ ${className} contract validation failed:`, error.message);
    return { valid: false, error: error.message };
  }
}

// Validate that a game instance has all required methods
export function validateGameInstance(gameInstance, className = 'GameInstance') {
  return checkGameContractCompliance(gameInstance, className);
}

// Legacy function for backward compatibility
export function checkGameInterfaceCompliance(gameInstance, className = 'GameInstance') {
  console.warn('checkGameInterfaceCompliance is deprecated, use checkGameContractCompliance instead');
  return checkGameContractCompliance(gameInstance, className);
} 
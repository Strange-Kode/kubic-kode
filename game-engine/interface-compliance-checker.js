import { GAME_INTERFACE_METHODS } from './game-interface.js';

// Utility to check if a game class implements the GameInterface
export function checkGameInterfaceCompliance(gameInstance, className = 'GameInstance') {
  const missingMethods = [];
  
  for (const methodName of GAME_INTERFACE_METHODS) {
    if (typeof gameInstance[methodName] !== 'function') {
      missingMethods.push(methodName);
    }
  }
  
  if (missingMethods.length > 0) {
    console.warn(`⚠️  ${className} is missing required interface methods:`, missingMethods);
    return false;
  }
  
  console.log(`✅ ${className} implements all required GameInterface methods`);
  return true;
}

// Validate that a game instance has all required methods
export function validateGameInstance(gameInstance, className = 'GameInstance') {
  return checkGameInterfaceCompliance(gameInstance, className);
} 
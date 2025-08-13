/**
 * Rock Paper Scissors - KubicKode Helper Usage Example
 * This example demonstrates how to use KubicKodeHelper with Alpine.js
 * for a Rock-Paper-Scissors game implementation.
 */

// Import the KubicKode helper
import { KubicKode } from "./kubic-kode-helper.js";

// Example 1: Basic Setup and Configuration
async function basicSetup() {
    console.log("🚀 Setting up KubicKode for Rock Paper Scissors...");
    
    // Configure the helper
    KubicKode.configure({
        apiPrefix: "http://localhost:3000/api",
        autoReconnect: true,
        retryAttempts: 3,
        retryDelay: 1000
    });
    
    // Register the RPS game type
    KubicKode.game.register("rock-paper-scissors");
    
    // Set up WebSocket connection for real-time events
    KubicKode.connectWebSocket();
    
    console.log("✅ Basic setup complete");
}

// Example 2: Session Management
async function sessionManagement() {
    console.log("🎮 Managing game session...");
    
    try {
        // Initialize a new session for RPS
        const initResponse = await KubicKode.initSession("rock-paper-scissors");
        console.log("Session initialized:", initResponse.data.session_id);
        
        // Join the session as a player
        const joinResponse = await KubicKode.joinSession("Alice", "human");
        console.log("Joined session:", joinResponse.data);
        
        // Get session participants
        const participants = await KubicKode.route.session("participants");
        console.log("Participants:", participants.data);
        
    } catch (error) {
        console.error("Session management error:", error);
    }
}

// Example 3: Game Flow
async function gameFlow() {
    console.log("🎯 Starting game flow...");
    
    try {
        // Start the game with options
        const startResponse = await KubicKode.startGame({
            playStyle: "competitive",
            maxRounds: 5,
            timeLimit: 30
        });
        console.log("Game started:", startResponse.data);
        
        // Check if game is active
        const isActive = await KubicKode.route.game("is-active");
        console.log("Game active:", isActive.data);
        
        // Get current player
        const currentPlayer = await KubicKode.route.game("get-current-player");
        console.log("Current player:", currentPlayer.data);
        
    } catch (error) {
        console.error("Game flow error:", error);
    }
}

// Example 4: Making Game Moves
async function makeGameMoves() {
    console.log("🎲 Making game moves...");
    
    try {
        // Make a move using the dynamic game method
        const moveResponse = await KubicKode.rock_paper_scissors.playTurn(0, 0, {
            choice: "rock",
            playerName: "Alice"
        });
        console.log("Move made:", moveResponse.data);
        
        // Alternative: Use the generic playTurn method
        const genericMove = await KubicKode.playTurn(0, 0, {
            choice: "paper",
            playerName: "Alice"
        });
        console.log("Generic move:", genericMove.data);
        
    } catch (error) {
        console.error("Move error:", error);
    }
}

// Example 5: Event Handling
function setupEventHandlers() {
    console.log("📡 Setting up event handlers...");
    
    // WebSocket connection events
    KubicKode.events
        .on("websocketConnected", (data) => {
            console.log("🔌 WebSocket connected");
        })
        .on("websocketDisconnected", (data) => {
            console.log("🔌 WebSocket disconnected");
        })
        .on("websocketError", (error) => {
            console.error("WebSocket error:", error);
        });
    
    // Session events
    KubicKode.events
        .on("sessionInitialized", (data) => {
            console.log("📋 Session initialized:", data.sessionId);
        });
    
    // Game events
    KubicKode.events
        .on("gameStarted", (data) => {
            console.log("🎮 Game started:", data);
        })
        .on("turnPlayed", (data) => {
            console.log("🎲 Turn played:", data);
        })
        .on("gameEnded", (data) => {
            console.log("🏁 Game ended:", data);
        })
        .on("playerJoined", (data) => {
            console.log("👤 Player joined:", data);
        })
        .on("playerLeft", (data) => {
            console.log("👤 Player left:", data);
        });
    
    console.log("✅ Event handlers set up");
}

// Example 6: Complete Game Session
async function completeGameSession() {
    console.log("🎯 Complete RPS game session...");
    
    try {
        // 1. Setup
        await basicSetup();
        setupEventHandlers();
        
        // 2. Session management
        await sessionManagement();
        
        // 3. Game flow
        await gameFlow();
        
        // 4. Make some moves
        await makeGameMoves();
        
        // 5. Get game state
        const state = KubicKode.getState();
        console.log("Current state:", state);
        
        // 6. Clean up
        await KubicKode.route.game("stop");
        console.log("🎉 Game session completed!");
        
    } catch (error) {
        console.error("Game session error:", error);
    }
}

// Example 7: Alpine.js Integration Helper
function createAlpineComponent() {
    return {
        // Alpine.js component state
        connected: false,
        sessionId: null,
        playerName: "",
        gameStarted: false,
        isMyTurn: false,
        loading: false,
        error: null,
        success: null,
        
        // Game state
        playerChoice: null,
        opponentChoice: null,
        playerScore: 0,
        opponentScore: 0,
        
        // Initialize component
        async init() {
            try {
                // Setup KubicKode
                await basicSetup();
                setupEventHandlers();
                
                // Initialize session
                const response = await KubicKode.initSession("rock-paper-scissors");
                this.sessionId = response.data.session_id;
                this.connected = true;
                
            } catch (error) {
                this.error = "Failed to initialize: " + error.message;
            }
        },
        
        // Join game
        async joinGame() {
            if (!this.playerName.trim()) {
                this.error = "Please enter your name";
                return;
            }
            
            try {
                this.loading = true;
                await KubicKode.joinSession(this.playerName, "human");
                this.success = "Joined game successfully";
            } catch (error) {
                this.error = "Failed to join: " + error.message;
            } finally {
                this.loading = false;
            }
        },
        
        // Start game
        async startGame() {
            try {
                this.loading = true;
                const response = await KubicKode.startGame({
                    playStyle: "competitive",
                    maxRounds: 5
                });
                
                this.gameStarted = true;
                this.isMyTurn = response.data.currentPlayer === this.playerName;
                this.success = "Game started!";
                
            } catch (error) {
                this.error = "Failed to start game: " + error.message;
            } finally {
                this.loading = false;
            }
        },
        
        // Make choice
        async makeChoice(choice) {
            if (!this.isMyTurn) return;
            
            try {
                this.loading = true;
                this.playerChoice = choice;
                
                await KubicKode.rock_paper_scissors.playTurn(0, 0, {
                    choice: choice,
                    playerName: this.playerName
                });
                
                this.isMyTurn = false;
                this.success = `You chose ${choice}`;
                
            } catch (error) {
                this.error = "Failed to make choice: " + error.message;
                this.playerChoice = null;
            } finally {
                this.loading = false;
            }
        },
        
        // Utility methods
        showError(message) {
            this.error = message;
            this.success = null;
            setTimeout(() => this.error = null, 5000);
        },
        
        showSuccess(message) {
            this.success = message;
            this.error = null;
            setTimeout(() => this.success = null, 3000);
        }
    };
}

// Export for use in other modules
export {
    basicSetup,
    sessionManagement,
    gameFlow,
    makeGameMoves,
    setupEventHandlers,
    completeGameSession,
    createAlpineComponent
};

// Example usage in browser console:
// 
// 1. Basic usage:
// await basicSetup();
// 
// 2. Complete session:
// await completeGameSession();
// 
// 3. For Alpine.js:
// // In your HTML, use: x-data="createAlpineComponent()" 
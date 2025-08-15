import { useState, useEffect, useCallback, useRef } from "react";
import { useFetch } from "./useFetch.js";

/**
 * React hook for using KubicKode API with native fetch
 * Provides state management and game-specific methods
 * This demo shows how to integrate with the API directly without the helper
 */
export function useKubicKode(gameId = null) {
  // State management
  const [sessionId, setSessionId] = useState(null);
  const [participantId, setParticipantId] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [tileMap, setTileMap] = useState(null);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Refs for cleanup
  const eventListeners = useRef(new Set());

  // Fetch helper
  const { get, post } = useFetch();

  // Helper function to extract current player ID from response data
  const extractCurrentPlayerId = useCallback((data) => {
    // Handle both array format (current_player_ids) and single value format (current_player_id)
    if (data.current_player_id !== undefined) {
      // returnSinglePlayerId format: single player ID
      return data.current_player_id;
    } else if (data.current_player_ids) {
      return data.current_player_ids.length > 0 ? data.current_player_ids[0] : null;
    }
    return null;
  }, []);

  // Game token management helpers
  const storeGameToken = useCallback((sessionId, participantId, gameToken) => {
    try {
      const tokens = getAllGameTokens();
      tokens[sessionId] = tokens[sessionId] || {};
      tokens[sessionId][participantId] = gameToken;
      localStorage.setItem("kubic_game_tokens", JSON.stringify(tokens));
      console.log(`🔐 Stored game token for session: ${sessionId}, participant: ${participantId}`);
    } catch (error) {
      console.error("Error storing game token:", error);
    }
  }, []);

  const getGameToken = useCallback((sessionId, participantId) => {
    try {
      const tokens = getAllGameTokens();
      return tokens[sessionId]?.[participantId] || null;
    } catch (error) {
      console.error("Error getting game token:", error);
      return null;
    }
  }, []);

  const clearGameToken = useCallback((sessionId, participantId) => {
    try {
      const tokens = getAllGameTokens();
      if (tokens[sessionId]) {
        delete tokens[sessionId][participantId];
        if (Object.keys(tokens[sessionId]).length === 0) {
          delete tokens[sessionId];
        }
        localStorage.setItem("kubic_game_tokens", JSON.stringify(tokens));
        console.log(`🔐 Cleared game token for session: ${sessionId}, participant: ${participantId}`);
      }
    } catch (error) {
      console.error("Error clearing game token:", error);
    }
  }, []);

  const getAllGameTokens = useCallback(() => {
    try {
      const stored = localStorage.getItem("kubic_game_tokens");
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error("Error getting all game tokens:", error);
      return {};
    }
  }, []);

  // Initialize KubicKode
  useEffect(() => {
    if (gameId) {
      // Initialize session when gameId is provided
      initSession(gameId);
    }

    // Set up event listeners for WebSocket events
    const listeners = [
      // WebSocket connection events
      { type: "websocketConnected", handler: () => setIsConnected(true) },
      { type: "websocketDisconnected", handler: () => setIsConnected(false) },
      { type: "websocketError", handler: (error) => setError(`WebSocket error: ${error.message}`) },
      
      // Session events
      { type: "sessionInitialized", handler: ({ sessionId }) => {
        setSessionId(sessionId);
        setError(null);
      }},
      
      // Game events
      { type: "gameStarted", handler: () => {
        setGameState("active");
        setError(null);
      }},
      
      { type: "gameStopped", handler: () => {
        setGameState("stopped");
      }},
      
      { type: "turnPlayed", handler: () => {
        // Refresh tile map and current player
        fetchTileMap();
        fetchCurrentPlayer();
      }},
    ];

    // Store listeners for cleanup
    listeners.forEach(listener => eventListeners.current.add(listener));

    // Connect WebSocket if session is available
    if (sessionId) {
      connectWebSocket();
    }

    // Cleanup function
    return () => {
      eventListeners.current.forEach(listener => {
        if (listener && typeof listener.off === "function") {
          listener.off();
        }
      });
      eventListeners.current.clear();
    };
  }, [gameId, sessionId]);

  // Helper function to handle API calls
  const apiCall = useCallback(async (apiFunction, ...args) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await apiFunction.apply(null, args);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Session management
  const initSession = useCallback(async (gameType = gameId) => {
    return await apiCall(get, `/api/session/init/${gameType}`);
  }, [apiCall, gameId, get]);

  const joinSession = useCallback(async (participantName, participantType = "user") => {
    if (!sessionId) {
      throw new Error("Session not initialized");
    }

    const result = await apiCall(post, `/api/session/${sessionId}/join`, {
      participantName,
      participantType
    });

    if (result.success) {
      setParticipantId(result.data.participant_id);
      
      // Store the game token if it's provided
      if (result.data.game_token) {
        storeGameToken(sessionId, result.data.participant_id, result.data.game_token);
      }
    }
    return result;
  }, [sessionId, apiCall, post, storeGameToken]);

  const leaveSession = useCallback(async () => {
    if (!sessionId || !participantId) {
      throw new Error("No active session or participant to leave");
    }

    const result = await apiCall(post, `/api/session/${sessionId}/leave`, {
      participantId: participantId
    });

    if (result.success) {
      // Clear the game token
      clearGameToken(sessionId, participantId);
      
      // Reset state
      setParticipantId(null);
      setSessionId(null);
      setParticipants([]);
      setGameState(null);
      setTileMap(null);
      setCurrentPlayer(null);
      
      // Disconnect WebSocket
      disconnectWebSocket();
    }
    return result;
  }, [sessionId, participantId, apiCall, post, clearGameToken]);

  const fetchParticipants = useCallback(async () => {
    if (!sessionId) return;
    
    const result = await apiCall(get, `/api/session/${sessionId}/participants/list`);
    if (result.success) {
      setParticipants(result.data);
    }
    return result;
  }, [sessionId, apiCall, get]);

  // Game management - All now use POST with game tokens
  const startGame = useCallback(async (options = {}) => {
    if (!sessionId || !participantId) {
      throw new Error("Session and participant required to start game");
    }

    const gameToken = getGameToken(sessionId, participantId);
    if (!gameToken) {
      throw new Error("No game token available to start game");
    }

    const result = await apiCall(post, `/api/game/${sessionId}/start`, {
      participantId: participantId,
      gameToken: gameToken,
      ...options
    });

    if (result.success) {
      setGameState("active");
    }
    return result;
  }, [sessionId, participantId, apiCall, post, getGameToken]);

  const stopGame = useCallback(async () => {
    if (!sessionId || !participantId) {
      throw new Error("Session and participant required to stop game");
    }

    const gameToken = getGameToken(sessionId, participantId);
    if (!gameToken) {
      throw new Error("No game token available to stop game");
    }

    const result = await apiCall(post, `/api/game/${sessionId}/stop`, {
      participantId: participantId,
      gameToken: gameToken
    });

    if (result.success) {
      setGameState("stopped");
    }
    return result;
  }, [sessionId, participantId, apiCall, post, getGameToken]);

  const fetchTileMap = useCallback(async () => {
    if (!sessionId) return;
    
    const gameToken = getGameToken(sessionId, participantId);
    if (!gameToken) {
      console.warn("[useKubicKode] No game token available for fetchTileMap");
      return;
    }

    const result = await apiCall(post, `/api/game/${sessionId}/get-tilemap`, {
      gameToken: gameToken
    });

    if (result.success) {
      setTileMap(result.data);
    }
    return result;
  }, [sessionId, participantId, apiCall, post, getGameToken]);

  const getCurrentPlayer = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    const gameToken = getGameToken(sessionId, participantId);
    if (!gameToken) {
      console.warn("[useKubicKode] No game token available for getCurrentPlayer");
      return;
    }

    const result = await apiCall(post, `/api/game/${sessionId}/get-current-player`, {
      gameToken: gameToken
    });

    if (result.success) {
      const currentPlayerId = extractCurrentPlayerId(result.data);
      setCurrentPlayer(currentPlayerId);
    }
    return result;
  }, [sessionId, participantId, apiCall, post, getGameToken, extractCurrentPlayerId]);

  const checkGameActive = useCallback(async () => {
    if (!sessionId) return false;
    
    const gameToken = getGameToken(sessionId, participantId);
    if (!gameToken) {
      console.warn("[useKubicKode] No game token available for checkGameActive");
      return false;
    }

      const result = await apiCall(post, `/api/game/${sessionId}/is-active`, {
      gameToken: gameToken
    });

    if (result.success) {
      setGameState(result.data.is_active ? "active" : "inactive");
      return result.data.is_active;
    }
    return false;
  }, [sessionId, participantId, apiCall, post, getGameToken]);

  // Game-specific actions
  const playTurn = useCallback(async (x, y, additionalData = {}) => {
    if (!sessionId || !participantId) {
      throw new Error("Session and participant required to play turn");
    }

    const gameToken = getGameToken(sessionId, participantId);
    if (!gameToken) {
      throw new Error("No game token available to play turn");
    }

    const result = await apiCall(post, `/api/game/${sessionId}/play-turn`, {
      participantId: participantId,
      gameToken: gameToken,
      xPos: x,
      yPos: y,
      ...additionalData
    });

    return result;
  }, [sessionId, participantId, apiCall, post, getGameToken]);

  // Voting
  const requestRestartVote = useCallback(async () => {
    return await apiCall(get, `/api/session/${sessionId}/request-restart-vote`);
  }, [sessionId, apiCall, get]);

  const submitRestartVote = useCallback(async (voteYes) => {
    if (!participantId) {
      throw new Error("No participant ID. Join session first.");
    }
    return await apiCall(post, `/api/session/${sessionId}/submit-restart-vote`, {
      participantId,
      voteYes
    });
  }, [participantId, sessionId, apiCall, post]);

  // WebSocket management
  const connectWebSocket = useCallback(() => {
    if (!sessionId) {
      console.warn("🔌 Cannot connect WebSocket: No sessionId available");
      return;
    }

    // Construct WebSocket URL
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const hostIP = window.location.hostname;
    const hostPort = window.location.port || "3000";
    const wsUrl = `${protocol}://${hostIP}:${hostPort}/?sessionId=${sessionId}`;
    
    console.log("🔌 Attempting WebSocket connection to:", wsUrl);
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("🔌 WebSocket connected successfully");
      setIsConnected(true);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Handle WebSocket events
        eventListeners.current.forEach(listener => {
          if (listener.type === data.type) {
            listener.handler(data.payload);
          }
        });
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    websocket.onclose = (event) => {
      console.log("🔌 WebSocket disconnected:", event.code, event.reason);
      setIsConnected(false);
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError(`WebSocket error: ${error.message}`);
    };

    // Store websocket reference for cleanup
    eventListeners.current.add({ websocket, off: () => websocket.close() });
  }, [sessionId]);

  const disconnectWebSocket = useCallback(() => {
    eventListeners.current.forEach(listener => {
      if (listener.websocket) {
        listener.websocket.close();
      }
    });
    setIsConnected(false);
  }, []);

  // Auto-refresh data when session changes
  useEffect(() => {
    if (sessionId) {
      fetchParticipants();
      fetchTileMap();
      getCurrentPlayer();
      checkGameActive();
    }
  }, [sessionId, fetchParticipants, fetchTileMap, getCurrentPlayer, checkGameActive]);

  // Determine if current user is host (first participant)
  const isHost = participants.length > 0 && participants[0]?.id === participantId;

  // Get current participant
  const currentParticipant = participants.find(p => p.id === participantId);

  return {
    // State
    sessionId,
    participantId,
    participants,
    gameState,
    tileMap,
    currentPlayer,
    isLoading,
    error,
    isConnected,
    isHost,
    currentParticipant,

    // Session actions
    initSession,
    joinSession,
    leaveSession,
    fetchParticipants,

    // Game actions
    startGame,
    stopGame,
    playTurn,
    fetchTileMap,
    getCurrentPlayer,
    checkGameActive,

    // Voting
    requestRestartVote,
    submitRestartVote,

    // Utility
    getState: () => ({
      sessionId,
      participantId,
      gameState,
      isConnected,
      hasGameToken: !!getGameToken(sessionId, participantId)
    }),
    clearError: () => setError(null)
  };
} 
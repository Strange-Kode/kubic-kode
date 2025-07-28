import { useState, useEffect, useCallback, useRef } from 'react';
import { KubicKode } from '../../../kubic-kode-helper.js';

/**
 * React hook for using KubicKode helper
 * Provides state management and game-specific methods
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

  // Initialize KubicKode
  useEffect(() => {
    if (gameId) {
      KubicKode.game.register(gameId).use(gameId);
    }

    // Set up event listeners
    const listeners = [
      KubicKode.events.on('sessionInitialized', ({ sessionId }) => {
        setSessionId(sessionId);
        setError(null);
      }),
      
      KubicKode.events.on('gameStarted', (data) => {
        setGameState('active');
        setError(null);
      }),
      
      KubicKode.events.on('gameStopped', () => {
        setGameState('stopped');
      }),
      
      KubicKode.events.on('turnPlayed', (data) => {
        // Refresh tile map and current player
        fetchTileMap();
        fetchCurrentPlayer();
      }),
      
      KubicKode.events.on('websocketConnected', () => {
        setIsConnected(true);
      }),
      
      KubicKode.events.on('websocketDisconnected', () => {
        setIsConnected(false);
      }),
      
      KubicKode.events.on('websocketError', (error) => {
        setError(`WebSocket error: ${error.message}`);
      })
    ];

    // Store listeners for cleanup
    listeners.forEach(listener => eventListeners.current.add(listener));

    // Connect WebSocket
    KubicKode.connectWebSocket();

    // Cleanup function
    return () => {
      eventListeners.current.forEach(listener => {
        if (listener && typeof listener.off === 'function') {
          listener.off();
        }
      });
      eventListeners.current.clear();
    };
  }, [gameId]);

  // Helper function to handle API calls
  const apiCall = useCallback(async (apiFunction, ...args) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await apiFunction.apply(KubicKode, args);
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
    return await apiCall(KubicKode.initSession, gameType);
  }, [apiCall, gameId]);

  const joinSession = useCallback(async (participantName, participantType = 'user') => {
    const result = await apiCall(KubicKode.joinSession, participantName, participantType);
    if (result.success) {
      setParticipantId(result.data.participant_id);
    }
    return result;
  }, [apiCall]);

  const fetchParticipants = useCallback(async () => {
    if (!sessionId) return;
    
    const result = await apiCall(KubicKode.route.session, 'participants');
    if (result.success) {
      setParticipants(result.data);
    }
    return result;
  }, [sessionId, apiCall]);

  // Game management
  const startGame = useCallback(async (options = {}) => {
    const result = await apiCall(KubicKode.startGame, options);
    if (result.success) {
      setGameState('active');
    }
    return result;
  }, [apiCall]);

  const stopGame = useCallback(async () => {
    const result = await apiCall(KubicKode.route.game, 'stop');
    if (result.success) {
      setGameState('stopped');
    }
    return result;
  }, [apiCall]);

  const fetchTileMap = useCallback(async () => {
    if (!sessionId) return;
    
    const result = await apiCall(KubicKode.route.game, 'get-tilemap');
    if (result.success) {
      setTileMap(result.data);
    }
    return result;
  }, [sessionId, apiCall]);

  const fetchCurrentPlayer = useCallback(async () => {
    if (!sessionId) return;
    
    const result = await apiCall(KubicKode.route.game, 'get-current-player');
    if (result.success) {
      setCurrentPlayer(result.data.current_player_id);
    }
    return result;
  }, [sessionId, apiCall]);

  const checkGameActive = useCallback(async () => {
    if (!sessionId) return false;
    
    const result = await apiCall(KubicKode.route.game, 'is-active');
    if (result.success) {
      setGameState(result.data.is_active ? 'active' : 'inactive');
      return result.data.is_active;
    }
    return false;
  }, [sessionId, apiCall]);

  // Game-specific actions
  const playTurn = useCallback(async (x, y, additionalData = {}) => {
    const result = await apiCall(KubicKode.playTurn, x, y, additionalData);
    return result;
  }, [apiCall]);

  // Voting
  const requestRestartVote = useCallback(async () => {
    return await apiCall(KubicKode.route.session, 'restart-vote');
  }, [apiCall]);

  const submitRestartVote = useCallback(async (voteYes) => {
    if (!participantId) {
      throw new Error('No participant ID. Join session first.');
    }
    return await apiCall(KubicKode.route.session, 'submit-vote', {
      participantId,
      voteYes
    });
  }, [participantId, apiCall]);

  // Auto-refresh data when session changes
  useEffect(() => {
    if (sessionId) {
      fetchParticipants();
      fetchTileMap();
      fetchCurrentPlayer();
      checkGameActive();
    }
  }, [sessionId, fetchParticipants, fetchTileMap, fetchCurrentPlayer, checkGameActive]);

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
    fetchParticipants,

    // Game actions
    startGame,
    stopGame,
    playTurn,
    fetchTileMap,
    fetchCurrentPlayer,
    checkGameActive,

    // Voting
    requestRestartVote,
    submitRestartVote,

    // Utility
    getState: () => KubicKode.getState(),
    clearError: () => setError(null)
  };
} 
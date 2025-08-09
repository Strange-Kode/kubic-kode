import { useState, useEffect } from "react";
import {
  Box,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Spinner,
} from "@chakra-ui/react";
import { useSessionBrowser } from "../hooks/useSessionBrowser";
import GameModal from "./GameModal";

export function SessionBrowser({ onSessionJoined, onClose, currentSessionId = null }) {
  const [playerName, setPlayerName] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);
  const [joinType, setJoinType] = useState("player"); // "player", "spectator", or "auto"
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const {
    availableSessions,
    isLoading,
    error,
    fetchSessionsByGame,
    joinSpecificSession,
    autoJoinSession,
    clearError,
  } = useSessionBrowser();

  // Load tic-tac-toe sessions on mount - show ALL sessions including in-progress ones
  useEffect(() => {
    fetchSessionsByGame("tic-tac-toe-classic", false);
  }, [fetchSessionsByGame]);

  // Auto-refresh session list periodically to catch new sessions
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading) {
        fetchSessionsByGame("tic-tac-toe-classic", false);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchSessionsByGame, isLoading]);

  // Show error modal when error occurs
  useEffect(() => {
    if (error) {
      setShowErrorModal(true);
    }
  }, [error]);

  const handleRefresh = () => {
    fetchSessionsByGame("tic-tac-toe-classic", false);
  };

  const handleJoinSession = (session, asSpectator = false) => {
    setSelectedSession(session);
    setJoinType(asSpectator ? "spectator" : "player");
    setPlayerName("");
    setShowJoinModal(true);
  };

  const handleAutoJoin = () => {
    setSelectedSession(null);
    setJoinType("auto");
    setPlayerName("");
    setShowJoinModal(true);
  };

  const handleConfirmJoin = async () => {
    if (!playerName.trim()) {
      return; // GameModal will handle validation display
    }

    let result;

    if (joinType === "auto") {
      // Auto-join best available session
      result = await autoJoinSession("tic-tac-toe-classic", playerName.trim());
    } else {
      // Join specific session
      const participantType = joinType === "spectator" ? "spectator" : "user";
      result = await joinSpecificSession(selectedSession.sessionId, playerName.trim(), participantType);
    }

    if (result.success) {
      setShowJoinModal(false);
      onSessionJoined({
        sessionId: result.sessionId,
        participantId: result.participantId,
        playerName: playerName.trim(),
        wasAutoJoin: joinType === "auto",
        sessionCreated: result.sessionCreated || false
      });
    }
    // Error handling is done via error state and modal
  };

  const getStatusBadge = (session) => {
    if (session.started) {
      return <Badge colorScheme="green">In Progress</Badge>;
    }
    if (session.inSyncPhase) {
      return <Badge colorScheme="yellow">Preparing</Badge>;
    }
    if (session.needsMorePlayers) {
      return <Badge colorScheme="blue">Waiting for Players</Badge>;
    }
    return <Badge colorScheme="gray">Full</Badge>;
  };

  const canJoinAsPlayer = (session) => {
    return !session.started && session.needsMorePlayers;
  };

  const getJoinableSessionsCount = () => {
    return availableSessions.filter(session => canJoinAsPlayer(session)).length;
  };

  const isOwnSession = (session) => {
    return currentSessionId && session.sessionId === currentSessionId;
  };

  const getJoinModalTitle = () => {
    if (joinType === "auto") return "Quick Join Game";
    if (joinType === "spectator") return "Join as Spectator";
    return "Join Game Session";
  };

  const getJoinModalMessage = () => {
    if (joinType === "auto") {
      return "We'll find the best available session or create a new one for you. Enter your name to continue.";
    }
    
    if (selectedSession) {
      const action = joinType === "spectator" ? "watch" : "join";
      return `You're about to ${action} session ${selectedSession.sessionId.slice(0, 8)}... hosted by ${selectedSession.host?.name}. Current players: ${selectedSession.participantCount.players}/${selectedSession.participantCount.maxPlayers}`;
    }
    
    return "Enter your name to join this session.";
  };

  return (
    <Box>
      <VStack spacing={4}>
        <HStack justify="space-between" w="100%">
          <Heading size="lg">Browse Game Sessions</Heading>
          <HStack>
            <Button size="sm" onClick={handleRefresh} isLoading={isLoading}>
              Refresh
            </Button>
            <Button size="sm" onClick={onClose}>
              Close
            </Button>
          </HStack>
        </HStack>

        <HStack justify="space-between" w="100%">
          <Text>
            Found <strong>{availableSessions.length}</strong> sessions 
            ({getJoinableSessionsCount()} available to join, {availableSessions.filter(s => s.started).length} in progress)
          </Text>
          <Button 
            colorScheme="green" 
            onClick={handleAutoJoin}
            isDisabled={getJoinableSessionsCount() === 0}
          >
            Quick Join Best Match
          </Button>
        </HStack>

        {isLoading && !availableSessions.length ? (
          <HStack>
            <Spinner />
            <Text>Loading sessions...</Text>
          </HStack>
        ) : availableSessions.length === 0 ? (
          <Box textAlign="center" py={8}>
            <Text color="gray.500" mb={4}>
              No active sessions found for Tic-Tac-Toe Classic.
            </Text>
            <Text fontSize="sm" color="gray.400">
              You can create a new session by closing this browser and starting a new game.
            </Text>
          </Box>
        ) : (
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Session</Th>
                <Th>Host</Th>
                <Th>Players</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {availableSessions.map((session) => (
                <Tr key={session.sessionId}>
                  <Td>
                    <VStack align="start" spacing={1}>
                      <HStack>
                        <Text fontSize="sm" fontWeight="bold">
                          {session.sessionId.slice(0, 8)}...
                        </Text>
                        {isOwnSession(session) && (
                          <Badge colorScheme="purple" size="sm">
                            Your Session
                          </Badge>
                        )}
                      </HStack>
                      <Text fontSize="xs" color="gray.500">
                        {session.gameVariantId}
                      </Text>
                    </VStack>
                  </Td>
                  <Td>
                    <Text fontSize="sm">
                      {session.host?.name || "Unknown"}
                    </Text>
                  </Td>
                  <Td>
                    <VStack align="start" spacing={0}>
                      <Text fontSize="sm">
                        {session.participantCount.players}/{session.participantCount.maxPlayers}
                      </Text>
                      {session.participantCount.spectators > 0 && (
                        <Text fontSize="xs" color="gray.500">
                          +{session.participantCount.spectators} spectator{session.participantCount.spectators !== 1 ? 's' : ''}
                        </Text>
                      )}
                    </VStack>
                  </Td>
                  <Td>
                    {getStatusBadge(session)}
                  </Td>
                  <Td>
                    <HStack spacing={1}>
                      {canJoinAsPlayer(session) && !isOwnSession(session) && (
                        <Button
                          size="xs"
                          colorScheme="blue"
                          onClick={() => handleJoinSession(session, false)}
                        >
                          Join
                        </Button>
                      )}
                      {!isOwnSession(session) && (
                        <Button
                          size="xs"
                          variant="outline"
                          colorScheme="gray"
                          onClick={() => handleJoinSession(session, true)}
                        >
                          Watch
                        </Button>
                      )}
                      {isOwnSession(session) && (
                        <Text fontSize="xs" color="gray.500" fontStyle="italic">
                          Your session
                        </Text>
                      )}
                    </HStack>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </VStack>

      {/* Join Modal using GameModal */}
      <GameModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        title={getJoinModalTitle()}
        message={getJoinModalMessage()}
        type="info"
        showInput={true}
        inputPlaceholder="Enter your name"
        inputValue={playerName}
        onInputChange={setPlayerName}
        primaryButton={{
          text: joinType === "auto" 
            ? "Quick Join" 
            : joinType === "spectator" 
              ? "Join as Spectator" 
              : "Join Game",
          onClick: handleConfirmJoin
        }}
        secondaryButton={{
          text: "Cancel",
          onClick: () => setShowJoinModal(false)
        }}
      />

      {/* Error Modal using GameModal */}
      <GameModal
        isOpen={showErrorModal}
        onClose={() => {
          setShowErrorModal(false);
          clearError();
        }}
        title="Session Browser Error"
        message={error || "An unexpected error occurred."}
        type="error"
        primaryButton={{
          text: "Try Again",
          onClick: () => {
            setShowErrorModal(false);
            clearError();
            handleRefresh();
          }
        }}
        secondaryButton={{
          text: "Close",
          onClick: () => {
            setShowErrorModal(false);
            clearError();
          }
        }}
      />
    </Box>
  );
}
import { useState } from "react";
import {
  Box,
  Container,
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Input,
  Grid,
  GridItem,
  Badge,
  Divider,
} from "@chakra-ui/react";
import LoadingScreen from "./components/LoadingScreen";
import NameSelectionModal from "./components/NameSelectionModal";
import { useSession } from "./hooks/useSession";
import { useGame } from "./hooks/useGame";

function AppContent() {
  const {
    sessionId,
    participantId,
    participants,
    isSessionLoading,
    sessionError,
    isHost,
    joinSession,
    fetchParticipants,
  } = useSession();

  const {
    gameStarted,
    gameActive,
    tileMap,
    currentPlayerId,
    isGameLoading,
    gameError,
    lastMoveResult,
    startGame,
    stopGame,
    makeMove,
    refreshGameData,
    getTile,
    getGridDimensions,
  } = useGame(sessionId);

  const [showNameModal, setShowNameModal] = useState(false);
  const [testName, setTestName] = useState("");

  // Show loading while session initializes
  if (isSessionLoading) {
    return <LoadingScreen message="Initializing session..." />;
  }

  // Show error if session failed to initialize
  if (sessionError) {
    return (
      <Container maxW="md" centerContent>
        <VStack spacing={4} py={8}>
          <Heading color="red.500">Session Error</Heading>
          <Text>{sessionError}</Text>
        </VStack>
      </Container>
    );
  }

  const handleJoinWithName = async (name) => {
    console.log("[App] Attempting to join with name:", name);
    const result = await joinSession(name);

    if (result.success) {
      setShowNameModal(false);
      console.log("[App] Successfully joined session");
    } else {
      console.error("[App] Failed to join session:", result.error);
      alert(`Failed to join: ${result.error}`);
    }
  };

  const handleQuickJoin = async () => {
    if (!testName.trim()) {
      alert("Please enter a name");
      return;
    }
    await handleJoinWithName(testName);
  };

  const handleStartGame = async () => {
    console.log("[App] Starting game...");
    const result = await startGame();
    if (result.success) {
      console.log("[App] Game started successfully!");
    } else {
      console.error("[App] Failed to start game:", result.error);
      alert(`Failed to start game: ${result.error}`);
    }
  };

  const handleStopGame = async () => {
    console.log("[App] Stopping game...");
    const result = await stopGame();
    if (result.success) {
      console.log("[App] Game stopped successfully!");
    } else {
      console.error("[App] Failed to stop game:", result.error);
      alert(`Failed to stop game: ${result.error}`);
    }
  };

  const handleTileClick = async (x, y) => {
    if (!participantId) {
      alert("You must join the session first!");
      return;
    }

    if (currentPlayerId !== participantId) {
      alert("It's not your turn!");
      return;
    }

    console.log(`[App] Making move at (${x}, ${y})`);
    const result = await makeMove(x, y, participantId);

    if (result.success) {
      if (result.data.status === "invalid") {
        alert(`Invalid move: ${result.data.type || "Unknown reason"}`);
      } else if (result.data.player_has_won) {
        alert("🎉 You won!");
      }
    } else {
      console.error("[App] Move failed:", result.error);
      alert(`Move failed: ${result.error}`);
    }
  };

  const renderGameBoard = () => {
    const { width, height } = getGridDimensions();

    if (!tileMap || width === 0 || height === 0) {
      return <Text color="gray.500">No game board available</Text>;
    }

    return (
      <Grid templateColumns={`repeat(${width}, 1fr)`} gap={1} maxW="300px">
        {Array.from({ length: height }, (_, y) =>
          Array.from({ length: width }, (_, x) => {
            const tile = getTile(x, y);
            return (
              <GridItem key={`${x}-${y}`}>
                <Button
                  size="lg"
                  h="60px"
                  w="60px"
                  onClick={() => handleTileClick(x, y)}
                  isDisabled={!gameActive || currentPlayerId !== participantId}
                  colorScheme={tile ? "gray" : "blue"}
                  variant={tile ? "solid" : "outline"}
                >
                  {tile ? tile.type : ""}
                </Button>
              </GridItem>
            );
          })
        )}
      </Grid>
    );
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="6xl" py={8}>
        <VStack spacing={6}>
          <Heading>🎮 useSession + useGame Hook Test</Heading>

          <HStack align="start" spacing={8} w="100%">
            {/* Left Column - Session Management */}
            <VStack spacing={4} flex="1">
              <Heading size="lg" color="blue.600">
                Session Management
              </Heading>

              {/* Session Info */}
              <Box p={4} bg="white" borderRadius="md" shadow="sm" w="100%">
                <VStack align="start" spacing={2}>
                  <Text>
                    <strong>Session ID:</strong>{" "}
                    {sessionId || "Not initialized"}
                  </Text>
                  <Text>
                    <strong>Participant ID:</strong>{" "}
                    {participantId || "Not joined"}
                  </Text>
                  <Text>
                    <strong>Is Host:</strong> {isHost ? "Yes" : "No"}
                  </Text>
                  <Text>
                    <strong>Total Participants:</strong> {participants.length}/2
                  </Text>
                </VStack>
              </Box>

              {/* Participants List */}
              <Box p={4} bg="white" borderRadius="md" shadow="sm" w="100%">
                <Heading size="md" mb={3}>
                  Participants
                </Heading>
                {participants.length === 0 ? (
                  <Text color="gray.500">No participants yet</Text>
                ) : (
                  <VStack align="start" spacing={1}>
                    {participants.map((participant, index) => (
                      <Text key={participant.id}>
                        {index + 1}. {participant.name} (ID: {participant.id})
                        {participant.id === participantId && " ← You"}
                        {index === 0 && " (Host)"}
                      </Text>
                    ))}
                  </VStack>
                )}
              </Box>

              {/* Join Controls */}
              {!participantId && (
                <Box p={4} bg="blue.50" borderRadius="md" w="100%">
                  <VStack spacing={3}>
                    <Heading size="md">Join Session</Heading>
                    <VStack spacing={2} w="100%">
                      <Input
                        placeholder="Enter your name"
                        value={testName}
                        onChange={(e) => setTestName(e.target.value)}
                        maxW="300px"
                      />
                      <Button colorScheme="blue" onClick={handleQuickJoin}>
                        Join Session
                      </Button>
                    </VStack>
                    <Text fontSize="sm" color="gray.600">
                      Or
                    </Text>
                    <Button
                      variant="outline"
                      onClick={() => setShowNameModal(true)}
                    >
                      Open Name Modal (Original)
                    </Button>
                  </VStack>
                </Box>
              )}

              {/* Session Status */}
              <Box p={4} bg="green.50" borderRadius="md" w="100%">
                <Text>
                  <strong>Session Status:</strong>
                </Text>
                {participants.length === 0 && (
                  <Text>🔄 Waiting for participants...</Text>
                )}
                {participants.length === 1 && (
                  <Text>👤 1 player joined, waiting for 2nd player...</Text>
                )}
                {participants.length === 2 && (
                  <Text>🎉 2 players joined! Ready to start game.</Text>
                )}
                {participants.length > 2 && (
                  <Text>⚠️ Too many participants ({participants.length})</Text>
                )}
              </Box>
            </VStack>

            {/* Right Column - Game Management */}
            <VStack spacing={4} flex="1">
              <Heading size="lg" color="purple.600">
                Game Management
              </Heading>

              {/* Game Info */}
              <Box p={4} bg="white" borderRadius="md" shadow="sm" w="100%">
                <VStack align="start" spacing={2}>
                  <HStack>
                    <Text>
                      <strong>Game Started:</strong>
                    </Text>
                    <Badge colorScheme={gameStarted ? "green" : "gray"}>
                      {gameStarted ? "Yes" : "No"}
                    </Badge>
                  </HStack>
                  <HStack>
                    <Text>
                      <strong>Game Active:</strong>
                    </Text>
                    <Badge colorScheme={gameActive ? "green" : "gray"}>
                      {gameActive ? "Active" : "Inactive"}
                    </Badge>
                  </HStack>
                  <Text>
                    <strong>Current Player ID:</strong>{" "}
                    {currentPlayerId || "None"}
                  </Text>
                  <Text>
                    <strong>Your Turn:</strong>{" "}
                    {currentPlayerId === participantId ? "Yes" : "No"}
                  </Text>
                  {gameError && (
                    <Text color="red.500">
                      <strong>Game Error:</strong> {gameError}
                    </Text>
                  )}
                </VStack>
              </Box>

              {/* Game Controls */}
              <Box p={4} bg="purple.50" borderRadius="md" w="100%">
                <VStack spacing={3}>
                  <Heading size="md">Game Controls</Heading>
                  <HStack spacing={2}>
                    <Button
                      colorScheme="green"
                      onClick={handleStartGame}
                      isDisabled={
                        participants.length < 2 || gameStarted || isGameLoading
                      }
                      isLoading={isGameLoading}
                    >
                      Start Game
                    </Button>
                    <Button
                      colorScheme="red"
                      onClick={handleStopGame}
                      isDisabled={!gameStarted}
                    >
                      Stop Game
                    </Button>
                    <Button
                      colorScheme="blue"
                      size="sm"
                      onClick={refreshGameData}
                    >
                      Refresh
                    </Button>
                  </HStack>
                </VStack>
              </Box>

              {/* Game Board */}
              <Box p={4} bg="white" borderRadius="md" shadow="sm" w="100%">
                <VStack spacing={4}>
                  <Heading size="md">Game Board</Heading>
                  {renderGameBoard()}
                  {lastMoveResult && (
                    <Box p={2} bg="gray.100" borderRadius="md" w="100%">
                      <Text fontSize="sm">
                        <strong>Last Move:</strong> {lastMoveResult.status}
                        {lastMoveResult.player_has_won && " - 🎉 Player Won!"}
                        {lastMoveResult.type && ` (${lastMoveResult.type})`}
                      </Text>
                    </Box>
                  )}
                </VStack>
              </Box>
            </VStack>
          </HStack>

          <Divider />

          {/* Bottom Actions */}
          <Box p={4} bg="gray.100" borderRadius="md" w="100%">
            <VStack spacing={2}>
              <Heading size="sm">Debug Actions</Heading>
              <HStack spacing={2}>
                <Button size="sm" onClick={fetchParticipants}>
                  Refresh Participants
                </Button>
                <Button size="sm" onClick={refreshGameData}>
                  Refresh Game Data
                </Button>
              </HStack>
            </VStack>
          </Box>
        </VStack>

        {/* Name Selection Modal */}
        <NameSelectionModal
          isOpen={showNameModal}
          onClose={() => setShowNameModal(false)}
          onSubmit={handleJoinWithName}
        />
      </Container>
    </Box>
  );
}

function App() {
  return <AppContent />;
}

export default App;

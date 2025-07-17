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
import { useTicTacToe } from "./hooks/useTicTacToe";

function AppContent() {
  // Use the orchestration hook instead of individual hooks
  const {
    gamePhase,
    isLoading,
    error,
    showNameModal,
    playerName,
    participants,
    currentPlayer,
    opponent,
    isMyTurn,
    gameStarted,
    gameActive,
    tileMap,
    lastMoveResult,
    sessionId,
    participantId,
    isHost,
    handleNameSubmit,
    handleMove,
    refreshData,
    getTile,
    getGridDimensions,
    // Pass-through for advanced use
    joinSession,
    startGame,
    checkSessionAvailability,
  } = useTicTacToe();

  const [testName, setTestName] = useState("");
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [suppressAutoModal, setSuppressAutoModal] = useState(false);

  // Show loading while session initializes
  if (gamePhase === "loading" || isLoading) {
    return <LoadingScreen message="Initializing session..." />;
  }

  // Show error if session failed to initialize
  if (gamePhase === "error" || error) {
    return (
      <Container maxW="md" centerContent>
        <VStack spacing={4} py={8}>
          <Heading color="red.500">Session Error</Heading>
          <Text>{error}</Text>
        </VStack>
      </Container>
    );
  }

  const handleJoinWithName = async (name) => {
    console.log("[App] Attempting to join with name:", name);
    // Use the orchestration hook's handler
    await handleNameSubmit(name);
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

  // Note: stopGame not available in useTicTacToe (games auto-manage lifecycle)

  const handleTileClick = async (x, y) => {
    if (!participantId) {
      alert("You must join the session first!");
      return;
    }

    if (!isMyTurn) {
      alert("It's not your turn!");
      return;
    }

    console.log(`[App] Making move at (${x}, ${y})`);
    const success = await handleMove(x, y);

    if (!success) {
      // Error already handled by useTicTacToe hook
      console.log("[App] Move was not successful");
    }
  };

  const renderGameBoard = () => {
    const { width, height } = getGridDimensions();

    if (!tileMap || width === 0 || height === 0) {
      return <Text color="gray.500">No game board available</Text>;
    }

    console.log("[App-test] Rendering board - tileMap:", tileMap);

    return (
      <Grid templateColumns={`repeat(${width}, 1fr)`} gap={1} maxW="300px">
        {Array.from({ length: height }, (_, y) =>
          Array.from({ length: width }, (_, x) => {
            const tile = getTile(x, y);
            console.log(`[App-test] Tile at (${x},${y}):`, tile);
            const cellValue = tile?.type || ""; // Use tile.type instead of tile.mark

            return (
              <GridItem key={`${x}-${y}`}>
                <Button
                  size="lg"
                  h="60px"
                  w="60px"
                  onClick={() => handleTileClick(x, y)}
                  isDisabled={!gameActive || !isMyTurn || cellValue !== ""}
                  colorScheme={
                    cellValue === "X"
                      ? "purple"
                      : cellValue === "O"
                      ? "blue"
                      : "gray"
                  }
                  variant={cellValue ? "solid" : "outline"}
                  bg={
                    cellValue === "X"
                      ? "purple.400"
                      : cellValue === "O"
                      ? "blue.400"
                      : "white"
                  }
                  color={cellValue ? "white" : "gray.500"}
                >
                  {cellValue}
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
          <Heading>🎮 useTicTacToe Hook Test</Heading>

          {/* Game Phase Info */}
          <Box p={4} bg="yellow.50" borderRadius="md" shadow="sm" w="100%">
            <Text>
              <strong>Game Phase:</strong> {gamePhase}
            </Text>
            <Text>
              <strong>Your Name:</strong> {playerName || "Not set"}
            </Text>
            <Text>
              <strong>Show Name Modal:</strong> {showNameModal ? "Yes" : "No"}
            </Text>
            <Text>
              <strong>Participant ID:</strong> {participantId || "Not joined"}
            </Text>
            <Text color="blue.600">
              <strong>Why Modal Shows:</strong>{" "}
              {gamePhase === "name-selection"
                ? "Need to collect name"
                : showNameModal
                ? "Hook triggered modal"
                : "Modal should be hidden"}
            </Text>
            <Text color="purple.600">
              <strong>Auto Modal Suppressed:</strong>{" "}
              {suppressAutoModal ? "Yes" : "No"}
            </Text>
          </Box>

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
                      onClick={() => setManualModalOpen(true)}
                    >
                      Open Name Modal (Manual)
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
                    <strong>Current Player:</strong>{" "}
                    {currentPlayer?.name || "None"}
                  </Text>
                  <Text>
                    <strong>Your Turn:</strong> {isMyTurn ? "Yes" : "No"}
                  </Text>
                  <Text>
                    <strong>Opponent:</strong> {opponent?.name || "None"}
                  </Text>
                  {error && (
                    <Text color="red.500">
                      <strong>Game Error:</strong> {error}
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
                        participants.length < 2 || gameStarted || isLoading
                      }
                      isLoading={isLoading}
                    >
                      Start Game
                    </Button>
                    <Button
                      colorScheme="red"
                      onClick={() =>
                        alert(
                          "Stop game not available - games auto-manage lifecycle"
                        )
                      }
                      isDisabled={!gameStarted}
                    >
                      Stop Game (N/A)
                    </Button>
                    <Button colorScheme="blue" size="sm" onClick={refreshData}>
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
                        <strong>Last Move Result:</strong> Available in
                        useTicTacToe hook
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
                <Button size="sm" onClick={refreshData}>
                  Refresh All Data
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    console.log("useTicTacToe state:", {
                      gamePhase,
                      participants,
                      currentPlayer,
                      isMyTurn,
                    })
                  }
                >
                  Log Hook State
                </Button>
                <Button
                  size="sm"
                  colorScheme={suppressAutoModal ? "red" : "green"}
                  onClick={() => setSuppressAutoModal(!suppressAutoModal)}
                >
                  {suppressAutoModal ? "Enable" : "Suppress"} Auto Modal
                </Button>
              </HStack>
            </VStack>
          </Box>
        </VStack>

        {/* Name Selection Modal - Manual Control */}
        <NameSelectionModal
          isOpen={manualModalOpen}
          onClose={() => setManualModalOpen(false)}
          onSubmit={(name) => {
            handleNameSubmit(name);
            setManualModalOpen(false);
          }}
        />

        {/* Auto Name Selection Modal - DISABLED for test app 
            We want to use the direct input form instead of modal */}
        {false && (
          <NameSelectionModal
            isOpen={showNameModal && !suppressAutoModal}
            onClose={() => {}} // Handled by useTicTacToe hook automatically
            onSubmit={handleNameSubmit}
          />
        )}
      </Container>
    </Box>
  );
}

function App() {
  return <AppContent />;
}

export default App;

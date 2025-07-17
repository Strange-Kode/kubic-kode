import {
  Box,
  Container,
  VStack,
  Heading,
  Text,
  Button,
} from "@chakra-ui/react";
import LoadingScreen from "./components/LoadingScreen";
import NameSelectionModal from "./components/NameSelectionModal";
import GameCanvas from "./components/GameCanvas";
import { useTicTacToe } from "./hooks/useTicTacToe";

function AppContent() {
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
    sessionId,
    participantId,
    isHost,
    handleNameSubmit,
    refreshData,
  } = useTicTacToe();

  // Show loading screen for various loading states
  if (gamePhase === "loading") {
    return <LoadingScreen message="Setting up your game..." />;
  }

  // Show error state
  if (gamePhase === "error") {
    return (
      <Container maxW="md" centerContent>
        <VStack spacing={4} py={8}>
          <Heading color="red.500">Game Error</Heading>
          <Text>{error}</Text>
          <Button onClick={refreshData} colorScheme="blue">
            Try Again
          </Button>
        </VStack>
      </Container>
    );
  }

  // Render different UI based on game phase
  const renderGamePhase = () => {
    switch (gamePhase) {
      case "name-selection":
        return (
          <Container maxW="md" centerContent>
            <VStack spacing={4} py={8}>
              <Heading>🎮 Tic-Tac-Toe</Heading>
              <Text>Welcome! Please enter your name to join the game.</Text>
            </VStack>
          </Container>
        );

      case "waiting-for-players":
        return (
          <Container maxW="4xl" py={8}>
            <VStack spacing={6}>
              <Heading>🎮 Tic-Tac-Toe Game</Heading>

              {/* Game Info */}
              <Box p={4} bg="white" borderRadius="md" shadow="sm" w="100%">
                <VStack align="start" spacing={2}>
                  <Text>
                    <strong>Session ID:</strong> {sessionId}
                  </Text>
                  <Text>
                    <strong>Your Name:</strong> {playerName}
                  </Text>
                  <Text>
                    <strong>Players:</strong> {participants.length}/2
                  </Text>
                  {isHost && (
                    <Text color="blue.500">
                      <strong>You are the host</strong>
                    </Text>
                  )}
                </VStack>
              </Box>

              {/* Participants List */}
              <Box p={4} bg="white" borderRadius="md" shadow="sm" w="100%">
                <Heading size="md" mb={3}>
                  Players in Game
                </Heading>
                {participants.length === 0 ? (
                  <Text color="gray.500">No players yet</Text>
                ) : (
                  <VStack align="start" spacing={1}>
                    {participants.map((participant, index) => (
                      <Text key={participant.id}>
                        {index + 1}. {participant.name}
                        {participant.id === participantId && " (You)"}
                        {index === 0 && " 🏠"}
                      </Text>
                    ))}
                  </VStack>
                )}
              </Box>

              {/* Waiting Status */}
              <Box p={4} bg="blue.50" borderRadius="md" w="100%">
                <VStack spacing={2}>
                  <Heading size="md">⏳ Waiting for Players</Heading>
                  <Text>
                    Share this session with a friend to start playing!
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    Game will start automatically when 2 players join
                  </Text>
                </VStack>
              </Box>

              {/* Debug Actions */}
              <Box p={4} bg="gray.50" borderRadius="md" w="100%">
                <VStack spacing={2}>
                  <Heading size="sm">Actions</Heading>
                  <Button size="sm" onClick={refreshData}>
                    Refresh Game Data
                  </Button>
                </VStack>
              </Box>
            </VStack>
          </Container>
        );

      case "starting-game":
        return (
          <Container maxW="md" centerContent>
            <VStack spacing={4} py={8}>
              <Heading>🚀 Starting Game</Heading>
              <Text>All players joined! Starting the game...</Text>
              <LoadingScreen message="Initializing game board..." />
            </VStack>
          </Container>
        );

      case "playing":
        return (
          <Container maxW="4xl" py={8}>
            <VStack spacing={6}>
              <Heading>🎮 Tic-Tac-Toe Game</Heading>

              {/* Game Status */}
              <Box p={4} bg="white" borderRadius="md" shadow="sm" w="100%">
                <VStack spacing={2}>
                  <Text>
                    <strong>Game Status:</strong>{" "}
                    {gameActive ? "🟢 Active" : "⏸️ Paused"}
                  </Text>
                  <Text>
                    <strong>Current Turn:</strong>{" "}
                    {currentPlayer?.name || "Loading..."}
                  </Text>
                  <Text color={isMyTurn ? "green.500" : "gray.500"}>
                    <strong>
                      {isMyTurn
                        ? "🎯 Your Turn!"
                        : "⏳ Waiting for opponent..."}
                    </strong>
                  </Text>
                </VStack>
              </Box>

              {/* Players Info */}
              <Box p={4} bg="blue.50" borderRadius="md" w="100%">
                <VStack align="start" spacing={1}>
                  <Text>
                    <strong>You:</strong> {playerName}
                  </Text>
                  <Text>
                    <strong>Opponent:</strong> {opponent?.name || "Loading..."}
                  </Text>
                </VStack>
              </Box>

              {/* Game Board */}
              <Box>
                <GameCanvas />
              </Box>

              {/* Game Actions */}
              <Box p={4} bg="gray.50" borderRadius="md" w="100%">
                <VStack spacing={2}>
                  <Heading size="sm">Game Actions</Heading>
                  <Button size="sm" onClick={refreshData}>
                    Refresh Game State
                  </Button>
                </VStack>
              </Box>
            </VStack>
          </Container>
        );

      case "game-ended":
        return (
          <Container maxW="md" centerContent>
            <VStack spacing={4} py={8}>
              <Heading>🏁 Game Over</Heading>
              <Text>The game has ended.</Text>
              <Button onClick={refreshData} colorScheme="green">
                Check Final Results
              </Button>
            </VStack>
          </Container>
        );

      default:
        return (
          <Container maxW="md" centerContent>
            <VStack spacing={4} py={8}>
              <Heading color="orange.500">Unknown Game State</Heading>
              <Text>Game phase: {gamePhase}</Text>
              <Button onClick={refreshData} colorScheme="blue">
                Refresh
              </Button>
            </VStack>
          </Container>
        );
    }
  };

  return (
    <Box minH="100vh" bg="gray.50">
      {renderGamePhase()}

      {/* Name Selection Modal */}
      <NameSelectionModal
        isOpen={showNameModal}
        onClose={() => {}} // Handled by useTicTacToe hook
        onSubmit={handleNameSubmit}
      />
    </Box>
  );
}

function App() {
  return <AppContent />;
}

export default App;

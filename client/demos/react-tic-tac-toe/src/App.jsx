import { useState } from "react";

import { Box, Container, VStack, Heading, Text } from "@chakra-ui/react";
import GameCanvas from "./components/GameCanvas";
import SimulationArea from "./components/SimulationArea";
import LoadingScreen from "./components/LoadingScreen";
import JoinOverlay from "./components/JoinOverlay";
import {
  SimulationEngineProvider,
  useSimulationEngine,
} from "./SimulationEngine";

function AppContent() {
  const { isLoading, gameState, simulateJoin } = useSimulationEngine();
  const [joinOverlayVisible, setJoinOverlayVisible] = useState(false);

  if (isLoading) {
    return <LoadingScreen message="Connecting to game..." />;
  }

  const playerNames = {
    X: "Player X",
    O: "Player O",
  };

  // Show join overlay if host exists and player is not the host (X), or if toggled manually
  const shouldShowJoinOverlay =
    (gameState.hostExists && gameState.player !== "X") || joinOverlayVisible;

  // Function to allow SimulationArea to show the overlay
  const showJoinOverlay = () => setJoinOverlayVisible(true);
  const hideJoinOverlay = () => setJoinOverlayVisible(false);

  return (
    <Box
      minH="100vh"
      py={8}
      bgGradient="linear(to-br, teal.50, blue.50, purple.100)"
      backgroundAttachment="fixed"
    >
      <Container maxW="container.md" centerContent>
        <VStack spacing={8}>
          {/* Main Game Container */}
          <Box
            bg="whiteAlpha.900"
            p={8}
            borderRadius="3xl"
            boxShadow="0 8px 32px rgba(80, 80, 180, 0.10)"
            w="full"
            maxW="md"
            borderWidth={1}
            borderColor="blue.100"
          >
            <VStack spacing={6}>
              <Heading as="h1" size="xl" textAlign="center" color="blue.700">
                Tic-Tac-Toe
              </Heading>

              {/* Status Display */}
              <Text
                fontSize="lg"
                textAlign="center"
                fontWeight="medium"
                color="gray.800"
              >
                {gameState.status}
              </Text>

              {/* Game Canvas */}
              <GameCanvas />

              {/* Player Identity */}
              <Text
                fontSize="md"
                textAlign="center"
                fontWeight="medium"
                color="gray.800"
              >
                You are: {playerNames[gameState.player]}
              </Text>
            </VStack>
          </Box>

          {/* Simulation Area */}
          <SimulationArea showJoinOverlay={showJoinOverlay} />
        </VStack>
        {shouldShowJoinOverlay && (
          <JoinOverlay
            onJoin={() => {
              simulateJoin();
              hideJoinOverlay();
            }}
          />
        )}
      </Container>
    </Box>
  );
}

function App() {
  return (
    <SimulationEngineProvider>
      <AppContent />
    </SimulationEngineProvider>
  );
}

export default App;

import { useState, useEffect } from "react";

import { Box, Container, VStack, Heading, Text } from "@chakra-ui/react";
import GameCanvas from "./components/GameCanvas";
import SimulationArea from "./components/SimulationArea";
import LoadingScreen from "./components/LoadingScreen";
import JoinOverlay from "./components/JoinOverlay";
import NameSelectionModal from "./components/NameSelectionModal";
import ShareableSessionLink from "./components/ShareableSessionLink";
import CountdownOverlay from "./components/CountdownOverlay";
import GameModal from "./components/GameModal";
import {
  SimulationEngineProvider,
  useSimulationEngine,
} from "./SimulationEngine";

function AppContent() {
  const {
    isLoading,
    gameState,
    simulateJoin,
    sessionId,
    joinSession,
    showNameModal,
    setShowNameModal,
    participants,
    participantId,
    sessionFullModal,
    closeSessionFullModal,
  } = useSimulationEngine();
  const [joinOverlayVisible, setJoinOverlayVisible] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [gameModal, setGameModal] = useState({
    isOpen: false,
    type: "info",
    title: "",
    message: "",
  });

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

  // Determine host/guest status
  const isHost =
    participants.length > 0 && participants[0]?.id === participantId;
  const hostGuestStatus =
    participants.length === 0 ? "" : isHost ? "Host" : "Guest";

  // Show countdown when both players have joined AND current user is a valid participant
  useEffect(() => {
    if (participants.length === 2 && !showCountdown && participantId) {
      // Only show countdown if the current user is one of the valid participants
      const isValidParticipant = participants.some(
        (p) => p.id === participantId
      );
      if (isValidParticipant) {
        setShowCountdown(true);
      }
    }
  }, [participants.length, showCountdown, participantId]);

  const handleCountdownComplete = () => {
    setShowCountdown(false);
  };

  // Helper functions for showing different game modals
  const showGameOverModal = (winner) => {
    if (winner === "draw") {
      setGameModal({
        isOpen: true,
        type: "warning",
        title: "It's a Draw!",
        message: "Great game! No one wins this time.",
      });
    } else {
      const isWinner = winner === gameState.player;
      setGameModal({
        isOpen: true,
        type: isWinner ? "success" : "error",
        title: isWinner ? "You Win!" : "You Lose!",
        message: isWinner ? "Congratulations! 🎉" : "Better luck next time!",
      });
    }
  };

  const closeGameModal = () => {
    setGameModal({ ...gameModal, isOpen: false });
  };

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

              {/* Host/Guest Status */}
              {hostGuestStatus && (
                <Text
                  fontSize="sm"
                  textAlign="center"
                  fontWeight="medium"
                  color="gray.600"
                >
                  {hostGuestStatus}
                </Text>
              )}
            </VStack>
          </Box>

          {/* Shareable Session Link */}
          <ShareableSessionLink sessionId={sessionId} />

          {/* Simulation Area */}
          <SimulationArea
            showJoinOverlay={showJoinOverlay}
            showGameOverModal={showGameOverModal}
          />
        </VStack>
        {shouldShowJoinOverlay && (
          <JoinOverlay
            onJoin={() => {
              simulateJoin();
              hideJoinOverlay();
            }}
          />
        )}
        <NameSelectionModal
          isOpen={showNameModal}
          onClose={() => setShowNameModal(false)}
          onJoin={joinSession}
          sessionId={sessionId}
        />
        <CountdownOverlay
          isOpen={showCountdown}
          onComplete={handleCountdownComplete}
        />
        <GameModal
          isOpen={gameModal.isOpen}
          onClose={closeGameModal}
          type={gameModal.type}
          title={gameModal.title}
          message={gameModal.message}
          primaryButton={{
            text: "Play Again",
            onClick: () => {
              closeGameModal();
              // TODO: Implement play again logic
            },
          }}
          secondaryButton={{
            text: "Back to Menu",
            onClick: () => {
              closeGameModal();
              // TODO: Implement back to menu logic
            },
          }}
        />
        <GameModal
          isOpen={sessionFullModal.isOpen}
          onClose={closeSessionFullModal}
          type="warning"
          title="Session Unavailable"
          message={sessionFullModal.message}
        />
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

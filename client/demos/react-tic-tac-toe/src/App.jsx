import { useState } from "react";
import {
  Box,
  Container as ChakraContainer,
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
import Container from "./components/Container";
import GameModal from "./components/GameModal";
import { useTicTacToe } from "./hooks/useTicTacToe";

function AppContent() {
  // Use the orchestration hook instead of individual hooks
  const {
    gamePhase,
    isLoading,
    error,
    showNameModal,
    showWinModal,
    winner,
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
    handleWinModalClose,
    getTile,
    getGridDimensions,
    // Restart functionality
    showRestartVoteModal,
    restartVoteInitiator,
    restartVotes,
    requestRestart,
    submitRestartVote,
    handleRestartVoteModalClose,
    // Pass-through for advanced use
    joinSession,
    startGame,
    checkSessionAvailability,
  } = useTicTacToe();

  const [testName, setTestName] = useState("");
  // Removed manualModalOpen and suppressAutoModal state

  // Show loading while session initializes
  if (gamePhase === "loading" || isLoading) {
    return <LoadingScreen message="Initializing session..." />;
  }

  // Show error if session failed to initialize
  if (gamePhase === "error" || error) {
    return (
      <ChakraContainer maxW="md" centerContent>
        <VStack spacing={4} py={8}>
          <Heading color="red.500">Session Error</Heading>
          <Text>{error}</Text>
        </VStack>
      </ChakraContainer>
    );
  }

  const handleJoinWithName = async (name) => {
    // console.log("[App] Attempting to join with name:", name);
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
    // console.log("[App] Starting game...");
    const result = await startGame();
    if (result.success) {
      // console.log("[App] Game started successfully!");
    } else {
      console.error("[App] Failed to start game:", result.error);
      alert(`Failed to start game: ${result.error}`);
    }
  };

  const handleTileClick = async (x, y) => {
    if (!participantId) {
      alert("You must join the session first!");
      return;
    }

    if (!isMyTurn) {
      alert("It's not your turn!");
      return;
    }

    // console.log(`[App] Making move at (${x}, ${y})`);
    const success = await handleMove(x, y);

    if (!success) {
      // Error already handled by useTicTacToe hook
      // console.log("[App] Move was not successful");
    }
  };

  const renderGameBoard = () => {
    const { width, height } = getGridDimensions();

    if (!tileMap || width === 0 || height === 0) {
      return <Text color="gray.500">No game board available</Text>;
    }

    // console.log("[App-test] Rendering board - tileMap:", tileMap);

    return (
      <Grid templateColumns={`repeat(${width}, 1fr)`} gap={1} maxW="300px">
        {Array.from({ length: height }, (_, y) =>
          Array.from({ length: width }, (_, x) => {
            const tile = getTile(x, y);
            // console.log(`[App-test] Tile at (${x},${y}):`, tile);
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

  // Combined Win/Restart Modal helper functions
  const getWinModalTitle = () => {
    // If restart voting is active, show restart title
    if (showRestartVoteModal) {
      return "🔄 Restart Game Vote";
    }

    // Otherwise show win/loss title
    return winner?.id === participantId
      ? "🎉 You Won!"
      : `🏆 ${winner?.name || "Player"} Won!`;
  };

  const getWinModalMessage = () => {
    // If restart voting is active, show voting message with game result context
    if (showRestartVoteModal) {
      const voteCount = Object.keys(restartVotes).length;
      const totalPlayers = participants.length;
      const yesVotes = Object.values(restartVotes).filter(
        (vote) => vote === true
      ).length;

      // Add context about who won the last game
      const lastGameResult = winner
        ? winner.id === participantId
          ? "You won the last game! 🎉"
          : `${winner.name} won the last game.`
        : "Previous game finished.";

      if (restartVoteInitiator === participantId) {
        if (voteCount === 0) {
          return `${lastGameResult}\n\nYou requested a restart. Waiting for other player to vote...`;
        } else if (voteCount < totalPlayers) {
          return `${lastGameResult}\n\nVote in progress... (${yesVotes}/${totalPlayers} voted Yes)`;
        } else {
          const allAgreed = Object.values(restartVotes).every(
            (vote) => vote === true
          );
          return allAgreed
            ? `${lastGameResult}\n\n🎉 All players agreed! Restarting game...`
            : `${lastGameResult}\n\n❌ Not everyone agreed to restart.`;
        }
      } else {
        if (voteCount === 0) {
          return `${lastGameResult}\n\n${
            restartVoteInitiator === winner?.id ? "The winner" : "Your opponent"
          } wants to play again. Do you agree?`;
        } else if (voteCount < totalPlayers) {
          return `${lastGameResult}\n\nVote in progress... (${yesVotes}/${totalPlayers} voted Yes)\n\nDo you want to restart?`;
        } else {
          const allAgreed = Object.values(restartVotes).every(
            (vote) => vote === true
          );
          return allAgreed
            ? `${lastGameResult}\n\n🎉 All players agreed! Restarting game...`
            : `${lastGameResult}\n\n❌ Not everyone agreed to restart.`;
        }
      }
    }

    // Otherwise show win/loss message
    return winner?.id === participantId
      ? "Congratulations! You have won the game!"
      : `${
          winner?.name || "Your opponent"
        } has won this round. Better luck next time!`;
  };

  const getWinModalType = () => {
    if (showRestartVoteModal) {
      return "warning";
    }
    return winner?.id === participantId ? "success" : "info";
  };

  const getWinModalPrimaryButton = () => {
    // If restart voting is active, use restart voting logic
    if (showRestartVoteModal) {
      const voteCount = Object.keys(restartVotes).length;
      const totalPlayers = participants.length;
      const hasVoted = restartVotes[participantId] !== undefined;
      const allVoted = voteCount === totalPlayers;

      // If all voted or if this player already voted, no primary button needed
      if (allVoted || hasVoted) {
        return undefined;
      }

      // If this player initiated the vote, they already auto-voted Yes
      if (restartVoteInitiator === participantId) {
        return undefined;
      }

      // Otherwise, show vote button
      return {
        text: "✅ Yes, Play Again!",
        onClick: () => submitRestartVote(true),
      };
    }

    // Otherwise show "Request New Game" button
    return {
      text: "🔄 Request New Game",
      onClick: () => {
        // Don't close the modal, just initiate restart voting
        requestRestart();
      },
    };
  };

  const getWinModalSecondaryButton = () => {
    // If restart voting is active, use restart voting logic
    if (showRestartVoteModal) {
      const voteCount = Object.keys(restartVotes).length;
      const totalPlayers = participants.length;
      const hasVoted = restartVotes[participantId] !== undefined;
      const allVoted = voteCount === totalPlayers;

      if (allVoted) {
        return {
          text: "Close",
          onClick: () => {
            handleWinModalClose();
            handleRestartVoteModalClose();
          },
        };
      }

      if (hasVoted) {
        return {
          text: "Waiting for others...",
          onClick: () => {}, // Disabled state
        };
      }

      if (restartVoteInitiator === participantId) {
        return {
          text: "Cancel Vote",
          onClick: () => {
            handleWinModalClose();
            handleRestartVoteModalClose();
          },
        };
      }

      return {
        text: "❌ No Thanks",
        onClick: () => submitRestartVote(false),
      };
    }

    // Otherwise show "Close" button
    return {
      text: "Close",
      onClick: handleWinModalClose,
    };
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <ChakraContainer maxW="6xl" py={8}>
        <VStack spacing={6}>
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
          >
            <Heading>Tic Tac Toe Classic - Hackathon Demo</Heading>
            <Text color="gray.600">
              It aint beautiful and it aint supposed to be beautiful
            </Text>
          </Box>

          {/* Game Phase Info */}
          <Container bg="yellow.50" w="100%">
            <Text>
              <strong>Game Phase:</strong> {gamePhase}
            </Text>
            <Text>
              <strong>Your Name:</strong> {playerName || "Not set"}
            </Text>
            <Text>
              <strong>Your Participant ID:</strong>{" "}
              {participantId || "Not joined"}
            </Text>
          </Container>

          <HStack align="start" spacing={8} w="100%">
            {/* Left Column - Session Management */}
            <VStack spacing={4} flex="1">
              <Heading size="lg" color="blue.600">
                Session Management
              </Heading>

              {/* Session Info */}
              <Container w="100%">
                <VStack align="start" spacing={2}>
                  <Text>
                    <strong>Session ID:</strong>{" "}
                    {sessionId || "Not initialized"}
                  </Text>
                  <Text>
                    <strong>Are you the host?:</strong> {isHost ? "Yes" : "No"}
                  </Text>
                  <Text>
                    <strong>Total Participants:</strong> {participants.length}/2
                  </Text>
                </VStack>
              </Container>

              {/* Participants List */}
              <Container w="100%">
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
              </Container>

              {/* Join Controls */}
              {!participantId && (
                <Container bg="blue.50" w="100%">
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
                  </VStack>
                </Container>
              )}

              {/* Session Status */}
              <Container bg="green.50" w="100%">
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
                  <Text>
                    🎉 2 players joined! Game has now started automatically.
                  </Text>
                )}
                {participants.length > 2 && (
                  <Text>⚠️ Too many participants ({participants.length})</Text>
                )}
              </Container>
            </VStack>

            {/* Right Column - Game Management */}
            <VStack spacing={4} flex="1">
              <Heading size="lg" color="purple.600">
                Game Management
              </Heading>

              {/* Game Info */}
              <Container w="100%">
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
              </Container>

              {/* Game Controls */}
              <Container bg="purple.50" w="100%">
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
                    <Button colorScheme="blue" size="sm" onClick={refreshData}>
                      Refresh
                    </Button>
                  </HStack>
                </VStack>
              </Container>

              {/* Game Board */}
              <Container w="100%">
                <VStack spacing={4}>
                  <Heading size="md">Game Board</Heading>
                  {renderGameBoard()}
                </VStack>
              </Container>
            </VStack>
          </HStack>

          <Divider />

          {/* Bottom Actions */}
          <Container bg="gray.100" w="100%">
            <VStack spacing={2}>
              <Heading size="sm">Game Actions</Heading>
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
              </HStack>
            </VStack>
          </Container>
        </VStack>
      </ChakraContainer>

      {/* Combined Win/Restart Modal */}
      <GameModal
        isOpen={showWinModal}
        onClose={handleWinModalClose}
        title={getWinModalTitle()}
        message={getWinModalMessage()}
        type={getWinModalType()}
        primaryButton={getWinModalPrimaryButton()}
        secondaryButton={getWinModalSecondaryButton()}
      />
    </Box>
  );
}

function App() {
  return <AppContent />;
}

export default App;

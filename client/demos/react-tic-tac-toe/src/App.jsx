import { useState, useEffect } from "react";
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
  Table,
  Thead,
  Tbody,
  Tfoot,
  Tr,
  Th,
  Td,
} from "@chakra-ui/react";
import LoadingScreen from "./components/LoadingScreen";
import Container from "./components/Container";
import GameModal from "./components/GameModal";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { SessionBrowserModal } from "./components/SessionBrowserModal";
import { LiveTimer } from "./components/LiveTimer";
import ShareableSessionLink from "./components/ShareableSessionLink";
import { useTicTacToe } from "./hooks/useTicTacToe";

function AppContent() {
  // Use the orchestration hook instead of individual hooks
  const {
    sessionPhase,
    gamePhase,
    isLoading,
    error,
    showNameModal,
    showSpectatorModal,
    showWinModal,
    winner,
    showSessionEndedModal,
    sessionEndedReason,
    playerName,
    participants,
    maxPlayers,
    currentPlayer,
    opponent,
    isMyTurn,
    gameStarted,
    gameActive,
    gameDisabledByInactivity,
    tileMap,
    lastMoveResult,
    sessionId,
    participantId,
    isHost,
    handleNameSubmit,
    handleJoinAsSpectator,
    handleMove,
    refreshData,
    handleWinModalClose,
    handleSessionEndedModalClose,
    getTile,
    getGridDimensions,
    // Player wins data
    playerWinCounts,
    getWinCountForPlayer,
    getTotalGames,
    inactivityTimer,
    getLiveTimer,
    // Restart functionality
    showRestartVoteModal,
    restartVoteInitiator,
    restartVotes,
    requestRestart,
    submitRestartVote,
    handleRestartVoteModalClose,
    // Pass-through for advanced use
    initializeSession,
    joinSession,
    addAIParticipant,
    startGame,
    checkSessionAvailability,
    syncSessionState,
    leaveSession,
  } = useTicTacToe();

  const [testName, setTestName] = useState("");
  const [spectatorName, setSpectatorName] = useState("");
  const [showSessionBrowser, setShowSessionBrowser] = useState(false);
  const [showJoinFromLinkModal, setShowJoinFromLinkModal] = useState(false);
  const [linkSessionId, setLinkSessionId] = useState(null);
  const [linkPlayerName, setLinkPlayerName] = useState("");
  const [linkSessionIsFull, setLinkSessionIsFull] = useState(false);

  // Check for session parameter in URL on mount (only once)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionParam = urlParams.get("session");

    if (sessionParam) {
      // Found a session ID in the URL, check availability and prompt user to join
      setLinkSessionId(sessionParam);

      // Check if session is full
      window.KubicKode.sessionId = sessionParam;
      checkSessionAvailability(sessionParam).then((result) => {
        if (result.success) {
          setLinkSessionIsFull(!result.data.isAvailable);
        }
        setShowJoinFromLinkModal(true);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run on mount

  // Define handlers before using them
  const handleJoinWithName = async (name) => {
    // Use the orchestration hook's handler
    await handleNameSubmit(name);
  };

  const handleSessionBrowserJoin = async (joinResult) => {
    if (joinResult.sessionId && joinResult.participantId) {
      // Sync the main app state with the session browser join result
      await syncSessionState(joinResult.sessionId, joinResult.participantId);
    } else {
      await refreshData();
    }
  };

  const handleJoinFromLink = async () => {
    if (!linkPlayerName.trim()) {
      alert("Please enter your name");
      return;
    }

    try {
      // Set the sessionId in KubicKode (same as SessionBrowser does)
      window.KubicKode.sessionId = linkSessionId;

      // Check if session is available first
      const availabilityResult = await checkSessionAvailability(linkSessionId);

      let result;
      if (availabilityResult.success && availabilityResult.data.isAvailable) {
        // Session has space - join as player
        result = await window.KubicKode.joinSession(linkPlayerName.trim(), "user");
      } else {
        // Session is full - join as spectator
        result = await window.KubicKode.spectateSession(linkPlayerName.trim());
      }

      if (result.success) {
        // Sync the main app state (same as SessionBrowser does)
        await syncSessionState(linkSessionId, result.data.participant_id);

        setShowJoinFromLinkModal(false);
        setLinkSessionId(null);
        setLinkPlayerName("");

        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        alert(`Failed to join session: ${result.error}`);
      }
    } catch (error) {
      console.error("Error joining from link:", error);
      alert(`Error joining session: ${error.message}`);
    }
  };

  // Show welcome screen when no session exists
  if (!sessionId) {
    return (
      <WelcomeScreen
        onCreateGame={async (playerName) => {
          // Initialize session with forceNew=true to always create a fresh session
          const initResult = await initializeSession(
            "tic-tac-toe-classic",
            true
          );
          if (initResult.success) {
            // Use joinSession directly with the session ID from initialization
            const joinResult = await joinSession(playerName, "user");
            if (!joinResult.success) {
              console.error(
                "[App] Failed to join newly created session:",
                joinResult.error
              );
              alert(`Failed to join session: ${joinResult.error}`);
            }
          } else {
            console.error(
              "[App] Failed to initialize session:",
              initResult.error
            );
            alert(`Failed to create session: ${initResult.error}`);
          }
        }}
        onSessionJoined={handleSessionBrowserJoin}
        onPlayAI={async (playerName, difficulty) => {
          try {
            // Initialize session
            const initResult = await initializeSession("tic-tac-toe-classic", true);
            if (!initResult.success) {
              alert(`Failed to create session: ${initResult.error}`);
              return;
            }

            // Join session
            const joinResult = await joinSession(playerName, "user");
            if (!joinResult.success) {
              alert(`Failed to join session: ${joinResult.error}`);
              return;
            }

            // Set config with private flag and difficulty
            await KubicKode.setGameConfig({
              isPrivate: true,
              difficulty: difficulty,
            });

            // Add AI opponent
            const aiResult = await addAIParticipant();
            if (!aiResult.success) {
              alert(`Failed to add AI opponent: ${aiResult.error}`);
            }
          } catch (error) {
            console.error("[App] Failed to create AI game:", error);
            alert(`Failed to create AI game: ${error.message}`);
          }
        }}
      >
        {/* Join from Link Modal - render on WelcomeScreen too */}
        <GameModal
          isOpen={showJoinFromLinkModal}
          onClose={() => {}} // Can't close - must choose
          title="Join Game Session"
          message={
            linkSessionIsFull
              ? `You've been invited to join a game session! The game is full, so you'll join as a spectator to watch.`
              : `You've been invited to join a game session! Enter your name to join.`
          }
          type="info"
          showInput={true}
          inputPlaceholder="Enter your name"
          inputValue={linkPlayerName}
          onInputChange={setLinkPlayerName}
          primaryButton={{
            text: linkSessionIsFull ? "Join as Spectator" : "Join Game",
            onClick: handleJoinFromLink,
          }}
          secondaryButton={{
            text: "Cancel",
            onClick: () => {
              setShowJoinFromLinkModal(false);
              setLinkSessionId(null);
              setLinkPlayerName("");
              setLinkSessionIsFull(false);
              window.history.replaceState({}, document.title, window.location.pathname);
            },
          }}
        />
      </WelcomeScreen>
    );
  }

  // Show loading while session initializes
  if (sessionPhase === "loading" || isLoading) {
    return <LoadingScreen message="Initializing session..." />;
  }

  // Show error if session failed to initialize
  if (sessionPhase === "error" || error) {
    return (
      <ChakraContainer maxW="md" centerContent>
        <VStack spacing={4} py={8}>
          <Heading color="red.500">Session Error</Heading>
          <Text>{error}</Text>
        </VStack>
      </ChakraContainer>
    );
  }

  const handleQuickJoin = async () => {
    if (!testName.trim()) {
      alert("Please enter a name");
      return;
    }
    await handleJoinWithName(testName);
  };

  const handleStartGame = async () => {
    const result = await startGame();
    if (result.success) {
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

    const success = await handleMove(x, y);

    if (!success) {
      // Error already handled by useTicTacToe hook
    }
  };

  const renderGameBoard = () => {
    const { rows, cols } = getGridDimensions();

    if (!tileMap || rows === 0 || cols === 0) {
      return <Text color="gray.500">No game board available</Text>;
    }

    return (
      <Grid templateColumns={`repeat(${cols}, 1fr)`} gap={1} maxW="300px">
        {Array.from({ length: rows }, (_, y) =>
          Array.from({ length: cols }, (_, x) => {
            const tile = getTile(x, y);
            const cellValue = tile?.type || ""; // Use tile.type instead of tile.mark

            return (
              <GridItem key={`${x}-${y}`}>
                <Button
                  size="lg"
                  h="60px"
                  w="60px"
                  onClick={() => handleTileClick(x, y)}
                  isDisabled={
                    !gameActive ||
                    !isMyTurn ||
                    cellValue !== "" ||
                    gameDisabledByInactivity
                  }
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

    // Handle tie condition
    if (winner?.isTie) {
      return "🤝 It's a Tie!";
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
      // Only count playable participants (users and computers) for voting
      const totalPlayers = participants.filter(
        (p) => p.type === "user" || p.type === "computer"
      ).length;
      const yesVotes = Object.values(restartVotes).filter(
        (vote) => vote === true
      ).length;

      // Check if current participant is a spectator
      const currentParticipant = participants.find(
        (p) => p.id === participantId
      );
      const isSpectator = currentParticipant?.type === "spectator";

      // Add context about who won the last game
      const lastGameResult = winner?.isTie
        ? "The last game was a tie! 🤝"
        : winner
        ? winner.id === participantId
          ? "You won the last game! 🎉"
          : `${winner.name} won the last game.`
        : "Previous game finished.";

      // Show different message for spectators
      if (isSpectator) {
        if (voteCount === 0) {
          return `${lastGameResult}\n\nPlayers are voting on whether to play again. You're watching as a spectator.`;
        } else if (voteCount < totalPlayers) {
          return `${lastGameResult}\n\nPlayers are voting... (${yesVotes}/${totalPlayers} voted Yes)\n\nYou're watching as a spectator.`;
        } else {
          const allAgreed = Object.values(restartVotes).every(
            (vote) => vote === true
          );
          return allAgreed
            ? `${lastGameResult}\n\n🎉 Players agreed to play again! New game starting...`
            : `${lastGameResult}\n\n❌ Players decided not to restart.`;
        }
      }

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
    // Check if current participant is a spectator for regular win message too
    const currentParticipant = participants.find((p) => p.id === participantId);
    const isSpectator = currentParticipant?.type === "spectator";

    // Handle tie message
    if (winner?.isTie) {
      return isSpectator
        ? "The game ended in a tie! Players will vote on whether to play again."
        : "The game ended in a tie! No winner this round.";
    }

    if (isSpectator) {
      return `${
        winner?.name || "A player"
      } won the game! Players will vote on whether to play again.`;
    }

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
      // Only count playable participants (users and computers) for voting
      const totalPlayers = participants.filter(
        (p) => p.type === "user" || p.type === "computer"
      ).length;
      const hasVoted = restartVotes[participantId] !== undefined;
      const allVoted = voteCount === totalPlayers;

      // Check if current participant is a spectator
      const currentParticipant = participants.find(
        (p) => p.id === participantId
      );
      const isSpectator = currentParticipant?.type === "spectator";

      // Spectators can't vote, so no primary button for them
      if (isSpectator) {
        return undefined;
      }

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

    // Check if current participant is a spectator
    const currentParticipant = participants.find((p) => p.id === participantId);
    const isSpectator = currentParticipant?.type === "spectator";

    // Spectators can't request a new game
    if (isSpectator) {
      return undefined;
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
      // Only count playable participants (users and computers) for voting
      const totalPlayers = participants.filter(
        (p) => p.type === "user" || p.type === "computer"
      ).length;
      const hasVoted = restartVotes[participantId] !== undefined;
      const allVoted = voteCount === totalPlayers;

      // Check if current participant is a spectator
      const currentParticipant = participants.find(
        (p) => p.id === participantId
      );
      const isSpectator = currentParticipant?.type === "spectator";

      if (allVoted) {
        return {
          text: "Close",
          onClick: () => {
            handleWinModalClose();
            handleRestartVoteModalClose();
          },
        };
      }

      // Spectators can only close the modal
      if (isSpectator) {
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

          {/* Phase Info */}
          <Container bg="yellow.50" w="100%">
            <Text>
              <strong>Session Phase:</strong> {sessionPhase}
            </Text>
            <Text>
              <strong>Game Phase:</strong> {gamePhase || "none"}
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
                  <HStack justify="space-between" w="100%">
                    <VStack align="start" spacing={2}>
                      <Text>
                        <strong>Session ID:</strong>{" "}
                        {sessionId || "Not initialized"}
                      </Text>
                      <Text>
                        <strong>Are you the host?:</strong>{" "}
                        {isHost ? "Yes" : "No"}
                      </Text>
                    </VStack>
                    <Button
                      colorScheme="red"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const result = await leaveSession();
                        if (!result.success) {
                          console.error(
                            "Failed to leave session:",
                            result.error
                          );
                        }
                      }}
                    >
                      Leave Game
                    </Button>
                  </HStack>
                  <Text>
                    <strong>Players:</strong>{" "}
                    {
                      participants.filter(
                        (p) => p.type === "user" || p.type === "computer"
                      ).length
                    }
                    /{maxPlayers}
                    {participants.filter((p) => p.type === "spectator").length >
                      0 && (
                      <Text as="span" ml={2} color="gray.600">
                        (+
                        {
                          participants.filter((p) => p.type === "spectator")
                            .length
                        }{" "}
                        spectator
                        {participants.filter((p) => p.type === "spectator")
                          .length > 1
                          ? "s"
                          : ""}
                        )
                      </Text>
                    )}
                  </Text>
                </VStack>
              </Container>

              {/* Shareable Session Link */}
              {sessionId && participantId && (
                <ShareableSessionLink sessionId={sessionId} />
              )}

              {/* Participants & Win Counter Table */}
              <Container w="100%">
                <Heading size="md" mb={3}>
                  Participants
                </Heading>
                {participants.length === 0 ? (
                  <Text color="gray.500">No participants yet</Text>
                ) : (
                  <Table variant="simple" size="sm">
                    <Thead>
                      <Tr>
                        <Th>Player</Th>
                        <Th>ID</Th>
                        <Th>Host</Th>
                        <Th isNumeric>Wins</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {participants.map((participant, index) => (
                        <Tr key={participant.id}>
                          <Td>
                            {participant.name}
                            {participant.id === participantId && (
                              <Badge ml={2} colorScheme="blue" size="sm">
                                You
                              </Badge>
                            )}
                            {participant.type === "computer" && (
                              <Badge ml={2} colorScheme="orange" size="sm">
                                🤖 AI
                              </Badge>
                            )}
                            {participant.type === "spectator" && (
                              <Badge ml={2} colorScheme="gray" size="sm">
                                👁️ Spectator
                              </Badge>
                            )}
                          </Td>
                          <Td>{participant.id}</Td>
                          <Td>{index === 0 ? "👑" : "-"}</Td>
                          <Td isNumeric>
                            {participant.type === "spectator" ? (
                              ""
                            ) : (
                              <Badge
                                colorScheme={
                                  getWinCountForPlayer(participant.id) > 0
                                    ? "green"
                                    : "gray"
                                }
                                variant="solid"
                              >
                                {getWinCountForPlayer(participant.id)}
                              </Badge>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                    <Tfoot>
                      <Tr>
                        <Th colSpan={3}>Total Games:</Th>
                        <Th isNumeric>{getTotalGames()}</Th>
                      </Tr>
                    </Tfoot>
                  </Table>
                )}
              </Container>

              {/* Add AI Opponent */}
              {(() => {
                const playableCount = participants.filter(
                  (p) => p.type === "user" || p.type === "computer"
                ).length;
                const sessionConfig = KubicKode.sessionConfig?.getState?.()?.config || {};
                const isPrivate = sessionConfig.isPrivate === true;
                // Only show Add AI button for private game sessions
                return (
                  participantId &&
                  playableCount < maxPlayers &&
                  !gameStarted &&
                  isPrivate
                );
              })() && (
                <Container bg="orange.50" w="100%">
                  <VStack spacing={3}>
                    <Heading size="md">Play vs AI</Heading>
                    <Button
                      colorScheme="orange"
                      onClick={async () => {
                        try {
                          const result = await addAIParticipant();
                          if (result.success) {
                            // Refresh data to trigger auto-start logic
                            await refreshData();
                          } else {
                            alert(`Failed to add AI opponent: ${result.error}`);
                          }
                        } catch (error) {
                          alert(`Error adding AI opponent: ${error.message}`);
                        }
                      }}
                    >
                      Add AI Opponent
                    </Button>
                  </VStack>
                </Container>
              )}

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
                      <HStack spacing={2}>
                        <Button colorScheme="blue" onClick={handleQuickJoin}>
                          Create/Join Session
                        </Button>
                        <Button
                          colorScheme="green"
                          variant="outline"
                          onClick={() => setShowSessionBrowser(true)}
                        >
                          Browse Games
                        </Button>
                      </HStack>
                    </VStack>
                  </VStack>
                </Container>
              )}

              {/* Session Status */}
              <Container bg="green.50" w="100%">
                <Text>
                  <strong>Session Status:</strong>
                </Text>
                {(() => {
                  const playableCount = participants.filter(
                    (p) => p.type === "user" || p.type === "computer"
                  ).length;
                  const spectatorCount = participants.filter(
                    (p) => p.type === "spectator"
                  ).length;

                  if (playableCount === 0) {
                    return <Text>🔄 Waiting for participants...</Text>;
                  } else if (playableCount === 1) {
                    return (
                      <Text>
                        👤 1 player joined, waiting for 2nd player...
                        {spectatorCount > 0 &&
                          ` (${spectatorCount} spectator${
                            spectatorCount > 1 ? "s" : ""
                          })`}
                      </Text>
                    );
                  } else if (playableCount >= 2) {
                    return (
                      <Text>
                        🎉 {playableCount} players joined! Game has now started
                        automatically.
                        {spectatorCount > 0 &&
                          ` (${spectatorCount} spectator${
                            spectatorCount > 1 ? "s" : ""
                          })`}
                      </Text>
                    );
                  }
                })()}
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
                  {inactivityTimer !== null && gameActive && (
                    <HStack>
                      <Text>
                        <strong>Inactivity Timer:</strong>
                      </Text>
                      <LiveTimer
                        inactivityTimer={inactivityTimer}
                        gameActive={gameActive}
                      />
                    </HStack>
                  )}
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
              </HStack>
            </VStack>
          </Container>
        </VStack>
      </ChakraContainer>

      {/* Spectator Modal */}
      <GameModal
        isOpen={showSpectatorModal}
        onClose={() => {}} // Can't close - must choose
        title="Game is Full"
        message="This game session is full. Would you like to join as a spectator to watch the game?"
        type="info"
        showInput={true}
        inputPlaceholder="Enter your name to join as spectator"
        inputValue={spectatorName}
        onInputChange={setSpectatorName}
        primaryButton={{
          text: "Join as Spectator",
          onClick: () => {
            if (spectatorName.trim()) {
              handleJoinAsSpectator(spectatorName.trim());
            } else {
              alert("Please enter your name first");
            }
          },
        }}
        secondaryButton={{
          text: "Cancel",
          onClick: () => window.location.reload(), // Go back to start
        }}
      />

      <GameModal
        isOpen={showWinModal}
        onClose={handleWinModalClose}
        title={getWinModalTitle()}
        message={getWinModalMessage()}
        type={getWinModalType()}
        primaryButton={getWinModalPrimaryButton()}
        secondaryButton={getWinModalSecondaryButton()}
      />

      {/* Session Ended Modal */}
      <GameModal
        isOpen={showSessionEndedModal}
        onClose={() => {}} // Can't close - session is terminated
        title="Session Ended"
        message={
          sessionEndedReason
            ? `The game session has ended: ${sessionEndedReason.reason}`
            : "The game session has ended unexpectedly."
        }
        type="error"
        primaryButton={{
          text: "Return to Welcome",
          onClick: handleSessionEndedModalClose,
        }}
      />

      {/* Session Browser Modal */}
      <SessionBrowserModal
        isOpen={showSessionBrowser}
        onClose={() => setShowSessionBrowser(false)}
        onSessionJoined={handleSessionBrowserJoin}
        currentSessionId={sessionId}
      />
    </Box>
  );
}

function App() {
  return <AppContent />;
}

export default App;

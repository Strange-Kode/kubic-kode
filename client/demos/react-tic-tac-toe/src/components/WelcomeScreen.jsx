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
} from "@chakra-ui/react";
import { SessionBrowserModal } from "./SessionBrowserModal";

export function WelcomeScreen({ onCreateGame, onSessionJoined }) {
  const [playerName, setPlayerName] = useState("");
  const [showSessionBrowser, setShowSessionBrowser] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateGame = async () => {
    if (!playerName.trim()) {
      alert("Please enter your name");
      return;
    }

    setIsLoading(true);
    try {
      await onCreateGame(playerName.trim());
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionBrowserJoin = async (joinResult) => {
    setShowSessionBrowser(false);
    await onSessionJoined(joinResult);
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <ChakraContainer maxW="4xl" py={8}>
        <VStack spacing={8}>
          <Box textAlign="center">
            <Heading size="xl" mb={4}>Tic Tac Toe Classic</Heading>
            <Text color="gray.600" fontSize="lg">
              Choose how you'd like to play
            </Text>
          </Box>

          <HStack spacing={8} align="stretch">
            <VStack spacing={4} p={8} bg="white" borderRadius="lg" shadow="md" flex="1">
              <Heading size="md" color="blue.600">Create New Game</Heading>
              <Text textAlign="center" color="gray.600">
                Start a new game session and invite others to join
              </Text>
              <Input
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxW="250px"
                onKeyPress={(e) => e.key === "Enter" && handleCreateGame()}
              />
              <Button 
                colorScheme="blue" 
                size="lg"
                onClick={handleCreateGame}
                isLoading={isLoading}
                minW="200px"
              >
                Create & Host Game
              </Button>
            </VStack>

            <VStack spacing={4} p={8} bg="white" borderRadius="lg" shadow="md" flex="1">
              <Heading size="md" color="green.600">Join Existing Game</Heading>
              <Text textAlign="center" color="gray.600">
                Browse and join games created by other players
              </Text>
              <Box h="40px" /> {/* Spacer to align with the input field */}
              <Button 
                colorScheme="green" 
                size="lg"
                onClick={() => setShowSessionBrowser(true)}
                minW="200px"
              >
                Browse Games
              </Button>
            </VStack>
          </HStack>

          <Box textAlign="center" pt={4}>
            <Text fontSize="sm" color="gray.500">
              Create a new game to become the host, or join an existing game to play with others
            </Text>
          </Box>
        </VStack>
      </ChakraContainer>

      {/* Session Browser Modal */}
      <SessionBrowserModal
        isOpen={showSessionBrowser}
        onClose={() => setShowSessionBrowser(false)}
        onSessionJoined={handleSessionBrowserJoin}
        currentSessionId={null} // Welcome screen has no current session
      />
    </Box>
  );
}
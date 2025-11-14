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
  Select,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
} from "@chakra-ui/react";
import { SessionBrowserModal } from "./SessionBrowserModal";

export function WelcomeScreen({ onCreateGame, onSessionJoined, onPlayAI }) {
  const [createGameName, setCreateGameName] = useState("");
  const [aiGameName, setAIGameName] = useState("");
  const [showSessionBrowser, setShowSessionBrowser] = useState(false);
  const [showAIDifficultyModal, setShowAIDifficultyModal] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState("medium");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateGame = async () => {
    if (!createGameName.trim()) {
      alert("Please enter your name");
      return;
    }

    setIsLoading(true);
    try {
      await onCreateGame(createGameName.trim());
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionBrowserJoin = async (joinResult) => {
    setShowSessionBrowser(false);
    await onSessionJoined(joinResult);
  };

  const handleOpenAIModal = () => {
    if (!aiGameName.trim()) {
      alert("Please enter your name");
      return;
    }
    setShowAIDifficultyModal(true);
  };

  const handlePlayAI = async () => {
    setIsLoading(true);
    setShowAIDifficultyModal(false);
    try {
      await onPlayAI(aiGameName.trim(), selectedDifficulty);
    } finally {
      setIsLoading(false);
    }
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

          <HStack spacing={6} align="stretch">
            <VStack spacing={4} p={8} bg="white" borderRadius="lg" shadow="md" flex="1">
              <Heading size="md" color="blue.600">Create New Game</Heading>
              <Text textAlign="center" color="gray.600">
                Start a new game session and invite others to join
              </Text>
              <Input
                placeholder="Enter your name"
                value={createGameName}
                onChange={(e) => setCreateGameName(e.target.value)}
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
              <Heading size="md" color="orange.600">Play Against AI</Heading>
              <Text textAlign="center" color="gray.600">
                Challenge an AI opponent at your chosen difficulty
              </Text>
              <Input
                placeholder="Enter your name"
                value={aiGameName}
                onChange={(e) => setAIGameName(e.target.value)}
                maxW="250px"
                onKeyPress={(e) => e.key === "Enter" && handleOpenAIModal()}
              />
              <Button
                colorScheme="orange"
                size="lg"
                onClick={handleOpenAIModal}
                isLoading={isLoading}
                minW="200px"
              >
                Play Against AI
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

      {/* AI Difficulty Selection Modal */}
      <Modal isOpen={showAIDifficultyModal} onClose={() => setShowAIDifficultyModal(false)}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Choose AI Difficulty</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <Text>Select the difficulty level for your AI opponent:</Text>
              <Select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                size="lg"
              >
                <option value="very_easy">Very Easy</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </Select>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => setShowAIDifficultyModal(false)}>
              Cancel
            </Button>
            <Button colorScheme="orange" onClick={handlePlayAI} isLoading={isLoading}>
              Start Game
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
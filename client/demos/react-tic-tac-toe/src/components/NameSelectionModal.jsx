import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  FormControl,
  FormLabel,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";

const NameSelectionModal = ({ isOpen, onClose, onJoin, sessionId }) => {
  const [name, setName] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!name.trim()) return;

    setIsJoining(true);
    try {
      await onJoin({ name: name.trim() });
      onClose();
    } catch (error) {
      // Error handling is done in the onJoin function
      console.error("Failed to join:", error);
    } finally {
      setIsJoining(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && name.trim()) {
      handleJoin();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} closeOnOverlayClick={false}>
      <ModalOverlay bg="rgba(0,0,0,0.8)" />
      <ModalContent mx={4}>
        <ModalHeader>
          <Text fontSize="xl" fontWeight="bold" color="blue.700">
            Join Game Session
          </Text>
        </ModalHeader>
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Text color="gray.600">
              Choose your display name to join the Tic-Tac-Toe game.
            </Text>
            <FormControl>
              <FormLabel fontSize="sm" fontWeight="medium">
                Your Name
              </FormLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter your name..."
                focusBorderColor="blue.300"
                autoFocus
                maxLength={20}
              />
            </FormControl>
            {sessionId && (
              <Text fontSize="xs" color="gray.500">
                Session ID: {sessionId}
              </Text>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button
            colorScheme="blue"
            onClick={handleJoin}
            isDisabled={!name.trim()}
            isLoading={isJoining}
            loadingText="Joining..."
            size="lg"
            w="full"
          >
            Join Game
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default NameSelectionModal;

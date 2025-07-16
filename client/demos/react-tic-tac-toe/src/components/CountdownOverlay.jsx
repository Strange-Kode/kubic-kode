import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  Text,
  VStack,
  Box,
  useColorModeValue,
} from "@chakra-ui/react";
import { useState, useEffect } from "react";

const CountdownOverlay = ({ isOpen, onComplete, initialCount = 3 }) => {
  const [count, setCount] = useState(initialCount);

  const bgGradient = useColorModeValue(
    "linear(to-br, blue.400, purple.500)",
    "linear(to-br, blue.600, purple.700)"
  );

  useEffect(() => {
    if (!isOpen) {
      setCount(initialCount);
      return;
    }

    if (count > 0) {
      const timer = setTimeout(() => {
        setCount(count - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown finished
      const timer = setTimeout(() => {
        onComplete();
      }, 500); // Small delay after showing "GO!"
      return () => clearTimeout(timer);
    }
  }, [count, isOpen, onComplete, initialCount]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Prevent closing during countdown
      isCentered
      closeOnOverlayClick={false}
      closeOnEsc={false}
    >
      <ModalOverlay bg="blackAlpha.700" />
      <ModalContent bg="transparent" boxShadow="none" maxW="300px">
        <ModalBody p={0}>
          <VStack spacing={6}>
            <Text
              fontSize="xl"
              fontWeight="bold"
              color="white"
              textAlign="center"
            >
              Game Starting...
            </Text>

            <Box
              bgGradient={bgGradient}
              borderRadius="full"
              w="120px"
              h="120px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              boxShadow="0 8px 32px rgba(0,0,0,0.3)"
              transform={count === 0 ? "scale(1.1)" : "scale(1)"}
              transition="all 0.3s ease"
            >
              <Text
                fontSize={count === 0 ? "3xl" : "4xl"}
                fontWeight="bold"
                color="white"
                textAlign="center"
              >
                {count === 0 ? "GO!" : count}
              </Text>
            </Box>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default CountdownOverlay;

import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalHeader,
  ModalFooter,
  Text,
  Button,
  VStack,
  Input,
  useColorModeValue,
} from "@chakra-ui/react";

const GameModal = ({
  isOpen,
  onClose,
  title,
  message,
  type = "info", // "info", "success", "warning", "error"
  primaryButton = null,
  secondaryButton = null,
  // Optional input field
  showInput = false,
  inputPlaceholder = "Enter text...",
  inputValue = "",
  onInputChange = null,
}) => {
  const getColorScheme = () => {
    switch (type) {
      case "success":
        return "green";
      case "warning":
        return "orange";
      case "error":
        return "red";
      default:
        return "blue";
    }
  };

  const getEmoji = () => {
    switch (type) {
      case "success":
        return "🎉";
      case "warning":
        return "⚠️";
      case "error":
        return "😞";
      default:
        return "🎮";
    }
  };

  const bgGradient = useColorModeValue(
    "linear(to-br, white, gray.50)",
    "linear(to-br, gray.800, gray.900)"
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCentered
      closeOnOverlayClick={false}
      closeOnEsc={false}
    >
      <ModalOverlay bg="blackAlpha.600" />
      <ModalContent
        bgGradient={bgGradient}
        borderRadius="2xl"
        boxShadow="0 20px 60px rgba(0,0,0,0.3)"
        maxW="400px"
        mx={4}
      >
        <ModalHeader textAlign="center" pb={2}>
          <VStack spacing={2}>
            <Text fontSize="3xl" role="img" aria-label="emoji">
              {getEmoji()}
            </Text>
            <Text
              fontSize="xl"
              fontWeight="bold"
              color={`${getColorScheme()}.600`}
            >
              {title}
            </Text>
          </VStack>
        </ModalHeader>

        <ModalBody textAlign="center" py={4}>
          <VStack spacing={4}>
            <Text fontSize="md" color="gray.700">
              {message}
            </Text>
            
            {showInput && (
              <Input
                placeholder={inputPlaceholder}
                value={inputValue}
                onChange={(e) => onInputChange?.(e.target.value)}
                size="lg"
                textAlign="center"
                bg="white"
                border="2px"
                borderColor="gray.200"
                _focus={{
                  borderColor: `${getColorScheme()}.500`,
                  boxShadow: `0 0 0 1px ${getColorScheme()}.500`,
                }}
              />
            )}
          </VStack>
        </ModalBody>

        <ModalFooter justifyContent="center" pt={2}>
          <VStack spacing={3} w="full">
            {primaryButton && (
              <Button
                colorScheme={getColorScheme()}
                size="lg"
                w="full"
                onClick={primaryButton.onClick}
              >
                {primaryButton.text}
              </Button>
            )}

            {secondaryButton && (
              <Button
                variant="ghost"
                size="md"
                onClick={secondaryButton.onClick}
              >
                {secondaryButton.text}
              </Button>
            )}
          </VStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default GameModal;

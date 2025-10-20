import {
  Box,
  Text,
  Input,
  Button,
  HStack,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";

const ShareableSessionLink = ({ sessionId }) => {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  // Generate the shareable link
  const shareableLink = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share this link with your friend to join the game",
        status: "success",
        duration: 2000,
        isClosable: true,
        position: "bottom-left",
      });

      // Reset the copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please copy the link manually",
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "bottom-left",
      });
    }
  };

  if (!sessionId) {
    return null;
  }

  return (
    <Box
      bg="blue.50"
      p={4}
      borderRadius="lg"
      borderWidth={1}
      borderColor="blue.200"
      w="full"
      maxW="md"
    >
      <VStack spacing={3} align="stretch">
        <Text fontSize="sm" fontWeight="medium" color="blue.800">
          Share this link with a friend to play together:
        </Text>

        <HStack spacing={2}>
          <Input
            value={shareableLink}
            isReadOnly
            size="sm"
            bg="white"
            borderColor="blue.300"
            fontSize="xs"
            color="gray.700"
          />
          <Button
            size="sm"
            colorScheme="blue"
            onClick={copyToClipboard}
            variant={copied ? "solid" : "outline"}
            minW="80px"
          >
            {copied ? "✓ Copied!" : "📋 Copy"}
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
};

export default ShareableSessionLink;

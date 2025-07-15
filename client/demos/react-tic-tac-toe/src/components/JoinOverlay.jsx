import { Box, Flex, Heading, Text, Button } from "@chakra-ui/react";

const JoinOverlay = ({ onJoin }) => {
  return (
    <Flex
      position="fixed"
      top={0}
      left={0}
      width="100vw"
      height="100vh"
      bg="rgba(0,0,0,0.8)"
      align="center"
      justify="center"
      zIndex={1000}
    >
      <Box
        bg="white"
        px={12}
        py={8}
        borderRadius="2xl"
        boxShadow="lg"
        textAlign="center"
        minW="320px"
      >
        <Heading as="h2" size="lg" mb={4} color="blue.700">
          Host already exists
        </Heading>
        <Text fontSize="md" mb={8} color="gray.700">
          Would you like to join the game as Player 2?
        </Text>
        <Button colorScheme="blue" size="lg" borderRadius="md" onClick={onJoin}>
          Join Game
        </Button>
      </Box>
    </Flex>
  );
};

export default JoinOverlay;

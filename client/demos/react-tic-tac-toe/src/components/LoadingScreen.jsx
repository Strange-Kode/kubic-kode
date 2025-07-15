import { Box, Flex, Spinner, Text, useColorModeValue } from "@chakra-ui/react";

const LoadingScreen = ({ message = "Connecting to game..." }) => {
  const bgGradient = useColorModeValue(
    "linear(to-br, teal.50, blue.50, purple.100)",
    "linear(to-br, gray.800, blue.900, purple.900)"
  );
  return (
    <Flex minH="100vh" align="center" justify="center" bgGradient={bgGradient}>
      <Box
        textAlign="center"
        p={8}
        bg={useColorModeValue("whiteAlpha.900", "gray.700")}
        borderRadius="2xl"
        boxShadow="lg"
      >
        <Spinner
          thickness="4px"
          speed="0.8s"
          emptyColor="gray.200"
          color="blue.400"
          size="xl"
          mb={4}
        />
        <Text color={useColorModeValue("gray.600", "gray.200")} fontSize="lg">
          {message}
        </Text>
      </Box>
    </Flex>
  );
};

export default LoadingScreen;

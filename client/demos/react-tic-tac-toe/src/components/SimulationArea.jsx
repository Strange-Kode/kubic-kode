import {
  Box,
  VStack,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Text,
  SimpleGrid,
  Select,
  Button,
} from "@chakra-ui/react";
import { useSimulationEngine } from "../SimulationEngine";

const cellOptions = ["", "X", "O"];

const SimulationArea = ({ showJoinOverlay }) => {
  const { gameState, simulateSetCell, simulateSetField } =
    useSimulationEngine();
  const { matrix, turn, player, status, isPlayerTurn, gameActive, validMoves } =
    gameState;

  // Update a cell in the matrix (simulates backend update)
  const setCell = (row, col, value) => {
    simulateSetCell(row, col, value);
  };

  // Update turn, player, or status (simulates backend update)
  const setField = (field, value) => {
    simulateSetField(field, value);
  };

  return (
    <Box
      position="fixed"
      top={4}
      right={4}
      zIndex={1200}
      bgGradient="linear(to-br, whiteAlpha.900, blue.50, purple.50)"
      p={6}
      borderRadius="xl"
      boxShadow="0 4px 24px rgba(80, 80, 180, 0.18)"
      borderWidth={1}
      borderColor="purple.200"
      w="340px"
      maxW="90vw"
      color="gray.800"
    >
      <VStack spacing={4} align="stretch">
        <Heading as="h2" size="md" color="gray.900">
          Simulation Backend
        </Heading>

        {/* Matrix Controls */}
        <FormControl>
          <FormLabel fontSize="sm" fontWeight="medium" color="gray.800">
            Board Matrix
          </FormLabel>
          <SimpleGrid columns={3} spacing={2}>
            {[0, 1, 2].map((rowIdx) =>
              [0, 1, 2].map((colIdx) => {
                const key = `${rowIdx},${colIdx}`;
                const cell = matrix[key];
                return (
                  <Select
                    key={`sim-matrix-${rowIdx}-${colIdx}`}
                    value={cell}
                    onChange={(e) => setCell(rowIdx, colIdx, e.target.value)}
                    size="md"
                  >
                    {cellOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === "" ? "-" : opt}
                      </option>
                    ))}
                  </Select>
                );
              })
            )}
          </SimpleGrid>
        </FormControl>

        {/* Turn Control */}
        <FormControl>
          <FormLabel fontSize="sm" fontWeight="medium" color="gray.800">
            Current Turn
          </FormLabel>
          <Select
            value={turn}
            onChange={(e) => setField("turn", e.target.value)}
            size="md"
            maxW="120px"
          >
            <option value="X">X</option>
            <option value="O">O</option>
          </Select>
        </FormControl>

        {/* Player Identity Control */}
        <FormControl>
          <FormLabel fontSize="sm" fontWeight="medium" color="gray.800">
            Player Identity ("You are")
          </FormLabel>
          <Select
            value={player}
            onChange={(e) => setField("player", e.target.value)}
            size="md"
            maxW="120px"
          >
            <option value="X">X</option>
            <option value="O">O</option>
          </Select>
        </FormControl>

        {/* Status Message Control */}
        <FormControl>
          <FormLabel fontSize="sm" fontWeight="medium" color="gray.800">
            Status Message
          </FormLabel>
          <Input
            value={status}
            onChange={(e) => setField("status", e.target.value)}
            placeholder="Enter status message"
            focusBorderColor="blue.300"
          />
        </FormControl>

        {/* Validation Controls */}
        <FormControl>
          <FormLabel fontSize="sm" fontWeight="medium" color="gray.800">
            Is Player Turn
          </FormLabel>
          <Select
            value={isPlayerTurn ? "true" : "false"}
            onChange={(e) =>
              setField("isPlayerTurn", e.target.value === "true")
            }
            size="md"
            maxW="120px"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel fontSize="sm" fontWeight="medium" color="gray.800">
            Game Active
          </FormLabel>
          <Select
            value={gameActive ? "true" : "false"}
            onChange={(e) => setField("gameActive", e.target.value === "true")}
            size="md"
            maxW="120px"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </FormControl>

        <Text fontSize="xs" color="gray.700">
          Edit these fields to simulate WebSocket-driven state changes.
          <br />
          Valid moves: {validMoves?.join(", ") || "none"}
        </Text>

        {/* Button to trigger JoinOverlay for demo/testing */}
        <Button mt={2} size="sm" colorScheme="blue" onClick={showJoinOverlay}>
          Show Join Overlay (Demo)
        </Button>
      </VStack>
    </Box>
  );
};

export default SimulationArea;

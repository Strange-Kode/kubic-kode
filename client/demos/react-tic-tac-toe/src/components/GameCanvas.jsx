import { Box, SimpleGrid, Button } from "@chakra-ui/react";
import { useSimulationEngine } from "../SimulationEngine";

const cellColors = {
  X: "purple.400",
  O: "blue.400",
  "": "gray.100",
};

const GameCanvas = () => {
  // Use SimulationEngine - this will later be replaced by direct backend calls
  const { gameState, onCellClick } = useSimulationEngine();
  const { matrix, isPlayerTurn, gameActive, validMoves } = gameState;

  const handleCellClick = (row, col) => {
    onCellClick(row, col);
  };

  return (
    <Box w="full" maxW="400px" mx="auto">
      <SimpleGrid columns={3} spacing={2}>
        {[0, 1, 2].map((rowIdx) =>
          [0, 1, 2].map((colIdx) => {
            const key = `${rowIdx},${colIdx}`;
            const cell = matrix[key];

            // todo, create a hook?
            // Button validation driven entirely by gameState
            const isButtonDisabled =
              cell !== "" || // Cell already occupied
              !isPlayerTurn || // Not your turn
              !gameActive || // Game not active
              !validMoves?.includes(key); // Move not valid per backend

            return (
              <Button
                key={key}
                h="80px"
                fontSize="2xl"
                colorScheme={
                  cell === "X" ? "purple" : cell === "O" ? "blue" : "gray"
                }
                variant={cell ? "solid" : "outline"}
                bg={cell ? cellColors[cell] : "white"}
                color={cell ? "white" : "gray.500"}
                borderWidth={2}
                borderColor="gray.300"
                onClick={() => handleCellClick(rowIdx, colIdx)}
                isDisabled={isButtonDisabled}
                _hover={{ opacity: 0.85 }}
                _active={{ opacity: 0.7 }}
                transition="all 0.1s"
              >
                {cell}
              </Button>
            );
          })
        )}
      </SimpleGrid>
    </Box>
  );
};

export default GameCanvas;

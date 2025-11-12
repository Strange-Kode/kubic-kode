import { Box, SimpleGrid, Button } from "@chakra-ui/react";
import { useTicTacToe } from "../hooks/useTicTacToe";

const cellColors = {
  X: "purple.400",
  O: "blue.400",
  "": "gray.100",
};

const GameCanvas = () => {
  const {
    tileMap,
    isMyTurn,
    gameActive,
    handleMove,
    getTile,
    getGridDimensions,
  } = useTicTacToe();

  // Get grid dimensions from the hook
  const { rows, cols } = getGridDimensions();

  const handleCellClick = async (row, col) => {
    // Only allow moves if it's the player's turn and game is active
    if (!isMyTurn || !gameActive) {
      return;
    }

    // Attempt to make the move
    await handleMove(col, row);
  };

  // Show loading state if no tileMap yet
  if (!tileMap || rows === 0 || cols === 0) {
    return (
      <Box w="full" maxW="400px" mx="auto" p={4} textAlign="center">
        <Box>Loading game board...</Box>
      </Box>
    );
  }

  return (
    <Box w="full" maxW="400px" mx="auto">
      <SimpleGrid columns={3} spacing={2}>
        {[0, 1, 2].map((rowIdx) =>
          [0, 1, 2].map((colIdx) => {
            // Get the tile value from the backend TileMap
            const tile = getTile(colIdx, rowIdx); // getTile expects (x, y) format
            const cellValue = tile?.type || ""; // Use tile.type instead of tile.mark

            // Button validation - simpler logic since backend handles validation
            const isButtonDisabled =
              cellValue !== "" || // Cell already occupied
              !isMyTurn || // Not your turn
              !gameActive; // Game not active

            return (
              <Button
                key={`${rowIdx}-${colIdx}`}
                h="80px"
                fontSize="2xl"
                colorScheme={
                  cellValue === "X"
                    ? "purple"
                    : cellValue === "O"
                    ? "blue"
                    : "gray"
                }
                variant={cellValue ? "solid" : "outline"}
                bg={cellValue ? cellColors[cellValue] : "white"}
                color={cellValue ? "white" : "gray.500"}
                borderWidth={2}
                borderColor="gray.300"
                onClick={() => handleCellClick(rowIdx, colIdx)}
                isDisabled={isButtonDisabled}
                _hover={{ opacity: 0.85 }}
                _active={{ opacity: 0.7 }}
                transition="all 0.1s"
              >
                {cellValue}
              </Button>
            );
          })
        )}
      </SimpleGrid>
    </Box>
  );
};

export default GameCanvas;

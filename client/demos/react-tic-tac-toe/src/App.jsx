import { useState } from "react";
import { Box, Container, VStack, Heading, Text, Button, Input } from "@chakra-ui/react";
import LoadingScreen from "./components/LoadingScreen";
import NameSelectionModal from "./components/NameSelectionModal";
import { useSession } from "./hooks/useSession";

function AppContent() {
  const {
    sessionId,
    participantId,
    participants,
    isSessionLoading,
    sessionError,
    isHost,
    joinSession,
    fetchParticipants,
  } = useSession();

  const [showNameModal, setShowNameModal] = useState(false);
  const [testName, setTestName] = useState("");

  // Show loading while session initializes
  if (isSessionLoading) {
    return <LoadingScreen message="Initializing session..." />;
  }

  // Show error if session failed to initialize
  if (sessionError) {
    return (
      <Container maxW="md" centerContent>
        <VStack spacing={4} py={8}>
          <Heading color="red.500">Session Error</Heading>
          <Text>{sessionError}</Text>
        </VStack>
      </Container>
    );
  }

  const handleJoinWithName = async (name) => {
    console.log("[App] Attempting to join with name:", name);
    const result = await joinSession(name);
    
    if (result.success) {
      setShowNameModal(false);
      console.log("[App] Successfully joined session");
    } else {
      console.error("[App] Failed to join session:", result.error);
      alert(`Failed to join: ${result.error}`);
    }
  };

  const handleQuickJoin = async () => {
    if (!testName.trim()) {
      alert("Please enter a name");
      return;
    }
    await handleJoinWithName(testName);
  };

  return (
    <Box minH="100vh" bg="gray.50">
      <Container maxW="4xl" py={8}>
        <VStack spacing={6}>
          <Heading>🎮 useSession Hook Test</Heading>
          
          {/* Session Info */}
          <Box p={4} bg="white" borderRadius="md" shadow="sm" w="100%">
            <VStack align="start" spacing={2}>
              <Text><strong>Session ID:</strong> {sessionId || "Not initialized"}</Text>
              <Text><strong>Participant ID:</strong> {participantId || "Not joined"}</Text>
              <Text><strong>Is Host:</strong> {isHost ? "Yes" : "No"}</Text>
              <Text><strong>Total Participants:</strong> {participants.length}/2</Text>
            </VStack>
          </Box>

          {/* Participants List */}
          <Box p={4} bg="white" borderRadius="md" shadow="sm" w="100%">
            <Heading size="md" mb={3}>Participants</Heading>
            {participants.length === 0 ? (
              <Text color="gray.500">No participants yet</Text>
            ) : (
              <VStack align="start" spacing={1}>
                {participants.map((participant, index) => (
                  <Text key={participant.id}>
                    {index + 1}. {participant.name} (ID: {participant.id})
                    {participant.id === participantId && " ← You"}
                    {index === 0 && " (Host)"}
                  </Text>
                ))}
              </VStack>
            )}
          </Box>

          {/* Join Controls */}
          {!participantId && (
            <Box p={4} bg="blue.50" borderRadius="md" w="100%">
              <VStack spacing={3}>
                <Heading size="md">Join Session</Heading>
                <VStack spacing={2} w="100%">
                  <Input
                    placeholder="Enter your name"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    maxW="300px"
                  />
                  <Button colorScheme="blue" onClick={handleQuickJoin}>
                    Join Session
                  </Button>
                </VStack>
                <Text fontSize="sm" color="gray.600">Or</Text>
                <Button 
                  variant="outline" 
                  onClick={() => setShowNameModal(true)}
                >
                  Open Name Modal (Original)
                </Button>
              </VStack>
            </Box>
          )}

          {/* Actions */}
          <Box p={4} bg="gray.50" borderRadius="md" w="100%">
            <VStack spacing={2}>
              <Heading size="sm">Debug Actions</Heading>
              <Button size="sm" onClick={fetchParticipants}>
                Refresh Participants
              </Button>
            </VStack>
          </Box>

          {/* Status */}
          <Box p={4} bg="green.50" borderRadius="md" w="100%">
            <Text><strong>Status:</strong></Text>
            {participants.length === 0 && <Text>🔄 Waiting for participants...</Text>}
            {participants.length === 1 && <Text>👤 1 player joined, waiting for 2nd player...</Text>}
            {participants.length === 2 && <Text>🎉 2 players joined! Ready to start game.</Text>}
            {participants.length > 2 && <Text>⚠️ Too many participants ({participants.length})</Text>}
          </Box>
        </VStack>

        {/* Name Selection Modal */}
        <NameSelectionModal
          isOpen={showNameModal}
          onClose={() => setShowNameModal(false)}
          onSubmit={handleJoinWithName}
        />
      </Container>
    </Box>
  );
}

function App() {
  return <AppContent />;
}

export default App;

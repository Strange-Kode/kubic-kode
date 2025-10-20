import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import { SessionBrowser } from "./SessionBrowser";

export function SessionBrowserModal({ isOpen, onClose, onSessionJoined, currentSessionId = null }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent maxW="90vw" maxH="90vh">
        <ModalHeader>Session Browser</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6} overflowY="auto">
          <SessionBrowser 
            onSessionJoined={onSessionJoined}
            onClose={onClose}
            currentSessionId={currentSessionId}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
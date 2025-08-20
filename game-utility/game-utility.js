/**
 * Recursively serializes any object, handling nested class instances via toJSON
 * @param {any} obj - The object to serialize
 * @param {WeakSet} visited - Set of already visited objects to prevent circular references
 * @returns {any} The serialized object
 */
export function serializeRecursively(obj, visited = new WeakSet()) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Prevent circular references
  if (visited.has(obj)) {
    return "[Circular Reference]";
  }
  visited.add(obj);

  if (typeof obj.toJSON === "function") {
    return serializeRecursively(obj.toJSON(), visited);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => serializeRecursively(item, visited));
  }

  const serialized = {};
  for (const [key, value] of Object.entries(obj)) {
    serialized[key] = serializeRecursively(value, visited);
  }

  return serialized;
}

/**
 * Generates a random session ID
 * @param {number} length - The length of the session ID (default: 16)
 * @returns {string} A random session ID
 */
export function generateSessionId(length = 16) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

/**
 * Pauses execution for given milliseconds (can help with async tasks)
 * @param {number} ms - The number of milliseconds to sleep
 * @returns {Promise<void>} A promise that resolves after the specified time
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pick specific properties from a source object
 * @param {Object} source - The source object
 * @param {Array<string>} props - Array of property names to pick
 * @returns {Object} New object containing only the specified properties
 */
export function pickProperties(source, props) {
  return props.reduce((obj, key) => {
    obj[key] = source[key];
    return obj;
  }, {});
}

/**
 * Express middleware to validate session exists and attach it to request
 * @param {Object} sessionManager - The session manager instance
 * @returns {Function} Express middleware function
 */
export function validateSession(sessionManager) {
  return (req, res, next) => {
    const { sessionId } = req.params;
    const gameSession = sessionManager.getSession(sessionId);
    
    if (!gameSession) {
      return res.status(404).json({
        error: true,
        message: "Game session not found",
        session_id: sessionId
      });
    }
    
    // Attach session to request for use in route handlers
    req.gameSession = gameSession;
    next();
  };
}

/**
 * Express middleware to check if participant is playable (can perform game actions)
 * @param {Object} sessionManager - The session manager instance
 * @returns {Function} Express middleware function
 */
export function checkPlayableAccess(sessionManager) {
  return (req, res, next) => {
    const { sessionId } = req.params;
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ error: "participantId is required" });
    }

    const gameSession = sessionManager.getSession(sessionId);
    if (!gameSession) {
      return res.status(404).json({ error: "Game session not found." });
    }

    const participant = gameSession.getParticipantById(participantId);
    if (!participant) {
      return res.status(404).json({ error: "Participant not found." });
    }

    if (!gameSession.isParticipantPlayable(participant)) {
      return res.status(403).json({ error: "This participant cannot perform game actions." });
    }

    next();
  };
}

/**
 * Express middleware to validate that a participant exists in the session
 * @param {Object} sessionManager - The session manager instance
 * @returns {Function} Express middleware function
 */
export function validateParticipant(sessionManager) {
  return (req, res, next) => {
    const { sessionId } = req.params;
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ 
        error: true,
        message: "participantId is required",
        code: "MISSING_PARTICIPANT_ID"
      });
    }

    const gameSession = sessionManager.getSession(sessionId);
    if (!gameSession) {
      return res.status(400).json({ 
        error: true,
        message: "Game session not found",
        session_id: sessionId,
        code: "SESSION_NOT_FOUND"
      });
    }

    const participant = gameSession.getParticipantById(participantId);
    if (!participant) {
      return res.status(400).json({ 
        error: true,
        message: "Participant not found in session",
        participant_id: participantId,
        session_id: sessionId,
        code: "PARTICIPANT_NOT_FOUND"
      });
    }

    // Attach participant to request for use in route handlers
    req.participant = participant;
    next();
  };
}

/**
 * Express middleware to validate that a participant exists and is playable
 * @param {Object} sessionManager - The session manager instance
 * @returns {Function} Express middleware function
 */
export function validatePlayableParticipant(sessionManager) {
  return (req, res, next) => {
    const { sessionId } = req.params;
    const { participantId } = req.body;

    if (!participantId) {
      return res.status(400).json({ 
        error: true,
        message: "participantId is required",
        code: "MISSING_PARTICIPANT_ID"
      });
    }

    const gameSession = sessionManager.getSession(sessionId);
    if (!gameSession) {
      return res.status(400).json({ 
        error: true,
        message: "Game session not found",
        session_id: sessionId,
        code: "SESSION_NOT_FOUND"
      });
    }

    const participant = gameSession.getParticipantById(participantId);
    if (!participant) {
      return res.status(400).json({ 
        error: true,
        message: "Participant not found in session",
        participant_id: participantId,
        session_id: sessionId,
        code: "PARTICIPANT_NOT_FOUND"
      });
    }

    if (!gameSession.isParticipantPlayable(participant)) {
      return res.status(403).json({ 
        error: true,
        message: "This participant cannot perform game actions",
        participant_id: participantId,
        participant_type: participant.type,
        code: "PARTICIPANT_NOT_PLAYABLE"
      });
    }

    // Attach participant to request for use in route handlers
    req.participant = participant;
    next();
  };
}

/**
 * Utility function to shuffle an array using Fisher-Yates algorithm
 * @param {Array} array - The array to shuffle
 * @returns {Array} A new shuffled array
 */
export function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

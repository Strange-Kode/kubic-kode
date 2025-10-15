import crypto from "crypto";
import { kubicLog } from "../kubic-log.js";
import { 
  KubicSystemError, 
  KubicValidationError, 
  ErrorFactory,
  ErrorCodes 
} from "../game-engine/kubic-kode-error.js";

class GameTokenService {
  /**
   * Create a new game token service instance
   * @throws {Error} If secret key is not properly configured
   */
  constructor() {
    this.__secretKey = process.env.KUBIC_GAME_TOKEN_SECRET_KEY; // Required to be set in the .env file
    this.__algorithm = process.env.KUBIC_GAME_TOKEN_ALGORITHM || "aes-256-gcm";
    this.__ivLength = parseInt(process.env.KUBIC_GAME_TOKEN_IV_LENGTH) || 16;
    this.__saltLength = parseInt(process.env.KUBIC_GAME_TOKEN_SALT_LENGTH) || 64;
    
    // Validate secret key exists and length
    if (!this.__secretKey) {
        throw ErrorFactory.validation(
          "KUBIC_GAME_TOKEN_SECRET_KEY environment variable is not set. Please check your .env file or environment configuration.",
          "KUBIC_GAME_TOKEN_SECRET_KEY",
          undefined,
          { context: { 
            suggestion: "Add KUBIC_GAME_TOKEN_SECRET_KEY to your .env file with a key of at least 32 characters",
            envFile: ".env"
          }}
        );
    }
    
    if (this.__secretKey.length < 32) {
        throw ErrorFactory.validation(
          "Secret key length is too short. It must be at least 32 characters.",
          "KUBIC_GAME_TOKEN_SECRET_KEY",
          this.__secretKey,
          { context: { 
            currentLength: this.__secretKey.length,
            requiredLength: 32,
            suggestion: "Set KUBIC_GAME_TOKEN_SECRET_KEY environment variable with at least 32 characters"
          } }
        );
    }
  }

  get secretKey() {
    throw ErrorFactory.system(
      "Attempting to access secretKey property on GameTokenService. Not allowed, secretKey is a private property.",
      "GameTokenService",
      { context: { suggestion: "Use generateToken() or validateToken() methods instead", property: "secretKey" } }
    );
  }

  get algorithm() {
    throw ErrorFactory.system(
      "Attempting to access algorithm property on GameTokenService. Not allowed, algorithm is a private property.",
      "GameTokenService",
      { context: { suggestion: "Use generateToken() or validateToken() methods instead", property: "algorithm" } }
    );
  }

  get ivLength() {
    throw ErrorFactory.system(
      "Attempting to access ivLength property on GameTokenService. Not allowed, ivLength is a private property.",
      "GameTokenService",
      { context: { suggestion: "Use generateToken() or validateToken() methods instead", property: "ivLength" } }
    );
  }

  get saltLength() {
    throw ErrorFactory.system(
      "Attempting to access saltLength property on GameTokenService. Not allowed, saltLength is a private property.",
      "GameTokenService",
      { context: { suggestion: "Use generateToken() or validateToken() methods instead", property: "saltLength" } }
    );
  }

  /**
   * Generate a game token for a session
   * @param {string} sessionId - The session ID
   * @param {string} participantId - The participant ID (optional, for participant-specific tokens)
   * @returns {string} - Encrypted game token
   * @throws {Error} If token generation fails
   */
  generateToken(sessionId, participantId = null) {
    try {
      const tokenData = {
        sessionId,
        participantId,
        timestamp: Date.now(),
        nonce: crypto.randomBytes(16).toString("hex")
      };

      const tokenString = JSON.stringify(tokenData);
      const encryptedToken = this.encrypt(tokenString);
      
      kubicLog.debug(`[GameTokenService]::generateToken - Generated token for session: ${sessionId}, participant: ${participantId}`);
      return encryptedToken;
    } catch (error) {
      kubicLog.error("[GameTokenService]::generateToken - Error generating token:", error);
      throw ErrorFactory.system(
        "Failed to generate game token",
        "GameTokenService",
        { context: { method: "generateToken", sessionId, participantId, originalError: error.message } }
      );
    }
  }

  /**
   * Validate and decrypt a game token
   * @param {string} encryptedToken - The encrypted token
   * @returns {Object|null} - Decrypted token data or null if invalid
   */
  validateToken(encryptedToken) {
    try {
      const decryptedString = this.decrypt(encryptedToken);
      const tokenData = JSON.parse(decryptedString);
      
      // Basic validation
      if (!tokenData.sessionId || !tokenData.timestamp || !tokenData.nonce) {
        kubicLog.warn("[GameTokenService] Invalid token structure");
        return null;
      }

      // Check if token is not too old (24 hours)
      const tokenAge = Date.now() - tokenData.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      if (tokenAge > maxAge) {
        kubicLog.warn(`[GameTokenService]::validateToken - Token expired. Age: ${tokenAge}ms, Max: ${maxAge}ms`);
        return null;
      }

      kubicLog.debug(`[GameTokenService]::validateToken - Validated token for session: ${tokenData.sessionId}`);
      return tokenData;
    } catch (error) {
      kubicLog.error("[GameTokenService]::validateToken - Error validating token:", error);
      return null;
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {string} data - Data to encrypt
   * @returns {string} - Encrypted data as base64 string
   */
  encrypt(data) {
    const iv = crypto.randomBytes(this.__ivLength);
    const salt = crypto.randomBytes(this.__saltLength);
    
    // Derive key from secret and salt
    const key = crypto.pbkdf2Sync(this.__secretKey, salt, 100000, 32, "sha256");
    
    // Create cipher using proper Node.js crypto API with IV
    const cipher = crypto.createCipheriv(this.__algorithm, key, iv);
    
    // For GCM mode, set additional authenticated data
    if (this.__algorithm.includes('gcm')) {
      cipher.setAAD(salt);
    }
    
    // Encrypt data
    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    // Get auth tag for GCM mode, or create HMAC for other modes
    let authTag;
    if (this.__algorithm.includes('gcm')) {
      authTag = cipher.getAuthTag();
    } else {
      // Create HMAC for non-GCM modes
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(salt);
      hmac.update(iv);
      hmac.update(encrypted);
      authTag = hmac.digest();
    }
    
    // Combine all components: salt + iv + authTag + encrypted
    const combined = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, "hex")]);
    
    return combined.toString("base64");
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param {string} encryptedData - Encrypted data as base64 string
   * @returns {string} - Decrypted data
   */
  decrypt(encryptedData) {
    const combined = Buffer.from(encryptedData, "base64");
    
    // Extract components
    const salt = combined.subarray(0, this.__saltLength);
    const iv = combined.subarray(this.__saltLength, this.__saltLength + this.__ivLength);
    const authTag = combined.subarray(this.__saltLength + this.__ivLength, this.__saltLength + this.__ivLength + 16); // GCM auth tag is 16 bytes
    const encrypted = combined.subarray(this.__saltLength + this.__ivLength + 16);
    
    // Derive key from secret and salt
    const key = crypto.pbkdf2Sync(this.__secretKey, salt, 100000, 32, "sha256");
    
    // Create decipher using proper Node.js crypto API with IV
    const decipher = crypto.createDecipheriv(this.__algorithm, key, iv);
    
    if (this.__algorithm.includes('gcm')) {
      decipher.setAuthTag(authTag);
      decipher.setAAD(salt);
    } else {
      // Verify HMAC for non-GCM modes
      const hmac = crypto.createHmac('sha256', key);
      hmac.update(salt);
      hmac.update(iv);
      hmac.update(encrypted.toString('hex'));
      const computedAuthTag = hmac.digest();
      
      if (!crypto.timingSafeEqual(authTag, computedAuthTag)) {
        throw new Error("Authentication tag verification failed");
      }
    }
    
    // Decrypt data
    let decrypted = decipher.update(encrypted, null, "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  }

  /**
   * Check if a token is valid for a specific session
   * @param {string} encryptedToken - The encrypted token
   * @param {string} sessionId - The session ID to validate against
   * @param {string} participantId - The participant ID to validate against (optional)
   * @returns {boolean} - True if token is valid for the session
   */
  isTokenValidForSession(encryptedToken, sessionId, participantId = null) {
    const tokenData = this.validateToken(encryptedToken);
    if (!tokenData) {
      return false;
    }

    if (tokenData.sessionId !== sessionId) {
      kubicLog.warn(`[GameTokenService]::isTokenValidForSession - Token session mismatch. Expected: ${sessionId}, Got: ${tokenData.sessionId}`);
      return false;
    }

    if (participantId && tokenData.participantId && tokenData.participantId !== participantId) {
      kubicLog.warn(`[GameTokenService]::isTokenValidForSession - Token participant mismatch. Expected: ${participantId}, Got: ${tokenData.participantId}`);
      return false;
    }

    return true;
  }
}

// Lazy instantiation to avoid issues with environment variables not being loaded
let _gameTokenService = null;

/**
 * Game token service singleton with lazy instantiation
 */
export const gameTokenService = {
  /**
   * Get the game token service instance
   * @returns {GameTokenService} The game token service instance
   */
  get instance() {
    if (!_gameTokenService) {
      _gameTokenService = new GameTokenService();
    }
    return _gameTokenService;
  }
};

import crypto from "crypto";
import { kubicLog } from "../kubic-log.js";
import { 
  KubicSystemError, 
  KubicValidationError, 
  ErrorFactory,
  ErrorCodes 
} from "../game-engine/kubic-kode-error.js";

const MAX_TOKEN_LENGTH = 512;
// GCM with one shared key needs a nonce wide enough that random IVs never repeat,
// and a wide IV would push every real token past MAX_TOKEN_LENGTH
const MIN_IV_LENGTH = 12;
const MAX_IV_LENGTH = 32;

class GameTokenService {
  /**
   * Create a new game token service instance
   * @throws {Error} If secret key is not properly configured
   */
  constructor() {
    this.__secretKey = process.env.KUBIC_GAME_TOKEN_SECRET_KEY; // Required to be set in the .env file
    this.__algorithm = process.env.KUBIC_GAME_TOKEN_ALGORITHM || "aes-256-gcm";
    this.__ivLength = parseInt(process.env.KUBIC_GAME_TOKEN_IV_LENGTH) || 16;
    if (this.__ivLength < MIN_IV_LENGTH || this.__ivLength > MAX_IV_LENGTH) {
      throw ErrorFactory.validation(
        `KUBIC_GAME_TOKEN_IV_LENGTH must be between ${MIN_IV_LENGTH} and ${MAX_IV_LENGTH} bytes.`,
        "KUBIC_GAME_TOKEN_IV_LENGTH",
        this.__ivLength
      );
    }
    
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

    // Derived once: tokens are validated for every request, so a per-token
    // password-hash KDF would let anyone with junk tokens stall the event loop.
    this.__key = Buffer.from(
      crypto.hkdfSync("sha256", this.__secretKey, "kubic-game-token", "aes-256-gcm v1", 32)
    );
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
      // A real token is about 230 characters; decrypt time grows with input
      // length, so oversized junk must be refused before it is decoded
      if (typeof encryptedToken !== "string" || encryptedToken.length > MAX_TOKEN_LENGTH) {
        return null;
      }
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
      kubicLog.debug("[GameTokenService]::validateToken - Rejected token:", error.message);
      return null;
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {string} data - Data to encrypt
   * @returns {string} - Base64 of iv + authTag (16 bytes) + ciphertext
   */
  encrypt(data) {
    const iv = crypto.randomBytes(this.__ivLength);
    const cipher = crypto.createCipheriv(this.__algorithm, this.__key, iv);

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");

    // Get auth tag for GCM mode, or create HMAC for other modes
    let authTag;
    if (this.__algorithm.includes('gcm')) {
      authTag = cipher.getAuthTag();
    } else {
      const hmac = crypto.createHmac('sha256', this.__key);
      hmac.update(iv);
      hmac.update(encrypted);
      authTag = hmac.digest();
    }

    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, "hex")]);

    return combined.toString("base64");
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param {string} encryptedData - Base64 of iv + authTag (16 bytes) + ciphertext
   * @returns {string} - Decrypted data
   */
  decrypt(encryptedData) {
    const combined = Buffer.from(encryptedData, "base64");

    const minimumLength = this.__ivLength + 16 + 1;
    if (combined.length < minimumLength) {
      throw new Error("Encrypted payload too short");
    }

    const iv = combined.subarray(0, this.__ivLength);
    const authTag = combined.subarray(this.__ivLength, this.__ivLength + 16); // GCM auth tag is 16 bytes
    const encrypted = combined.subarray(this.__ivLength + 16);

    const decipher = crypto.createDecipheriv(this.__algorithm, this.__key, iv);

    if (this.__algorithm.includes('gcm')) {
      decipher.setAuthTag(authTag);
    } else {
      // Verify HMAC for non-GCM modes
      const hmac = crypto.createHmac('sha256', this.__key);
      hmac.update(iv);
      hmac.update(encrypted.toString('hex'));
      const computedAuthTag = hmac.digest();

      if (!crypto.timingSafeEqual(authTag, computedAuthTag)) {
        throw new Error("Authentication tag verification failed");
      }
    }

    let decrypted = decipher.update(encrypted, null, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
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

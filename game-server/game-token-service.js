import crypto from 'crypto';
import { kubicLog } from '../kubic-log.js';

class GameTokenService {
  constructor() {
    this.secretKey = process.env.KUBIC_GAME_TOKEN_SECRET_KEY; // Required to be set in the .env file
    this.algorithm = process.env.KUBIC_GAME_TOKEN_ALGORITHM || 'aes-256-gcm';
    this.ivLength = parseInt(process.env.KUBIC_GAME_TOKEN_IV_LENGTH) || 16;
    this.saltLength = parseInt(process.env.KUBIC_GAME_TOKEN_SALT_LENGTH) || 64;
    
    // Validate secret key length
    if (this.secretKey.length < 32) {
        throw new Error('Secret key length is too short. It must be at least 32 characters.');
    }
  }

  /**
   * Generate a game token for a session
   * @param {string} sessionId - The session ID
   * @param {string} participantId - The participant ID (optional, for participant-specific tokens)
   * @returns {string} - Encrypted game token
   */
  generateToken(sessionId, participantId = null) {
    try {
      const tokenData = {
        sessionId,
        participantId,
        timestamp: Date.now(),
        nonce: crypto.randomBytes(16).toString('hex')
      };

      const tokenString = JSON.stringify(tokenData);
      const encryptedToken = this.encrypt(tokenString);
      
      kubicLog.debug(`[GameTokenService]::generateToken - Generated token for session: ${sessionId}, participant: ${participantId}`);
      return encryptedToken;
    } catch (error) {
      kubicLog.error('[GameTokenService]::generateToken - Error generating token:', error);
      throw new Error('Failed to generate game token');
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
        kubicLog.warn('[GameTokenService] Invalid token structure');
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
      kubicLog.error('[GameTokenService]::validateToken - Error validating token:', error);
      return null;
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   * @param {string} data - Data to encrypt
   * @returns {string} - Encrypted data as base64 string
   */
  encrypt(data) {
    const iv = crypto.randomBytes(this.ivLength);
    const salt = crypto.randomBytes(this.saltLength);
    
    // Derive key from secret and salt
    const key = crypto.pbkdf2Sync(this.secretKey, salt, 100000, 32, 'sha256');
    
    // Create cipher
    const cipher = crypto.createCipher(this.algorithm, key);
    cipher.setAAD(salt);
    
    // Encrypt data
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine all components: salt + iv + authTag + encrypted
    const combined = Buffer.concat([salt, iv, authTag, Buffer.from(encrypted, 'hex')]);
    
    return combined.toString('base64');
  }

  /**
   * Decrypt data using AES-256-GCM
   * @param {string} encryptedData - Encrypted data as base64 string
   * @returns {string} - Decrypted data
   */
  decrypt(encryptedData) {
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const salt = combined.subarray(0, this.saltLength);
    // const iv = combined.subarray(this.saltLength, this.saltLength + this.ivLength);
    const authTag = combined.subarray(this.saltLength + this.ivLength, this.saltLength + this.ivLength + 16);
    const encrypted = combined.subarray(this.saltLength + this.ivLength + 16);
    
    // Derive key from secret and salt
    const key = crypto.pbkdf2Sync(this.secretKey, salt, 100000, 32, 'sha256');
    
    // Create decipher
    const decipher = crypto.createDecipher(this.algorithm, key);
    decipher.setAuthTag(authTag);
    decipher.setAAD(salt);
    
    // Decrypt data
    let decrypted = decipher.update(encrypted, null, 'utf8');
    decrypted += decipher.final('utf8');
    
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

export const gameTokenService = {
  get instance() {
    if (!_gameTokenService) {
      _gameTokenService = new GameTokenService();
    }
    return _gameTokenService;
  }
};

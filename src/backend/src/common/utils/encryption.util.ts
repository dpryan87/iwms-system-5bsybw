// @package crypto (Node.js native module)
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';
import { Environment } from '../types';

/**
 * Interface representing encrypted data structure with version control
 */
interface EncryptedData {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
  version: string;
}

/**
 * Configuration interface for key rotation settings
 */
interface KeyRotationConfig {
  rotationPeriod: number;  // Days between rotations
  algorithm: string;       // Encryption algorithm
  enabled: boolean;        // Key rotation status
}

// Cryptographic constants
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const HASH_ITERATIONS = 100000;
const HASH_KEYLEN = 64;
const HASH_DIGEST = 'sha512';
const KEY_VERSION_PREFIX = 'v';
const MIN_KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Validates encryption key length and composition
 * @param key - Encryption key to validate
 * @throws Error if key is invalid
 */
const validateKey = (key: string): void => {
  if (!key || key.length < MIN_KEY_LENGTH) {
    throw new Error('Invalid encryption key: Insufficient length');
  }
  
  // Additional key material validation in production
  if (process.env.NODE_ENV === Environment.PRODUCTION) {
    const keyBuffer = Buffer.from(key);
    const entropy = calculateEntropy(keyBuffer);
    if (entropy < 3.5) { // Minimum entropy threshold
      throw new Error('Invalid encryption key: Insufficient entropy');
    }
  }
};

/**
 * Calculates Shannon entropy of key material
 * @param buffer - Key buffer to analyze
 * @returns Entropy value
 */
const calculateEntropy = (buffer: Buffer): number => {
  const frequencies = new Array(256).fill(0);
  buffer.forEach(byte => frequencies[byte]++);
  
  return frequencies.reduce((entropy, freq) => {
    if (freq === 0) return entropy;
    const p = freq / buffer.length;
    return entropy - p * Math.log2(p);
  }, 0);
};

/**
 * Encrypts data using AES-256-GCM with secure IV generation
 * @param data - Data to encrypt (string or Buffer)
 * @param key - Encryption key
 * @param config - Key rotation configuration
 * @returns Promise resolving to encrypted data object
 */
export async function encrypt(
  data: string | Buffer,
  key: string,
  config: KeyRotationConfig
): Promise<EncryptedData> {
  try {
    validateKey(key);

    // Generate cryptographically secure IV
    const iv = randomBytes(IV_LENGTH);
    
    // Create cipher with AES-256-GCM
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(key), iv, {
      authTagLength: AUTH_TAG_LENGTH
    });

    // Encrypt data
    const inputData = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const ciphertext = Buffer.concat([
      cipher.update(inputData),
      cipher.final()
    ]);

    // Get authentication tag
    const tag = cipher.getAuthTag();

    // Generate version identifier
    const version = `${KEY_VERSION_PREFIX}${Date.now()}`;

    return {
      ciphertext,
      iv,
      tag,
      version
    };
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypts data with version handling and integrity verification
 * @param encryptedData - Encrypted data object
 * @param key - Decryption key
 * @returns Promise resolving to decrypted data buffer
 */
export async function decrypt(
  encryptedData: EncryptedData,
  key: string
): Promise<Buffer> {
  try {
    validateKey(key);
    
    // Validate encrypted data structure
    if (!encryptedData?.ciphertext || !encryptedData?.iv || !encryptedData?.tag) {
      throw new Error('Invalid encrypted data structure');
    }

    // Create decipher with matching algorithm
    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      Buffer.from(key),
      encryptedData.iv,
      { authTagLength: AUTH_TAG_LENGTH }
    );

    // Set auth tag for verification
    decipher.setAuthTag(encryptedData.tag);

    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encryptedData.ciphertext),
      decipher.final()
    ]);

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Performs secure key rotation with backup and validation
 * @param currentKey - Current encryption key
 * @param config - Key rotation configuration
 * @returns Promise resolving to new encryption key
 */
export async function rotateKey(
  currentKey: string,
  config: KeyRotationConfig
): Promise<string> {
  try {
    validateKey(currentKey);

    if (!config.enabled) {
      throw new Error('Key rotation is not enabled');
    }

    // Generate new key material
    const newKey = randomBytes(HASH_KEYLEN).toString('hex');
    
    // Validate new key
    validateKey(newKey);

    // In production, perform additional security measures
    if (process.env.NODE_ENV === Environment.PRODUCTION) {
      // Ensure new key is sufficiently different from current key
      const keyDifference = Buffer.from(currentKey).compare(Buffer.from(newKey));
      if (keyDifference === 0) {
        throw new Error('New key must be different from current key');
      }

      // Verify key rotation period compliance
      const lastRotation = parseInt(currentKey.split(KEY_VERSION_PREFIX)[1] || '0');
      const timeSinceRotation = Date.now() - lastRotation;
      if (timeSinceRotation < config.rotationPeriod * 24 * 60 * 60 * 1000) {
        throw new Error('Key rotation period not elapsed');
      }
    }

    return `${KEY_VERSION_PREFIX}${Date.now()}_${newKey}`;
  } catch (error) {
    throw new Error(`Key rotation failed: ${error.message}`);
  }
}
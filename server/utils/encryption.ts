import CryptoJS from 'crypto-js';

// Encryption key from environment variable
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || (() => {
  throw new Error('ENCRYPTION_KEY environment variable is required for PII encryption');
})();

export class PIIEncryption {
  /**
   * Encrypt sensitive data using AES encryption
   */
  static encrypt(plaintext: string | null | undefined): string | null {
    if (!plaintext) return null;
    
    try {
      const encrypted = CryptoJS.AES.encrypt(plaintext, ENCRYPTION_KEY).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt PII data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedText: string | null | undefined): string | null {
    if (!encryptedText) return null;
    
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
      const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!plaintext) {
        throw new Error('Failed to decrypt - invalid key or corrupted data');
      }
      
      return plaintext;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt PII data');
    }
  }

  /**
   * Encrypt user PII fields
   */
  static encryptUserPII(user: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
  }) {
    return {
      ...user,
      email: user.email ? this.encrypt(user.email) : null,
      firstName: user.firstName ? this.encrypt(user.firstName) : null,
      lastName: user.lastName ? this.encrypt(user.lastName) : null,
      profileImageUrl: user.profileImageUrl ? this.encrypt(user.profileImageUrl) : null,
    };
  }

  /**
   * Decrypt user PII fields
   */
  static decryptUserPII(user: {
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
  }) {
    return {
      ...user,
      email: user.email ? this.decrypt(user.email) : null,
      firstName: user.firstName ? this.decrypt(user.firstName) : null,
      lastName: user.lastName ? this.decrypt(user.lastName) : null,
      profileImageUrl: user.profileImageUrl ? this.decrypt(user.profileImageUrl) : null,
    };
  }

  /**
   * Encrypt student PII fields
   */
  static encryptStudentPII(student: {
    name?: string;
    email?: string | null;
  }) {
    return {
      ...student,
      name: student.name ? this.encrypt(student.name) : student.name,
      email: student.email ? this.encrypt(student.email) : null,
    };
  }

  /**
   * Decrypt student PII fields
   */
  static decryptStudentPII(student: {
    name?: string;
    email?: string | null;
  }) {
    return {
      ...student,
      name: student.name ? this.decrypt(student.name) : student.name,
      email: student.email ? this.decrypt(student.email) : null,
    };
  }
}
/**
 * @purpose Gestiona la cifrado y descifrado de datos sensibles utilizando AES-256-CBC con una clave secreta segura.
 * @purpose_en Manages encryption and decryption of sensitive data using AES-256-CBC with a secure secret key.
 * @refactorable false
 * @classification Helper Utility
 * @complexity Low
 * @fingerprint exports:1,imports:1,sig:1yt2931
 * @lastUpdated 2026-06-23T23:25:49.255Z
 */

import crypto from 'crypto';

// Se utiliza la clave configurada en .env.local, con fallback seguro para desarrollo local
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET;

export class SecurityService {
  private static getSecret() {
    if (!ENCRYPTION_SECRET) {
      throw new Error('ENCRYPTION_SECRET no está definida en las variables de entorno.');
    }
    return crypto.scryptSync(ENCRYPTION_SECRET, 'salt', 32);
  }

  /**
   * Cifra un texto utilizando AES-256-CBC de forma segura con un Vector de Inicialización (IV) aleatorio
   */
  static encrypt(text: string): string {
    if (!text) return '';
    try {
      const iv = crypto.randomBytes(16);
      const key = this.getSecret();
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (e) {
      console.error('❌ Fallo al cifrar campo sensible:', e);
      return text;
    }
  }

  /**
   * Descifra un texto previamente cifrado. Si no está en formato cifrado (no contiene el separador ':'), lo devuelve tal cual.
   */
  static decrypt(encryptedText: string): string {
    if (!encryptedText) return '';
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 2) return encryptedText; // No cifrado o formato antiguo
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const key = this.getSecret();
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      console.error('❌ Fallo al descifrar campo sensible:', e);
      return encryptedText;
    }
  }
}

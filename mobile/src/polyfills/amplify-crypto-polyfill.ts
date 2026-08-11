/**
 * Polyfill for Amplify's native crypto functions required for SRP authentication
 * This provides JavaScript implementations for Expo Go compatibility
 */

import { BigInteger } from 'jsbn';

// Polyfill for computeModPow - modular exponentiation
// This is used by Amplify's SRP flow for password-based authentication
export function computeModPow(base: string, exponent: string, modulus: string): string {
  try {
    const baseBigInt = new BigInteger(base, 16);
    const exponentBigInt = new BigInteger(exponent, 16);
    const modulusBigInt = new BigInteger(modulus, 16);
    
    // Compute base^exponent mod modulus
    const result = baseBigInt.modPow(exponentBigInt, modulusBigInt);
    
    // Return as hex string (remove leading 0x if present)
    let hexResult = result.toString(16);
    // Ensure even length (pad with leading zero if needed)
    if (hexResult.length % 2 !== 0) {
      hexResult = '0' + hexResult;
    }
    return hexResult;
  } catch (e) {
    console.error('computeModPow polyfill error:', e);
    throw new Error('Failed to compute modular exponentiation');
  }
}

// Polyfill for computeModPowInverse - modular multiplicative inverse
export function computeModPowInverse(value: string, modulus: string): string {
  try {
    const valueBigInt = new BigInteger(value, 16);
    const modulusBigInt = new BigInteger(modulus, 16);
    
    // Compute modular inverse using extended Euclidean algorithm
    const result = valueBigInt.modInverse(modulusBigInt);
    
    let hexResult = result.toString(16);
    if (hexResult.length % 2 !== 0) {
      hexResult = '0' + hexResult;
    }
    return hexResult;
  } catch (e) {
    console.error('computeModPowInverse polyfill error:', e);
    throw new Error('Failed to compute modular inverse');
  }
}

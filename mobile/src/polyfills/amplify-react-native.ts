// Polyfill for @aws-amplify/react-native in Expo Go
// This provides JavaScript implementations of native crypto functions

import { BigInteger } from 'jsbn';

// Polyfill computeModPow - used for SRP calculations
export function computeModPow(base: string, exponent: string, modulus: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const baseBig = new BigInteger(base, 16);
      const expBig = new BigInteger(exponent, 16);
      const modBig = new BigInteger(modulus, 16);
      
      const result = baseBig.modPow(expBig, modBig);
      resolve(result.toString(16));
    } catch (error) {
      reject(error);
    }
  });
}

// Polyfill loadGetRandomValues - already handled by react-native-get-random-values
export function loadGetRandomValues() {
  // No-op - react-native-get-random-values already polyfills this
}

// Polyfill loadBase64 - base64 encoding/decoding
// This function MUST return { encode, decode } for Amplify to work
export function loadBase64() {
  // Ensure btoa/atob exist globally first
  if (typeof global !== 'undefined') {
    if (typeof global.btoa === 'undefined') {
      // Polyfill btoa (base64 encode)
      global.btoa = (str: string) => {
        try {
          const { Buffer } = require('buffer');
          return Buffer.from(str, 'binary').toString('base64');
        } catch (e) {
          // Fallback for environments without Buffer
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
          let output = '';
          for (let i = 0; i < str.length; i += 3) {
            const a = str.charCodeAt(i);
            const b = str.charCodeAt(i + 1) || 0;
            const c = str.charCodeAt(i + 2) || 0;
            const bitmap = (a << 16) | (b << 8) | c;
            output += chars.charAt((bitmap >> 18) & 63);
            output += chars.charAt((bitmap >> 12) & 63);
            output += i + 1 < str.length ? chars.charAt((bitmap >> 6) & 63) : '=';
            output += i + 2 < str.length ? chars.charAt(bitmap & 63) : '=';
          }
          return output;
        }
      };
    }
    if (typeof global.atob === 'undefined') {
      // Polyfill atob (base64 decode)
      global.atob = (str: string) => {
        try {
          const { Buffer } = require('buffer');
          return Buffer.from(str, 'base64').toString('binary');
        } catch (e) {
          // Fallback for environments without Buffer
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
          str = str.replace(/[^A-Za-z0-9\+\/\=]/g, '');
          let output = '';
          for (let i = 0; i < str.length; i += 4) {
            const enc1 = chars.indexOf(str.charAt(i));
            const enc2 = chars.indexOf(str.charAt(i + 1));
            const enc3 = chars.indexOf(str.charAt(i + 2));
            const enc4 = chars.indexOf(str.charAt(i + 3));
            const bitmap = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4;
            if (enc3 !== 64) output += String.fromCharCode((bitmap >> 16) & 255);
            if (enc4 !== 64) output += String.fromCharCode((bitmap >> 8) & 255);
            output += String.fromCharCode(bitmap & 255);
          }
          return output;
        }
      };
    }
  }

  // CRITICAL: Return { encode, decode } as Amplify expects
  const encode = (input: string): string => {
    return (global.btoa || globalThis.btoa || ((s: string) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let output = '';
      for (let i = 0; i < s.length; i += 3) {
        const a = s.charCodeAt(i);
        const b = s.charCodeAt(i + 1) || 0;
        const c = s.charCodeAt(i + 2) || 0;
        const bitmap = (a << 16) | (b << 8) | c;
        output += chars.charAt((bitmap >> 18) & 63);
        output += chars.charAt((bitmap >> 12) & 63);
        output += i + 1 < s.length ? chars.charAt((bitmap >> 6) & 63) : '=';
        output += i + 2 < s.length ? chars.charAt(bitmap & 63) : '=';
      }
      return output;
    }))(input);
  };

  const decode = (input: string): string => {
    return (global.atob || globalThis.atob || ((s: string) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      s = s.replace(/[^A-Za-z0-9\+\/\=]/g, '');
      let output = '';
      for (let i = 0; i < s.length; i += 4) {
        const enc1 = chars.indexOf(s.charAt(i));
        const enc2 = chars.indexOf(s.charAt(i + 1));
        const enc3 = chars.indexOf(s.charAt(i + 2));
        const enc4 = chars.indexOf(s.charAt(i + 3));
        const bitmap = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4;
        if (enc3 !== 64) output += String.fromCharCode((bitmap >> 16) & 255);
        if (enc4 !== 64) output += String.fromCharCode((bitmap >> 8) & 255);
        output += String.fromCharCode(bitmap & 255);
      }
      return output;
    }))(input);
  };

  return { encode, decode };
}

// Additional functions that might be needed
export function getRandomBytes(length: number): Uint8Array {
  const array = new Uint8Array(length);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return array;
}

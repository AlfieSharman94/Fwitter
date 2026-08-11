// This file must be imported FIRST, before any aws-amplify imports
// It sets up all necessary polyfills for Expo Go

console.log("POLYFILLS start");
console.log("Before set TextEncoder:", typeof global.TextEncoder);

import 'react-native-get-random-values';

// Polyfill TextEncoder/TextDecoder (required by Amplify v6)
import { TextEncoder, TextDecoder } from 'text-encoding';

if (typeof global !== 'undefined') {
  global.TextEncoder = global.TextEncoder || (TextEncoder as any);
  global.TextDecoder = global.TextDecoder || (TextDecoder as any);
  console.log("After set TextEncoder:", typeof global.TextEncoder);
  console.log("TextEncoder exists:", !!global.TextEncoder);
}

// Set up base64 encoding/decoding immediately (before Amplify tries to use it)
if (typeof global !== 'undefined') {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  
  if (typeof global.btoa === 'undefined') {
    // Polyfill btoa (base64 encode)
    global.btoa = (str: string) => {
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
    };
  }
  
  if (typeof global.atob === 'undefined') {
    // Polyfill atob (base64 decode)
    global.atob = (str: string) => {
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
    };
  }
}

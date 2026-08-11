# Project Context — Fwitter

## Overview
Fwitter is a mobile-first social app focused on football discussion
(teams, topics, replies, feeds).

## Tech Stack
Backend:
- NestJS
- PostgreSQL (Docker)
- Prisma
- AWS Cognito (User Pool auth, JWT)

Mobile:
- Expo (Expo Router, app/ directory)
- Fetch-based API client (temporary dev token)

## Authentication
- Cognito User Pool in eu-north-1
- ID tokens validated via JWKS in NestJS
- API returns 401 for unauthenticated requests
- /users/me works correctly with Bearer token

## Backend Status (Working)
- Users + onboarding
- Teams & topics seeded
- Posts + replies
- Feed endpoints:
  - GET /feed/12th-man
  - GET /feed/squad
- Follow schema exists (not fully wired to UI yet)

## Mobile App Status
- App runs on physical device via Expo
- Home tab fetches 12th-man feed successfully
- API reachable at http://192.168.0.36:3000
- Dev token currently hardcoded (expires hourly)

## Known Issues
- Dev token expires → app breaks
- Need proper login flow in app

## Next Steps (Agreed)
1. Replace dev token with real login using AWS Amplify Auth
2. Store tokens securely (Expo SecureStore)
3. Implement follow flow → unlock Squad feed
4. Post composer UI
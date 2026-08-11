You’re helping me build Fwitter (football social app). The repo has 3 context docs at the project root:

1) dev.md — overall status + stack + what’s working
2) api_routes.md — current API endpoints (NestJS)
3) DB_schema.md — Postgres schema summary

Please treat those files as the source of truth and use them as context.

Current status:
- Backend (NestJS + Prisma + Postgres + Cognito) is working.
- API reachable locally and on LAN (phone) at http://192.168.0.36:3000.
- JWT auth is working and missing auth now returns 401 (not 500) due to a custom JwtAuthGuard.
- Posts and 12th-man feed work; replies work.
- Mobile is Expo Router (mobile/app/...), currently using a temporary dev token to fetch feed.

Goal for this chat:
Implement proper Cognito login in the Expo app (no more hardcoded token), store tokens securely, and use them for API calls.

Constraints / preferences:
- App-only (mobile), Expo Router.
- AWS Cognito already set up (eu-north-1).
- Use Expo SecureStore for token storage.
- Keep implementation minimal + production-lean (no overengineering).

What I want from you:
1) Step-by-step file changes for Expo Router:
   - Auth screens (Sign in, optional Sign up)
   - Token storage with SecureStore
   - A fetch wrapper that attaches Authorization: Bearer <idToken>
2) A clear “run/test checklist” to confirm it works on my phone.
3) If a choice exists (Amplify vs amazon-cognito-identity-js), recommend one and proceed.

Before coding, briefly summarize what you infer from the docs and what you’ll implement next.

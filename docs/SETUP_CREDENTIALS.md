# Credentials and third-party setup

Everything below is a one-off. Each section says what it unlocks, where to get the value, and where it goes. Replace `fwitter-media` with the bucket name you choose and `<api-domain>` with your Railway domain.

## 1. Railway (where the API runs)

**Find the API's public URL.** Railway → your project → the API service → Settings → Networking → Public Networking. If there is no domain, click Generate Domain. That URL goes in three places: `mobile/.env` (`EXPO_PUBLIC_API_BASE_URL`), `mobile/eas.json` (the `development` and `preview` profiles) and the EAS `production` environment variable of the same name.

**Variables tab.** The API reads these (see `api/.env.example`):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Reference to the Postgres plugin (`${{Postgres.DATABASE_URL}}`) |
| `AWS_REGION` | `eu-north-1` (the Cognito region) |
| `COGNITO_USER_POOL_ID`, `COGNITO_APP_CLIENT_ID` | Same values as the mobile app |
| `ADMIN_EMAILS` | Comma-separated emails that become admins on the next deploy |
| `VITE_AWS_REGION`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_USER_POOL_CLIENT_ID` | Same Cognito values; used when the moderation dashboard is built |
| `FOOTBALL_DATA_TOKEN` | Section 2 |
| `S3_BUCKET`, `MEDIA_AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Section 3 |
| `MEDIA_PUBLIC_BASE_URL`, `REKOGNITION_BLOCK` | Optional, section 3 |

Railway redeploys when variables change. Check with `https://<api-domain>/teams/search?q=inter` (JSON) and `https://<api-domain>/moderation` (dashboard login page).

## 2. football-data.org token (fixtures and scores)

1. Register at https://www.football-data.org/client/register with your email. The token arrives by email within a minute; the free tier needs no card.
2. Railway: `FOOTBALL_DATA_TOKEN=<token>`.

Free tier: 10 requests a minute, 12 competitions (Premier League, Championship, Ligue 1, Bundesliga, Serie A, La Liga, Primeira Liga, Eredivisie, Champions League and a few more), scores delayed. The "Standard" tier (about 12 euros a month) adds live scores and more competitions. Nothing changes in the app; the sync starts on the next deploy and the API log stops saying "FOOTBALL_DATA_TOKEN not set".

## 3. S3 bucket and IAM keys (photos in posts and avatars)

Rekognition, which scans every upload, has no endpoint in `eu-north-1`, and it can only read objects from a bucket in its own region. So the bucket lives in **eu-west-2 (London)** and the API is told that through `MEDIA_AWS_REGION`. Cognito stays in `eu-north-1`.

**Bucket.** AWS console → S3 → Create bucket:
- Name `fwitter-media` (must be globally unique, so add a suffix if taken), region **eu-west-2**.
- Object Ownership: ACLs disabled.
- Block Public Access: leave the two ACL boxes ticked, untick the two "public bucket or access point policies" boxes, and acknowledge. Images are served straight from the bucket, so reads must be public.
- Encryption: SSE-S3. Create.
- Then Permissions → Bucket policy → paste, replacing the bucket name:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadUploads",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::fwitter-media/uploads/*"
    }
  ]
}
```

**IAM user and keys.** IAM → Users → Create user `fwitter-api`, no console access → Attach policies directly → Create policy → JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::fwitter-media/uploads/*"
    },
    {
      "Effect": "Allow",
      "Action": "rekognition:DetectModerationLabels",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["cognito-idp:ListUsers", "cognito-idp:AdminDeleteUser"],
      "Resource": "arn:aws:cognito-idp:eu-north-1:*:userpool/eu-north-1_f8sV2Qsf0"
    }
  ]
}
```

The Cognito statement lets the sign-up email check see logins that have no profile yet (`ListUsers`) and lets a guardian's decline remove the login (`AdminDeleteUser`). Replace the `*` with your 12-digit AWS account id if you prefer an exact ARN.

Name it `FwitterMediaAccess`, attach it, finish creating the user. Open the user → Security credentials → Access keys → Create access key → "Application running outside AWS" → copy the key id and secret (the secret is shown once).

**Railway:** `S3_BUCKET=fwitter-media`, `MEDIA_AWS_REGION=eu-west-2`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. Optional later: `MEDIA_PUBLIC_BASE_URL` once a CloudFront distribution sits in front of the bucket, and `REKOGNITION_BLOCK` to change which image categories are rejected (the default also rejects alcohol, tobacco and gambling imagery, which can catch sponsor logos).

Cost: Rekognition is about 1 US dollar per 1,000 images (5,000 a month free for the first year of a new AWS account); S3 is pennies at this scale. Set a billing alarm in AWS Budgets.

## 4. iOS push (APNs key, via EAS)

Needs the Apple Developer Program (99 US dollars a year) with the bundle id `com.ajs94x.mobile`. The EAS account is already logged in on this machine (`eas whoami` → `ajs94x`).

```bash
cd mobile && eas credentials --platform ios
```

Pick the `production` profile → "Push Notifications: Manage your Apple Push Notifications Key" → "Set up a new push key" → sign in with the Apple ID when asked. Expo creates the key, stores it, and uses it for every build of this app. Push only reaches physical devices, never the simulator.

## 5. Android push (Firebase)

The app side is already configured: `app.json` points at `./google-services.json`, the `expo-notifications` plugin sets the icon and colour, and `package.json` has an `eas-build-pre-install` hook that fetches the file on EAS builds. What is left is the Firebase project and two files.

1. **Project:** https://console.firebase.google.com → Add project → name `Fwitter` → turn Google Analytics off → Create.
2. **Android app:** Project overview → Add app → Android → package name `com.ajs94x.mobile` → Register app → Download `google-services.json` → save it as `mobile/google-services.json`. It is gitignored; it is not a secret, but it does not belong in a public repo.
3. **FCM service account:** Project settings (gear) → Service accounts → Generate new private key → a JSON file downloads. Keep it private.
4. **Give it to Expo:**
   ```bash
   cd mobile && eas credentials --platform android
   ```
   Pick `production` → "Google Service Account" → "Manage your Google Service Account Key for Push Notifications (FCM V1)" → "Set up a Google Service Account Key for Push Notifications (FCM V1)" → choose the JSON from step 3.
5. **Give EAS the config file** so cloud builds can include it (run once per environment):
   ```bash
   cd mobile && eas env:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment production
   ```
   Repeat with `--environment preview` and `--environment development`. Local builds (`npx expo run:android`) read the file directly.
6. Make a new Android development build and test on a real device.

If the Firebase CLI on this machine is signed in (`firebase login --reauth`; it currently holds an expired login for the Google account), steps 1 and 2 can be done from the terminal instead:

```bash
firebase projects:create fwitter-app --display-name Fwitter
firebase apps:create ANDROID "Fwitter Android" --package-name com.ajs94x.mobile --project fwitter-app
firebase apps:sdkconfig ANDROID <appId from the previous command> --project fwitter-app > mobile/google-services.json
```

Step 3 always needs the console.

## 6. EAS environment variables (the app itself)

The `development` and `preview` profiles carry their values in `eas.json`. The `production` profile reads them from the EAS dashboard (project → Environment variables): `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_AWS_REGION`, `EXPO_PUBLIC_COGNITO_USER_POOL_ID`, `EXPO_PUBLIC_COGNITO_USER_POOL_CLIENT_ID`.

## 7. Moderation dashboard sign-in

Put your email in `ADMIN_EMAILS` on Railway, wait for the redeploy (the seed promotes the account), then open `https://<api-domain>/moderation` and sign in with that account's normal Fwitter email and password.

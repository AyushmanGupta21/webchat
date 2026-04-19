# Full Stack Realtime Chat App (Next.js)

![Demo App](/public/screenshot-for-readme.png)

Highlights:

- Next.js app router for frontend and API routes
- JWT authentication with httpOnly cookies
- Email/password authentication flow (signup, login, and password reset)
- Realtime messaging + online presence with Pusher Channels (Vercel-compatible)
- Neon PostgreSQL
- Client-side encrypted media uploads (AES-GCM) before Cloudinary storage
- Zustand state management
- TailwindCSS + DaisyUI styling

## Project Structure

```text
.
|-- src/
|   |-- app/                    # Next.js app router pages + API routes
|   |-- components/             # Shared UI components by domain
|   |   |-- auth/
|   |   |-- chat/
|   |   |-- common/
|   |   `-- layout/
|   |-- constants/              # App constants
|   |-- features/               # Feature-first pages and modules
|   |   |-- auth/pages/
|   |   |-- chat/pages/
|   |   `-- settings/pages/
|   |-- lib/                    # Client utilities
|   |-- server/                 # Server-only modules (db, auth, cloudinary, realtime)
|   `-- store/                  # Zustand stores
|-- public/                     # Static assets
|-- server.js                   # Optional local custom server entry
|-- jsconfig.json               # Path aliases (@/* -> src/*)
|-- tailwind.config.js
|-- postcss.config.js
`-- package.json
```

## Environment Variables

Create a `.env` file in the project root:

```bash
DATABASE_URL=...
PORT=3000
JWT_SECRET=...

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

NEXT_PUBLIC_PUSHER_KEY=...
NEXT_PUBLIC_PUSHER_CLUSTER=...
PUSHER_APP_ID=...
PUSHER_SECRET=...
```

Auth notes:

- OTP/Twilio authentication has been removed.

Encrypted media notes:

- Image attachments are encrypted in-browser before upload.
- A shared media passphrase is stored locally per conversation.
- Cloudinary stores encrypted blobs, not plaintext images.

## Install

```bash
npm install
```

## Run (Development)

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Run (Production)

```bash
npm start
```

## Deploy To Vercel

1. Push this project to a Git repository.
2. Import the repository in Vercel.
3. Set all required environment variables in Vercel Project Settings.
4. Deploy.

Notes:

- Realtime now uses Pusher, so it works with Vercel serverless runtime.

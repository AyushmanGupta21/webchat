# WebChat

Private, friend-based realtime chat application built with Next.js App Router, PostgreSQL, and Pusher Channels.

## What This App Does

- Email/password authentication with secure JWT cookie sessions
- Friend request workflow (send, accept, reject)
- Strict friend-only messaging, calling, wallpaper, and message search access
- Realtime chat and signaling through Pusher Channels
- Media upload pipeline through Cloudinary
- Telegram-like chat interactions (reply, edit, delete, reactions, in-chat search)

## Tech Stack

- Frontend: Next.js, React, Zustand, Tailwind CSS, DaisyUI
- Backend: Next.js API routes, Node.js custom server entry
- Database: PostgreSQL (Neon-compatible) with runtime table bootstrap
- Realtime: Pusher Channels
- Media: Cloudinary signed uploads

## Project Layout

```text
.
|-- src/
|   |-- app/                    # Pages and API routes
|   |   `-- api/
|   |       |-- auth/
|   |       |-- calls/
|   |       |-- chats/
|   |       |-- friends/
|   |       |-- media/
|   |       `-- messages/
|   |-- components/             # UI components
|   |   |-- auth/
|   |   |-- chat/
|   |   |-- common/
|   |   `-- layout/
|   |-- features/               # Feature pages
|   |-- server/                 # DB, auth, pusher, cloudinary utilities
|   `-- store/                  # Zustand stores
|-- public/                     # Static assets
|-- scripts/                    # Utility scripts
|-- server.js                   # App server entry (dev/prod)
`-- package.json
```

## Environment Variables

Create a .env file in the root with the following values:

```bash
DATABASE_URL=postgresql://...
PORT=3000
JWT_SECRET=replace_with_strong_secret

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

NEXT_PUBLIC_PUSHER_KEY=...
NEXT_PUBLIC_PUSHER_CLUSTER=...
PUSHER_APP_ID=...
PUSHER_SECRET=...

# Optional (GIF/sticker search)
NEXT_PUBLIC_TENOR_API_KEY=...
NEXT_PUBLIC_TENOR_CLIENT_KEY=webchat
```

## Local Setup

1. Install dependencies.

```bash
npm install
```

2. Start development server.

```bash
npm run dev
```

3. Open the app.

```text
http://localhost:3000
```

## NPM Scripts

- npm run dev: starts the app with the custom server for local development
- npm run build: creates production build
- npm start: runs production server
- npm run lint: runs Next.js lint checks

## Privacy and Access Model

- New users do not automatically see all platform users as chat contacts.
- Users must become friends before they can chat.
- Friend-only guards are enforced server-side, not only in UI.
- Protected operations include messages, reactions, edit/delete, search, wallpapers, and calls.

## Deployment Notes

- Set all required environment variables in your host (for example Vercel).
- Use a reachable PostgreSQL instance and valid Pusher credentials.
- Realtime features depend on Pusher keys being correctly configured.

## License

This project is licensed under the ISC License.

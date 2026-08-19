# Realtime Chat — Frontend

A React frontend for the Realtime Chat API, built with Vite. Handles authentication, room browsing, and a live chat interface with presence, typing indicators, and message history.

**Live app:** https://<your-frontend-url>.onrender.com
**Backend API:** https://<your-backend-url>.onrender.com/docs

## Features

- Register / login with JWT stored in `localStorage`, automatically refreshed on expiry
- Protected routes — redirects to `/login` if not authenticated
- Room list — browse existing rooms or create a new one
- Live chat room:
  - Loads message history via REST on join
  - Connects to the room's WebSocket for real-time updates
  - Shows who's currently online in the room
  - Shows a typing indicator when someone else is typing
  - Auto-scrolls to the latest message
  - Cleanly closes the WebSocket connection when leaving the room

## Tech Stack

- **React** (Vite)
- **react-router-dom** — client-side routing
- **axios** — REST API calls, with request/response interceptors for auth
- Native browser **WebSocket** API for the chat connection
- Deployed on **Render** (Static Site)

## Project Structure

```
chat-frontend/
├── src/
│   ├── api/
│   │   └── axios.js            # centralized REST client + auth interceptors
│   ├── context/
│   │   └── AuthContext.jsx      # global auth state (login/logout/current user)
│   ├── components/
│   │   └── ProtectedRoute.jsx   # blocks access to pages when not logged in
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── RoomList.jsx         # browse/create rooms
│   │   └── ChatRoom.jsx          # WebSocket connection + chat UI
│   ├── App.jsx                   # routes
│   ├── main.jsx
│   └── index.css
├── .env                           # local config (not committed)
└── package.json
```

## Setup (local development)

1. Clone the repo and install dependencies:
   ```bash
   git clone <repo-url>
   cd chat-frontend
   npm install
   ```

2. Create a `.env` file:
   ```
   VITE_API_URL=http://127.0.0.1:8000
   ```
   (Point this at your local backend, or the deployed API URL. The WebSocket URL is derived from this same value at connection time by swapping `http`/`https` for `ws`/`wss`.)

3. Make sure the backend is running (see backend README), with `http://localhost:5173` allowed in its CORS `origins` list.

4. Start the dev server:
   ```bash
   npm run dev
   ```

5. Open `http://localhost:5173`.

## Building for Production

```bash
npm run build      # outputs to dist/
npm run preview    # test the production build locally on port 4173
```

## Deployment

Deployed on Render as a Static Site.

- **Build Command:** `npm run build`
- **Publish Directory:** `dist`
- **Environment variable required:** `VITE_API_URL` (set to the deployed backend URL, e.g. `https://realtime-ws-xxxx.onrender.com`)

Note: Vite environment variables are baked in at build time, not read at runtime — changing `VITE_API_URL` requires a redeploy (or Manual Deploy) to take effect.

After deploying, make sure the frontend's URL is added to the backend's CORS `origins` list, and that the backend's Start Command includes `alembic upgrade head` so the database schema stays current.

## How the chat connection works

1. On joining a room, the app loads message history with `GET /rooms/{id}/messages`
2. It then opens a WebSocket to `wss://.../ws/{room_id}?token={access_token}` — the JWT is passed as a query parameter, since WebSocket connections can't carry custom headers
3. Incoming messages are JSON objects with a `type` field (`message`, `typing`, `user_joined`, `user_left`), so the UI knows how to render each one
4. Typing a message sends a `{"type": "typing"}` event on every keystroke; the receiving side shows "X is typing..." and clears it automatically after ~2 seconds of silence
5. Leaving the page closes the WebSocket connection cleanly via a `useEffect` cleanup function

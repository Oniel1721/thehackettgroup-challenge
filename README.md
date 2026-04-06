# Cooking Assistant — Hackett Group Chat Challenge

A multi-turn cooking assistant chat app built with **NestJS** (backend) and **Next.js 14 App Router** (frontend), featuring Anthropic Claude streaming via SSE, tool calling, and a BFF proxy pattern.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | NestJS · TypeScript · Anthropic SDK |
| Frontend | Next.js 14 App Router · React · Tailwind CSS |
| LLM | Claude Haiku (`claude-haiku-4-5-20251001`) |
| Transport | Server-Sent Events (SSE) end-to-end |
| Session store | In-memory (default) · Redis |

---

## Quick Start — Docker

```bash
cp .env.example .env
# Set LLM_API_KEY in .env

docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

Docker Compose starts Redis automatically. NestJS uses Redis as the session store (`SESSION_STORE=redis`).

---

## Quick Start — Local Development

### 1. Backend

```bash
cd apps/backend
cp ../../.env.example .env
```

Edit `apps/backend/.env` and set:

```
LLM_API_KEY=<your-anthropic-api-key>
SESSION_STORE=memory   # no Redis required locally
```

Then:

```bash
npm install
npm run start:dev
```

### 2. Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

Open http://localhost:3000. Both services must be running.

---

## Running Tests

```bash
# Backend
cd apps/backend && npm test

# Frontend
cd apps/frontend && npm test
```

---

## Architecture

### Server Component Bootstrap

`app/page.tsx` is a **Server Component** that:

1. Reads `sessionId` from the HTTP-only cookie via `cookies()` from `next/headers`
2. If no cookie exists, redirects to `/api/session` which creates a session on NestJS and sets the cookie
3. Fetches `/chat/:sessionId/history` from NestJS server-side
4. Passes `initialMessages` and `sessionId` to `<ChatBox>` — **no client-side `useEffect` for initial data load**

### BFF Proxy Pattern

The browser **never** talks directly to NestJS. All LLM traffic goes through a Next.js Route Handler (`/api/chat`) that:

1. Reads the `sessionId` from the HTTP-only cookie (never from the request body)
2. Calls NestJS `POST /chat/:sessionId/message` server-side
3. Pipes the SSE `ReadableStream` directly back to the browser

**Why?**
- The NestJS URL and API key are never exposed in the browser's Network tab
- HTTP-only cookies prevent XSS access to the session identifier
- Clean separation: the browser only knows about the Next.js origin

```
Browser ──fetch /api/chat──▶ Next.js BFF ──fetch NestJS──▶ NestJS ──SDK──▶ Anthropic
         ◀── SSE stream ──────────────────────────────────────────────────────────────
```

### Optimistic UI

`ChatBox` uses React's `useOptimistic` to append the user's message bubble instantly before the server responds. On error, the optimistic message is rolled back automatically.

### Session Lifecycle

Sessions expire after **30 minutes of idle time**. When a session expires or is not found:

- NestJS returns `404` (not found) or `410` (expired)
- The BFF translates these to `{ sessionExpired: true }`
- The frontend shows an expiry banner with a "Start new session" button that clears the cookie and redirects to `/`

### Session Store — Repository Pattern

The session store is abstracted behind an `ISessionRepository` interface with two implementations:

| Implementation | Class | When used |
|---|---|---|
| In-memory | `InMemorySessionRepository` | `SESSION_STORE=memory` |
| Redis | `RedisSessionRepository` | `SESSION_STORE=redis` |

The active implementation is selected at startup via the `SESSION_STORE` environment variable. Docker Compose defaults to Redis. Local development defaults to in-memory (no Redis required).

### Tool Calling

The assistant has access to a `lookup_recipe` tool. When a user asks for a recipe:

1. NestJS makes a **non-streaming** Anthropic call to resolve the tool cycle
2. The tool result (ingredients + steps) is appended to the message history
3. A **streaming** Anthropic call generates the final response using the tool result
4. Tokens stream to the browser via SSE

This guarantees tool resolution completes before the first token reaches the UI.

### Rate Limiting

Two layers of rate limiting are in place:

| Layer | Limit | Mechanism |
|---|---|---|
| NestJS | 10 req / min / IP | `@nestjs/throttler` global guard |
| BFF | 20 req / hour / session | Sliding-window counter in an HTTP-only cookie (`rl_log`) |

Both return `429 Too Many Requests` with a `Retry-After` header.

### Edge Runtime

The BFF route (`app/api/chat/route.ts`) runs on the **Edge Runtime** (`export const runtime = 'edge'`).

**What changes:**
- The route executes in a V8 isolate instead of a full Node.js process — no `fs`, no `Buffer`, no Node-specific APIs
- Cold starts drop from ~200–500 ms to ~5–50 ms on platforms like Vercel Edge Network

**Why it works here:**
The BFF only uses Web-standard APIs (`fetch`, `Request`, `Response`, `ReadableStream`, `cookies()` from `next/headers`) — no Node.js APIs are needed. The SSE stream is piped using native `ReadableStream`, which is first-class in the Edge runtime.

---

## Bonus Features

| Bonus | Status |
|---|---|
| Rate limiting (NestJS ≤ 10 req/min · BFF ≤ 20 req/hour) | ✅ Implemented |
| Redis session store with repository pattern | ✅ Implemented |
| Docker Compose (`docker compose up` starts everything) | ✅ Implemented |
| Edge Runtime on BFF route | ✅ Implemented |
| Reconnect with `Last-Event-ID` | — Not implemented |

---

## Sample Interactions

### 1. Simple cooking question (no tool)

**User:** What is the difference between baking soda and baking powder?

**Assistant:** Great question! Both are leavening agents, but they work differently:
- **Baking soda** (sodium bicarbonate) needs an acid in the recipe (buttermilk, lemon juice, vinegar) to activate
- **Baking powder** contains baking soda + cream of tartar (an acid) built in, so it activates with moisture alone
- Use baking soda when your recipe already has an acidic ingredient; use baking powder otherwise

---

### 2. Recipe request (tool call triggered)

**User:** Can you give me the recipe for spaghetti carbonara?

*(Tool call: `lookup_recipe("spaghetti carbonara")` → returns ingredients + steps)*

**Assistant:** Here's a classic Spaghetti Carbonara recipe!

**Ingredients:**
- 400g spaghetti
- 200g pancetta or guanciale
- 4 large eggs
- 100g Pecorino Romano, grated
- Black pepper, salt

**Steps:**
1. Cook spaghetti in salted boiling water until al dente
2. Fry pancetta in a pan until crispy, set aside
3. Whisk eggs with Pecorino and lots of black pepper
4. Reserve pasta water, drain spaghetti
5. Off heat, toss pasta with pancetta, pour egg mixture, add pasta water to emulsify
6. Serve immediately with extra Pecorino

---

### 3. Off-topic request (domain enforcement)

**User:** Can you help me write a JavaScript function?

**Assistant:** I'm a cooking assistant, so JavaScript is a bit outside my kitchen! I'm best at helping with recipes, cooking techniques, ingredient substitutions, and food questions. Is there something culinary I can help you with instead?

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `LLM_API_KEY` | Yes | — | Anthropic API key |
| `LLM_MODEL` | No | `claude-haiku-4-5-20251001` | Model ID |
| `PORT` | No | `3001` | NestJS listen port |
| `API_URL` | No | `http://localhost:3001` | NestJS URL (used by the Next.js BFF) |
| `SESSION_STORE` | No | `memory` | Session backend: `memory` or `redis` |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL (required when `SESSION_STORE=redis`) |

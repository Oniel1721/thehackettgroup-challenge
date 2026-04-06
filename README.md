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

---

## Quick Start — Docker

```bash
cp .env.example .env
# Fill in LLM_API_KEY in .env

docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Redis: localhost:6379

Docker Compose starts Redis automatically and configures NestJS to use it as the session store (`SESSION_STORE=redis`).

---

## Quick Start — Local Development

### Backend

```bash
cd apps/backend
cp ../../.env.example .env   # set LLM_API_KEY
npm install
npm run start:dev
```

By default the backend uses the **in-memory** session store (`SESSION_STORE=memory`). To use Redis locally, start a Redis instance and set `SESSION_STORE=redis` and `REDIS_URL=redis://localhost:6379` in your `.env`.

### Frontend

```bash
cd apps/frontend
npm install
npm run dev
```

Both services must be running. The frontend reads `API_URL` from the environment (defaults to `http://localhost:3001`).

---

## Running Tests

```bash
# Backend (Jest)
cd apps/backend
npm test

# Frontend (Jest + Testing Library)
cd apps/frontend
npm test
```

---

## Architecture

### BFF Proxy Pattern

The browser **never** talks directly to NestJS. All LLM traffic goes through a Next.js Route Handler (`/api/chat`) that:

1. Reads the `sessionId` from an **HTTP-only cookie** (never from the request body)
2. Calls NestJS `POST /chat/:sessionId/message` server-side
3. Pipes the SSE `ReadableStream` directly back to the browser

**Why?**
- The NestJS URL and the `sessionId` are never exposed in the browser's Network tab
- The Anthropic API key lives only in the NestJS process — two hops from the client
- HTTP-only cookies prevent XSS access to the session identifier

```
Browser ──fetch /api/chat──▶ Next.js BFF ──fetch NestJS──▶ NestJS ──SDK──▶ Anthropic
         ◀── SSE stream ──────────────────────────────────────────────────────────────
```

### Session Lifecycle

Sessions expire after **30 minutes of idle time**. When a session expires or is not found:

- NestJS returns 404 (not found) or 410 (expired)
- The BFF translates these to `{ sessionExpired: true }`
- The frontend shows an expiry banner, clears the cookie, and redirects to `/`

### Session Store — Repository Pattern

The session store is abstracted behind an `ISessionRepository` interface with two implementations:

| Implementation | Class | When used |
|---|---|---|
| In-memory | `InMemorySessionRepository` | `SESSION_STORE=memory` (default) |
| Redis | `RedisSessionRepository` | `SESSION_STORE=redis` |

The active implementation is selected at startup via the `SESSION_STORE` environment variable. Docker Compose defaults to Redis. Local development defaults to in-memory (no Redis required).

### Tool Calling

The assistant has access to a `lookup_recipe` tool. When a user asks for a recipe:

1. NestJS makes a **non-streaming** Anthropic call to resolve the tool cycle
2. The tool result (ingredients + steps) is appended to the message history
3. A **streaming** Anthropic call generates the final response using the tool result
4. Tokens stream to the browser via SSE

This guarantees tool resolution completes before the first token reaches the UI.

---

## Sample Interactions

### 1. Simple cooking question (no tool)

**User:** What is the difference between baking soda and baking powder?

**Assistant:** Great question! Both are leavening agents, but they work differently...
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
| `API_URL` | No | `http://localhost:3001` | NestJS URL (used by Next.js BFF) |
| `SESSION_STORE` | No | `memory` | Session backend: `memory` or `redis` |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL (only when `SESSION_STORE=redis`) |

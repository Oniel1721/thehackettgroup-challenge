# Chat Application — Interview Assignment

> Build a **multi-turn chat app** — a NestJS backend and a **Next.js 14+ App Router** frontend — where users hold real conversations with a domain-expert AI assistant.

---

## 🔴 Part A — Backend (NestJS)

⏱ *Suggested time: 20 minutes*

### Requirements

| Requirement | Details |
|---|---|
| **Routes** | `POST /chat/session` · `POST /chat/:sessionId/message` · `GET /chat/:sessionId/history` · `DELETE /chat/:sessionId` |
| **Session creation** | `POST /chat/session` → `201 { "sessionId": "uuid" }` |
| **Message send** | Body: `{ "message": "string" }` → `{ "reply": "string", "turnIndex": number }` |
| **Validation** | Empty/missing `message` → `400` · Unknown `sessionId` → `404` · Session > 30 min idle → `410 Gone` |
| **State** | Full turn history held in memory per session (no database) |
| **Tech** | TypeScript · NestJS modules, controllers, services, DTOs, `ValidationPipe`, custom exception filter |
| **Bonus** | Rate-limit guard (≤ 10 req/min per IP) · Health-check endpoint `GET /health` |

### Evaluation Criteria

1. Module boundaries — `ChatModule`, `SessionModule`, clear service responsibilities
2. Correct HTTP semantics across all routes and all error paths
3. No `any` anywhere in service or DTO layer
4. Session lifecycle: create · use · idle-expire (must be clock-injectable for testing) · delete
5. *(Bonus)* `Dockerfile` and health-check

---

## 🔵 Part B — Frontend (Next.js 14+ App Router)

⏱ *Suggested time: 20 minutes*

### Requirements

| Requirement | Details |
|---|---|
| **Framework** | Next.js 14+ with **App Router** — no Pages Router |
| **Route** | Single page at `/` |
| **Session persistence** | Store `sessionId` in an **HTTP-only cookie** set via a Next.js **Route Handler** (`app/api/session/route.ts`). On first load the Server Component reads the cookie and passes the existing (or freshly created) session down as a prop — no client-side bootstrap effect. |
| **Server Component** | `app/page.tsx` is a **Server Component** that fetches initial history from NestJS and passes it as `initialMessages` to the chat client |
| **Client Component** | `ChatBox` — marked `'use client'` — owns the interactive input, send button, and live message list |
| **Optimistic UI** | Use **`useOptimistic`** to append the user's bubble instantly before the server responds |
| **UI** | Scrollable bubble list (user right / bot left) · Text input + Send button · Turn counter |
| **Error handling** | `400` → `"Message cannot be empty."` · `404`/`410` → auto-expire banner + cookie clear + redirect to `/` · Network → `"Connection lost, please retry."` |
| **Styling** | Tailwind utility classes only — no UI kits, no component libraries |
| **Bonus** | Auto-scroll with `useEffect` + `ref` · Disable Send while in-flight · Enter to submit · Relative timestamps with `Intl.RelativeTimeFormat` |

### Key Architectural Points

- `app/page.tsx` (Server Component) reads the session cookie with `cookies()` from `next/headers`, calls the NestJS `/history` endpoint server-side, and passes `initialMessages` to `<ChatBox>` — **no client-side `useEffect` for initial data load**
- `app/api/session/route.ts` (Route Handler) proxies session creation to NestJS and sets `Set-Cookie` on the response
- `ChatBox` sends messages directly to NestJS in Part B; the BFF proxy comes in Part C
- The `useOptimistic` call must correctly roll back the optimistic message on error

### Evaluation Criteria

1. Correct Server / Client Component boundary — `page.tsx` must not be a Client Component
2. `useOptimistic` wired correctly, including rollback on failure
3. Cookie-based session bootstrap — no `localStorage`, no `useEffect` for initial state
4. State shape clearly typed — separate types for `UserMessage`, `BotMessage`, `Session`
5. Tailwind-only styling that remains coherent on mobile

---

---

# 🏠 Take-Home Assignment — LLM Integration & Streaming

> Extend the app so the NestJS backend streams tokens, and a **Next.js Route Handler acts as a BFF** (Backend for Frontend) that proxies the stream — keeping the NestJS URL and API key off the browser entirely.

🕒 **Deadline: 48 hours** — reach out if you need an extension.

---

## Steps

### 1 · Choose an LLM Provider

Google Gemini preferred (`gemini-2.0-flash`). Any provider with a **streaming API** is required — batch-only providers are not acceptable.

---

### 2 · NestJS Backend — Streaming + Tool Calling

**`LlmService`**

- Accepts `{ history: Turn[], newMessage: string }` and calls the LLM with full conversation history
- Returns an **async iterable of token chunks**
- Env vars `LLM_API_KEY` and `LLM_MODEL` only — no committed secrets

**`POST /chat/:sessionId/message` → SSE**

- Respond with `Content-Type: text/event-stream`
- Emit `data: {"token":"..."}` per chunk, then `data: {"done":true,"turnIndex":N}` to close
- Store the completed reply in session history **only after `done`**
- On LLM failure mid-stream: emit `data: {"error":"LLM unavailable"}` and close

**Tool / Function Calling (required)**

- Define one tool the model can invoke (e.g. `lookup_recipe`, `run_ts_snippet`, `get_department_info`)
- Implement a real handler in NestJS (stub data is fine; the loop must be wired)
- The `tool_use → NestJS handler → tool_result → final response` cycle must complete before the first token is streamed to the client
- Off-topic refusals enforced via system prompt **and** `finish_reason` inspection — do not rely on model compliance alone

---

### 3 · Next.js BFF — Route Handler SSE Proxy

Add `app/api/chat/route.ts` as a **streaming Route Handler**:

- Receives the user message from `ChatBox` (no sessionId in the request body — read it from the HTTP-only cookie with `cookies()`)
- Calls the NestJS SSE endpoint using `fetch` with `{ cache: 'no-store' }`
- Pipes the NestJS `ReadableStream` directly to the Next.js response via `new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })`
- The browser **never** talks to NestJS directly — all traffic goes through this Route Handler
- If the session cookie is missing or NestJS returns `404`/`410`, the Route Handler returns `{ "sessionExpired": true }` as JSON and the client clears the cookie and refreshes

This pattern means the NestJS URL and LLM key never appear in the browser's network tab.

---

### 4 · Frontend Streaming UX

- `ChatBox` consumes the Route Handler stream with `fetch` + `response.body.getReader()`
- Decode chunks with `TextDecoder`, parse SSE lines (`data: {...}`)
- Append each `token` to the in-progress bot bubble in state
- Show a blinking CSS cursor `|` on the live bubble; remove it on `done`
- On `sessionExpired: true` from the BFF: show a toast `"Session expired"`, clear the cookie (via `DELETE /api/session`), and trigger a full page reload so the Server Component re-bootstraps the session
- The `useOptimistic` user bubble from Part B remains; the bot bubble starts empty and fills via the stream

---

### 5 · Testing (mandatory)

**NestJS unit tests** — Jest + NestJS testing utilities:

| Test surface | What to cover |
|---|---|
| `SessionService` | Create · retrieve turns · expire after 30 min (mock `Date.now`) · delete |
| `LlmService` | Mock HTTP · assert history passed correctly · assert token stream forwarded · assert tool call loop executed |
| `ChatController` | `POST /session` 201 · unknown id → 404 · idle-expired id → 410 · SSE response has correct `Content-Type` |

**Next.js tests** — Jest + `@testing-library/react`:

| Test surface | What to cover |
|---|---|
| `ChatBox` | Renders `initialMessages` · optimistic bubble appears before fetch resolves · rollback on error |
| `/api/chat` Route Handler | Proxies stream correctly · returns `sessionExpired` on 410 from NestJS |

**README** must include 3 sample Q&A pairs demonstrating the domain expert, with one showing a tool call being triggered.

---

### 6 · Delivery

- Public GitHub repo
- `docker compose up` starts NestJS + Next.js with one command
- `env.example` at repo root — all keys documented
- `README.md`: local setup · docker instructions · 3 sample Q&As · explanation of BFF proxy design decision

---

### 7 · Bonus Points

| Bonus | Details |
|---|---|
| Edge Runtime | Move `app/api/chat/route.ts` to the Edge Runtime (`export const runtime = 'edge'`) and explain in the README what changes and why |
| Reconnect | On stream drop the frontend retries with `Last-Event-ID`; NestJS resumes from the last token offset |
| Redis sessions | Replace in-memory session store with Redis; add the container to `docker-compose.yml` |
| Rate limiting | Per-session rate limit on the BFF route (≤ 20 req/hour) using a sliding-window counter stored in a cookie or Redis; return `429` with `Retry-After` |

---

*Focus on clean architecture and correct boundaries over feature count. The BFF proxy pattern, `useOptimistic`, and the Server Component bootstrap are the three things we'll look at first. 🚀*
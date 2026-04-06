import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

const RATE_LIMIT = 20;          // max requests
const WINDOW_MS = 60 * 60_000; // 1 hour in ms

function checkRateLimit(cookieStore: Awaited<ReturnType<typeof cookies>>): {
  allowed: boolean;
  retryAfter?: number;
  updatedLog: string;
} {
  const now = Date.now();
  const raw = cookieStore.get("rl_log")?.value;
  const timestamps: number[] = raw
    ? (JSON.parse(raw) as number[]).filter((t) => now - t < WINDOW_MS)
    : [];

  if (timestamps.length >= RATE_LIMIT) {
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter, updatedLog: JSON.stringify(timestamps) };
  }

  timestamps.push(now);
  return { allowed: true, updatedLog: JSON.stringify(timestamps) };
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("sessionId")?.value;

  if (!sessionId) {
    return Response.json({ sessionExpired: true }, { status: 401 });
  }

  const { allowed, retryAfter, updatedLog } = checkRateLimit(cookieStore);
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    });
  }

  const body = await req.json();
  let nestRes: globalThis.Response;
  try {
    nestRes = await fetch(`${API_URL}/chat/${sessionId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return Response.json({ error: "LLM unavailable" }, { status: 502 });
  }

  if (nestRes.status === 400) {
    const data = await nestRes.json().catch(() => ({}));
    return Response.json(data, { status: 400 });
  }

  if (nestRes.status === 404 || nestRes.status === 410) {
    return Response.json({ sessionExpired: true }, { status: nestRes.status });
  }

  if (nestRes.status === 429) {
    const retryAfter = nestRes.headers.get("Retry-After") ?? "60";
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter,
      },
    });
  }

  if (!nestRes.ok || !nestRes.body) {
    return Response.json({ error: "LLM unavailable" }, { status: 502 });
  }

  // Pipe the NestJS SSE stream directly to the browser
  const response = new Response(nestRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });

  // Persist updated rate-limit log in cookie
  response.headers.append(
    "Set-Cookie",
    `rl_log=${updatedLog}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.ceil(WINDOW_MS / 1000)}`,
  );

  return response;
}

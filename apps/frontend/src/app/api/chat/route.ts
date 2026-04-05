import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("sessionId")?.value;

  if (!sessionId) {
    return Response.json({ sessionExpired: true }, { status: 401 });
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

  if (nestRes.status === 404 || nestRes.status === 410) {
    return Response.json({ sessionExpired: true }, { status: nestRes.status });
  }

  if (!nestRes.ok || !nestRes.body) {
    return Response.json({ error: "LLM unavailable" }, { status: 502 });
  }

  // Pipe the NestJS SSE stream directly to the browser
  return new Response(nestRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

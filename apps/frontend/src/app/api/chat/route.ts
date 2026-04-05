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

  const res = await fetch(`${API_URL}/chat/${sessionId}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (res.status === 404 || res.status === 410) {
    return Response.json({ sessionExpired: true }, { status: res.status });
  }

  const data = await res.json();
  return Response.json(data, { status: res.status });
}

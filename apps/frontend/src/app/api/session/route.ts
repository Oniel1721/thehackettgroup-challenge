import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

async function createNestSession(): Promise<string> {
  const res = await fetch(`${API_URL}/chat/session`, {
    method: "POST",
    cache: "no-store",
  });

  if (!res.ok) throw new Error("Failed to create session");

  const { sessionId } = (await res.json()) as { sessionId: string };
  return sessionId;
}

/** GET /api/session — creates a session, sets cookie, redirects to / */
export async function GET() {
  const sessionId = await createNestSession();

  const cookieStore = await cookies();
  cookieStore.set("sessionId", sessionId, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  });

  redirect("/");
}

/** POST /api/session — creates a session and sets cookie, returns JSON */
export async function POST() {
  const sessionId = await createNestSession();

  const cookieStore = await cookies();
  cookieStore.set("sessionId", sessionId, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  });

  return Response.json({ sessionId });
}

/** DELETE /api/session — deletes session in NestJS and clears the cookie */
export async function DELETE(_req: NextRequest) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("sessionId")?.value;

  if (sessionId) {
    // Best-effort: ignore errors (session may already be expired in NestJS)
    await fetch(`${API_URL}/chat/${sessionId}`, {
      method: "DELETE",
      cache: "no-store",
    }).catch(() => {});
  }

  cookieStore.delete("sessionId");
  return new Response(null, { status: 204 });
}

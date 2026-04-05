import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChatBox } from "@/components/ChatBox";
import { Message, Turn } from "@/types/chat";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

function turnsToMessages(turns: Turn[]): Message[] {
  return turns.map((turn, index) => ({
    id: `${turn.role}-${index}-${turn.timestamp}`,
    role: turn.role,
    content: turn.content,
    timestamp: turn.timestamp,
  }));
}

export default async function Page() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("sessionId")?.value;

  // No session → let the Route Handler create one and redirect back
  if (!sessionId) redirect("/api/session");

  let initialMessages: Message[] = [];

  try {
    const res = await fetch(`${API_URL}/chat/${sessionId}/history`, {
      cache: "no-store",
    });

    if (res.status === 404 || res.status === 410) {
      // Session expired on the backend — re-create
      redirect("/api/session");
    }

    if (res.ok) {
      const data = (await res.json()) as { turns: Turn[] };
      initialMessages = turnsToMessages(data.turns);
    }
  } catch {
    // NestJS unreachable — show empty chat, user can still type
  }

  return (
    <ChatBox
      sessionId={sessionId}
      initialMessages={initialMessages}
    />
  );
}

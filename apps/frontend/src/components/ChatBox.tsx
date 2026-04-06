"use client";

import { Message } from "@/types/chat";
import { ChatProvider } from "@/context/ChatContext";
import { ChatHeader } from "./ChatHeader";
import { ErrorBanner } from "./ErrorBanner";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

interface ChatBoxProps {
  sessionId: string;
  initialMessages: Message[];
}

export function ChatBox({ sessionId, initialMessages }: ChatBoxProps) {
  return (
    <ChatProvider sessionId={sessionId} initialMessages={initialMessages}>
      <div className="flex h-screen flex-col bg-linear-to-br from-slate-50 to-slate-100">
        <ChatHeader />
        <ErrorBanner />
        <MessageList />
        <ChatInput />
      </div>
    </ChatProvider>
  );
}

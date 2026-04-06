import { Message } from "@/types/chat";
import { formatRelativeTime } from "@/utils/time";
import { MarkdownContent } from "./MarkdownContent";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-slate-200 text-slate-700"
        }`}
      >
        {isUser ? "U" : "AI"}
      </span>
      <div
        className={`flex max-w-[75%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "rounded-tr-sm bg-indigo-600 text-white"
              : "rounded-tl-sm bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
          }`}
        >
          {isUser ? message.content : <MarkdownContent content={message.content} />}
        </div>
        <span className="text-[10px] text-slate-400">
          {formatRelativeTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

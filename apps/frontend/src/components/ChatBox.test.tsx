import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ChatBox } from "./ChatBox";
import { Message } from "@/types/chat";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal fetch-response-like object with a ReadableStream body */
function makeSseResponse(events: string[], status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const ev of events) controller.enqueue(encoder.encode(ev));
      controller.close();
    },
  });

  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) =>
        key.toLowerCase() === "content-type" ? "text/event-stream" : null,
    },
    body,
    json: async () => { throw new Error("not json"); },
  };
}

function makeJsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) =>
        key.toLowerCase() === "content-type" ? "application/json" : null,
    },
    body: null,
    json: async () => data,
  };
}

function sseSuccess(reply: string, turnIndex = 0) {
  return makeSseResponse([
    `data: ${JSON.stringify({ token: reply })}\n\n`,
    `data: ${JSON.stringify({ done: true, turnIndex })}\n\n`,
  ]);
}

const sampleMessages: Message[] = [
  { id: "u1", role: "user", content: "Hello", timestamp: Date.now() - 5000 },
  { id: "a1", role: "assistant", content: "Hi there!", timestamp: Date.now() - 4000 },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ChatBox", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initial render", () => {
    it("renders initialMessages", () => {
      render(<ChatBox sessionId="test-session" initialMessages={sampleMessages} />);
      expect(screen.getByText("Hello")).toBeInTheDocument();
      expect(screen.getByText("Hi there!")).toBeInTheDocument();
    });

    it("shows empty-state prompt when no messages", () => {
      render(<ChatBox sessionId="test-session" initialMessages={[]} />);
      expect(
        screen.getByText(/ask me anything about cooking/i),
      ).toBeInTheDocument();
    });

    it("renders session id in footer", () => {
      render(<ChatBox sessionId="abcdef123456" initialMessages={[]} />);
      expect(screen.getByText(/abcdef12/)).toBeInTheDocument();
    });
  });

  describe("optimistic UI", () => {
    it("shows user bubble immediately before fetch resolves", async () => {
      let resolveFetch!: (v: unknown) => void;
      mockFetch.mockReturnValue(new Promise((r) => (resolveFetch = r)));

      render(<ChatBox sessionId="s1" initialMessages={[]} />);
      const input = screen.getByPlaceholderText(/ask about a recipe/i);

      await act(async () => {
        fireEvent.change(input, { target: { value: "what is pasta?" } });
        fireEvent.keyDown(input, { key: "Enter" });
      });

      // Optimistic bubble appears before fetch resolves
      expect(screen.getByText("what is pasta?")).toBeInTheDocument();

      // Resolve to avoid open handles
      await act(async () => {
        resolveFetch(sseSuccess("Pasta is great!"));
      });

      await waitFor(() => {
        expect(screen.getByText("Pasta is great!")).toBeInTheDocument();
      });
    });

    it("rolls back optimistic bubble on network error", async () => {
      mockFetch.mockRejectedValue(new Error("network failure"));

      render(<ChatBox sessionId="s1" initialMessages={[]} />);
      const input = screen.getByPlaceholderText(/ask about a recipe/i);

      await act(async () => {
        fireEvent.change(input, { target: { value: "risky question" } });
        fireEvent.keyDown(input, { key: "Enter" });
      });

      // Wait for both error banner and optimistic rollback
      await waitFor(() => {
        expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
        expect(screen.queryByText("risky question")).not.toBeInTheDocument();
      });
    });
  });

  describe("successful message flow", () => {
    it("commits user and bot messages after successful SSE stream", async () => {
      mockFetch.mockResolvedValue(sseSuccess("Great recipe!"));

      render(<ChatBox sessionId="s1" initialMessages={[]} />);
      const input = screen.getByPlaceholderText(/ask about a recipe/i);

      await act(async () => {
        fireEvent.change(input, { target: { value: "pasta recipe" } });
        fireEvent.keyDown(input, { key: "Enter" });
      });

      await waitFor(() => {
        expect(screen.getByText("Great recipe!")).toBeInTheDocument();
      });
      expect(screen.getByText("pasta recipe")).toBeInTheDocument();
    });
  });

  describe("error handling", () => {
    it("shows empty message error without sending", async () => {
      render(<ChatBox sessionId="s1" initialMessages={[]} />);
      const input = screen.getByPlaceholderText(/ask about a recipe/i);

      // Press Enter on an empty input — button is disabled but Enter key still triggers handleSend
      await act(async () => {
        fireEvent.keyDown(input, { key: "Enter" });
      });

      expect(screen.getByText(/message cannot be empty/i)).toBeInTheDocument();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("shows session-expired banner when BFF returns sessionExpired", async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse({ sessionExpired: true }, 401),
        )
        .mockResolvedValueOnce(makeJsonResponse(null, 204)); // DELETE /api/session

      render(<ChatBox sessionId="s1" initialMessages={[]} />);
      const input = screen.getByPlaceholderText(/ask about a recipe/i);

      await act(async () => {
        fireEvent.change(input, { target: { value: "hello" } });
        fireEvent.keyDown(input, { key: "Enter" });
      });

      await waitFor(() => {
        expect(screen.getByText(/session has expired/i)).toBeInTheDocument();
      });
    });
  });
});

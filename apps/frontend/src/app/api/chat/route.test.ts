/**
 * Tests for the BFF /api/chat Route Handler.
 * The handler is imported directly; `next/headers` and `fetch` are mocked.
 *
 * @jest-environment node
 */

import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockCookiesGet = jest.fn();
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => Promise.resolve({ get: mockCookiesGet })),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body: unknown = { message: "hello" }): NextRequest {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeSseBody(): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"token":"hello"}\n\n'));
      controller.enqueue(encoder.encode('data: {"done":true,"turnIndex":0}\n\n'));
      controller.close();
    },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("/api/chat Route Handler", () => {
  beforeEach(() => {
    jest.resetModules();
    mockCookiesGet.mockReturnValue({ value: "test-session-id" });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 with sessionExpired when no cookie present", async () => {
    mockCookiesGet.mockReturnValue(undefined);
    const { POST } = await import("./route");

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toEqual({ sessionExpired: true });
  });

  it("pipes the NestJS SSE stream with correct Content-Type", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: makeSseBody(),
      headers: { get: () => "text/event-stream" },
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });

  it("returns sessionExpired on 404 from NestJS", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      body: null,
      headers: { get: () => "application/json" },
      json: async () => ({ message: "Not found" }),
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest());

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toEqual({ sessionExpired: true });
  });

  it("returns sessionExpired on 410 from NestJS", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 410,
      body: null,
      headers: { get: () => "application/json" },
      json: async () => ({ message: "Gone" }),
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest());

    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data).toEqual({ sessionExpired: true });
  });

  it("returns 502 when fetch to NestJS throws", async () => {
    mockFetch.mockRejectedValue(new Error("connection refused"));

    const { POST } = await import("./route");
    const res = await POST(makeRequest());

    expect(res.status).toBe(502);
    const data = await res.json();
    expect(data).toHaveProperty("error");
  });
});

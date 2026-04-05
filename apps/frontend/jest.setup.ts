import "@testing-library/jest-dom";

// Polyfill Web APIs missing from jsdom
const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

const { ReadableStream } = require("stream/web");
global.ReadableStream = ReadableStream;

// Only available in jsdom environment
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
}

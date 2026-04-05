import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import Anthropic from '@anthropic-ai/sdk';
import { LlmService } from './llm.service';
import { Turn } from '../common/types/chat.types';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTextResponse(text: string): Anthropic.Message {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: 'text', text }],
  };
}

function makeToolUseResponse(
  toolName: string,
  toolInput: Record<string, unknown>,
): Anthropic.Message {
  return {
    id: 'msg_tool',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    stop_reason: 'tool_use',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [
      {
        type: 'tool_use',
        id: 'tool_use_1',
        name: toolName,
        input: toolInput,
      },
    ],
  };
}

async function collect(iter: AsyncIterable<string>): Promise<string> {
  let out = '';
  for await (const chunk of iter) out += chunk;
  return out;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('LlmService', () => {
  let service: LlmService;
  let createMock: jest.Mock;
  let streamMock: jest.Mock;

  beforeEach(async () => {
    createMock = jest.fn();
    streamMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(() => 'test-api-key'),
            get: jest.fn(() => 'claude-haiku-4-5-20251001'),
          },
        },
      ],
    }).compile();

    service = module.get(LlmService);

    // Replace the Anthropic client methods after construction
    (service as unknown as { client: Anthropic }).client = {
      messages: { create: createMock, stream: streamMock },
    } as unknown as Anthropic;
  });

  describe('streamReply — no tool call', () => {
    it('yields the full text content when stop_reason is end_turn', async () => {
      createMock.mockResolvedValue(makeTextResponse('Hello world'));

      const result = await collect(service.streamReply([], 'hi'));
      expect(result).toBe('Hello world');
    });

    it('passes full history + newMessage to the Anthropic API', async () => {
      createMock.mockResolvedValue(makeTextResponse('ok'));

      const history: Turn[] = [
        { role: 'user', content: 'first', timestamp: 1 },
        { role: 'assistant', content: 'reply', timestamp: 2 },
      ];
      await collect(service.streamReply(history, 'second'));

      const calledMessages = createMock.mock.calls[0][0].messages;
      expect(calledMessages).toHaveLength(3);
      expect(calledMessages[0]).toEqual({ role: 'user', content: 'first' });
      expect(calledMessages[1]).toEqual({ role: 'assistant', content: 'reply' });
      expect(calledMessages[2]).toEqual({ role: 'user', content: 'second' });
    });
  });

  describe('streamReply — tool call loop', () => {
    it('executes lookup_recipe and streams the final response', async () => {
      // First call → tool_use; second call → end_turn; streaming call yields tokens
      createMock
        .mockResolvedValueOnce(
          makeToolUseResponse('lookup_recipe', { name: 'pasta' }),
        )
        .mockResolvedValueOnce(makeTextResponse('ignored — streaming takes over'));

      async function* fakeStream() {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Here ' } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'is pasta' } };
      }
      streamMock.mockReturnValue(fakeStream());

      const result = await collect(service.streamReply([], 'give me a pasta recipe'));
      expect(result).toBe('Here is pasta');
    });

    it('appends tool_result message before final streaming call', async () => {
      createMock
        .mockResolvedValueOnce(
          makeToolUseResponse('lookup_recipe', { name: 'pizza' }),
        )
        .mockResolvedValueOnce(makeTextResponse('ignored'));

      async function* fakeStream() {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'done' } };
      }
      streamMock.mockReturnValue(fakeStream());

      await collect(service.streamReply([], 'pizza recipe'));

      const streamCallMessages = streamMock.mock.calls[0][0].messages;
      const toolResultMsg = streamCallMessages.find(
        (m: Anthropic.MessageParam) =>
          Array.isArray(m.content) &&
          (m.content as Anthropic.ToolResultBlockParam[]).some(
            (b) => b.type === 'tool_result',
          ),
      );
      expect(toolResultMsg).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('throws InternalServerErrorException when Anthropic SDK throws', async () => {
      createMock.mockRejectedValue(new Error('network error'));

      await expect(collect(service.streamReply([], 'hi'))).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});

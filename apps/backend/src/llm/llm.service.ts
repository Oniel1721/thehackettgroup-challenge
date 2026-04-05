import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Turn } from '../common/types/chat.types';

const SYSTEM_PROMPT = `You are Chef Assistant, an expert culinary AI specializing in recipes, cooking techniques, ingredients, and food pairing.

Your responsibilities:
- Provide detailed, accurate recipes with ingredients and step-by-step instructions
- Explain cooking techniques clearly (e.g. sautéing, braising, emulsifying)
- Suggest ingredient substitutions when asked
- Answer questions about food culture and cuisine origins
- Help with meal planning and dietary considerations

Guidelines:
- Be friendly, encouraging, and enthusiastic about cooking
- If a question is unrelated to food or cooking, politely redirect: "I'm specialized in cooking and recipes — let me know if you have a culinary question!"
- Keep responses concise but complete. Use bullet points or numbered lists for recipes and steps.
- Always include estimated cooking time and serving size when providing full recipes.`;

@Injectable()
export class LlmService {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.getOrThrow<string>('ANTHROPIC_API_KEY');
    this.model = this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001';
    this.client = new Anthropic({ apiKey });
  }

  async generateReply(history: Turn[], newMessage: string): Promise<string> {
    const messages: Anthropic.MessageParam[] = [
      ...history.map((turn) => ({
        role: turn.role as 'user' | 'assistant',
        content: turn.content,
      })),
      { role: 'user', content: newMessage },
    ];

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      });

      const block = response.content[0];
      if (!block || block.type !== 'text') {
        throw new Error('Empty response from Anthropic');
      }
      return block.text;
    } catch (err) {
      this.logger.error('Anthropic API error', err);
      throw new InternalServerErrorException('LLM unavailable');
    }
  }
}

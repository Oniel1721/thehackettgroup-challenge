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
- Always include estimated cooking time and serving size when providing full recipes.
- When a user asks for a specific recipe, use the lookup_recipe tool to retrieve it.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'lookup_recipe',
    description:
      'Look up a recipe by name. Returns ingredients and step-by-step cooking instructions. Use this whenever the user asks for a specific recipe.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'The name of the recipe to look up (e.g. "spaghetti carbonara")',
        },
      },
      required: ['name'],
    },
  },
];

interface RecipeResult {
  name: string;
  servings: number;
  time: string;
  ingredients: string[];
  steps: string[];
}

function lookupRecipe(name: string): RecipeResult {
  const normalized = name.toLowerCase();

  const recipes: Record<string, RecipeResult> = {
    default: {
      name,
      servings: 4,
      time: '30 minutes',
      ingredients: [
        `2 cups ${name} (main ingredient)`,
        '2 tbsp olive oil',
        '2 cloves garlic, minced',
        'Salt and pepper to taste',
        'Fresh herbs for garnish',
      ],
      steps: [
        `Prepare all ingredients for ${name}.`,
        'Heat olive oil in a large pan over medium heat.',
        'Add garlic and sauté for 1 minute until fragrant.',
        'Add main ingredients and cook according to type.',
        'Season with salt and pepper.',
        'Garnish with fresh herbs and serve immediately.',
      ],
    },
    'spaghetti carbonara': {
      name: 'Spaghetti Carbonara',
      servings: 4,
      time: '25 minutes',
      ingredients: [
        '400 g spaghetti',
        '200 g guanciale or pancetta, diced',
        '4 large egg yolks',
        '100 g Pecorino Romano, finely grated',
        '50 g Parmesan, finely grated',
        'Freshly ground black pepper',
        'Salt for pasta water',
      ],
      steps: [
        'Bring a large pot of salted water to a boil and cook spaghetti al dente.',
        'Meanwhile, cook guanciale in a cold skillet over medium heat until crispy. Remove from heat.',
        'Whisk egg yolks with Pecorino and Parmesan. Add a generous amount of black pepper.',
        'Reserve 1 cup of pasta water before draining.',
        'Add hot pasta to the skillet with guanciale (off heat). Toss to coat.',
        'Add egg mixture, tossing quickly while adding pasta water a little at a time to create a creamy sauce.',
        'Serve immediately with extra cheese and pepper.',
      ],
    },
    'chocolate chip cookies': {
      name: 'Chocolate Chip Cookies',
      servings: 24,
      time: '35 minutes (+ 1 hour chilling)',
      ingredients: [
        '2 ¼ cups all-purpose flour',
        '1 tsp baking soda',
        '1 tsp salt',
        '1 cup (2 sticks) unsalted butter, softened',
        '¾ cup granulated sugar',
        '¾ cup packed brown sugar',
        '2 large eggs',
        '2 tsp vanilla extract',
        '2 cups chocolate chips',
      ],
      steps: [
        'Whisk flour, baking soda, and salt in a bowl. Set aside.',
        'Beat butter and both sugars until light and fluffy, about 3 minutes.',
        'Add eggs one at a time, then vanilla. Mix well.',
        'Fold in flour mixture until just combined, then stir in chocolate chips.',
        'Chill dough for at least 1 hour (overnight is better).',
        'Preheat oven to 375 °F (190 °C). Scoop dough onto lined baking sheets.',
        'Bake 9–11 minutes until edges are golden but centers look underdone.',
        'Cool on pan for 5 minutes before transferring to a wire rack.',
      ],
    },
  };

  for (const key of Object.keys(recipes)) {
    if (key !== 'default' && normalized.includes(key)) {
      return recipes[key];
    }
  }

  return recipes.default;
}

function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
): string {
  if (toolName === 'lookup_recipe') {
    const name = typeof toolInput.name === 'string' ? toolInput.name : 'unknown';
    return JSON.stringify(lookupRecipe(name));
  }
  return JSON.stringify({ error: `Unknown tool: ${toolName}` });
}

@Injectable()
export class LlmService {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly logger = new Logger(LlmService.name);

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.getOrThrow<string>('ANTHROPIC_API_KEY');
    this.model =
      this.config.get<string>('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5-20251001';
    this.client = new Anthropic({ apiKey });
  }

  async *streamReply(
    history: Turn[],
    newMessage: string,
  ): AsyncIterable<string> {
    let messages: Anthropic.MessageParam[] = [
      ...history.map((turn) => ({
        role: turn.role as 'user' | 'assistant',
        content: turn.content,
      })),
      { role: 'user', content: newMessage },
    ];

    try {
      // Phase 1: non-streaming call — resolve tool calls before streaming
      let response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      while (response.stop_reason === 'tool_use') {
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        );

        // Append assistant message with tool_use blocks
        messages = [
          ...messages,
          { role: 'assistant', content: response.content },
        ];

        // Execute each tool and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(
          (block) => {
            this.logger.log(
              `Tool call: ${block.name} — input: ${JSON.stringify(block.input)}`,
            );
            const result = handleToolCall(
              block.name,
              block.input as Record<string, unknown>,
            );
            this.logger.log(
              `Tool result: ${block.name} — output: ${result}`,
            );
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: result,
            };
          },
        );

        messages = [...messages, { role: 'user', content: toolResults }];

        response = await this.client.messages.create({
          model: this.model,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: TOOLS,
          messages,
        });
      }

      // finish_reason check — guard off-topic or unexpected stops
      if (response.stop_reason !== 'end_turn') {
        this.logger.warn(`Unexpected stop_reason: ${response.stop_reason}`);
      }

      // Phase 2: if no tool was called, yield content directly (already have it)
      // If a tool was called, stream the final response for a natural feel
      const toolWasCalled = messages.length > history.length + 1;

      if (!toolWasCalled) {
        for (const block of response.content) {
          if (block.type === 'text') {
            yield block.text;
          }
        }
        return;
      }

      // Stream the final reply after tool resolution
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield event.delta.text;
        }
      }
    } catch (err) {
      this.logger.error('Anthropic streaming error', err);
      throw new InternalServerErrorException('LLM unavailable');
    }
  }
}

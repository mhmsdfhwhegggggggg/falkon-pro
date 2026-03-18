/**
 * AI Chat Engine v1.0.0
 * 
 * Intelligent conversation engine that uses LLMs to generate human-like responses.
 * Features:
 * - Context-aware replies
 * - Personality simulation
 * - Multi-language support
 * - Anti-bot pattern detection avoidance
 * 
 * @module AIChatEngine
 * @author Manus AI
 */

import { OpenAI } from 'openai';

export interface ChatContext {
  history: { role: 'user' | 'assistant'; content: string }[];
  targetUser: {
    name?: string;
    bio?: string;
    interests?: string[];
  };
  personality: 'friendly' | 'professional' | 'casual' | 'helpful';
}

export class AIChatEngine {
  private static instance: AIChatEngine;
  private client: OpenAI;

  private constructor() {
    // Client will be initialized on first use if key is available
  }

  static getInstance(): AIChatEngine {
    if (!this.instance) {
      this.instance = new AIChatEngine();
    }
    return this.instance;
  }

  private getClient(): OpenAI | null {
    if (this.client) return this.client;

    // Support for multiple providers (OpenAI, DeepSeek, Groq)
    // Using OpenAI SDK as it's compatible with most free/low-cost providers
    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_BASE_URL || 'https://api.openai.com/v1';

    if (!apiKey && !process.env.USE_FREE_AI_MOCK) {
      return null;
    }

    try {
      this.client = new OpenAI({
        apiKey: apiKey || 'free-tier-dummy-key',
        baseURL
      });
      return this.client;
    } catch (error) {
      console.error('[AIChatEngine] Failed to initialize AI client:', error);
      return null;
    }
  }

  /**
   * Generate a human-like response based on context
   */
  async generateResponse(context: ChatContext): Promise<string> {
    const client = this.getClient();
    if (!client) {
      return this.getFallbackResponse(context.personality);
    }

    try {
      const systemPrompt = this.buildSystemPrompt(context);

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...context.history
        ],
        temperature: 0.7,
        max_tokens: 150
      });

      return response.choices[0].message.content || '';
    } catch (error: any) {
      console.error('[AIChatEngine] Error generating response:', error.message);
      return this.getFallbackResponse(context.personality);
    }
  }

  private buildSystemPrompt(context: ChatContext): string {
    return `You are a human Telegram user. Your personality is ${context.personality}. 
    You are chatting with ${context.targetUser.name || 'someone'}. 
    Keep your responses concise, natural, and use emojis occasionally like a real person. 
    Do not sound like an AI assistant. Use informal language if the personality is casual.`;
  }

  private getFallbackResponse(personality: string): string {
    const fallbacks = {
      friendly: "Hey! How's it going? 😊",
      professional: "Hello, thank you for your message. How can I assist you?",
      casual: "Yo, what's up?",
      helpful: "Hi there! I'd be happy to help with that."
    };
    return fallbacks[personality as keyof typeof fallbacks] || "Hello!";
  }
}

export const aiChatEngine = AIChatEngine.getInstance();

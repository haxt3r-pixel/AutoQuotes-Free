import OpenAI from 'openai';
import { settingsRepo } from '../database/repositories/settings.repo.js';
import type {
  AiConfig, AiStatus, PolishResult, CategorizedItem, EmailDraftParams,
} from './ai.types.js';
import {
  AiNotEnabledError, AiUnavailableError, AiTimeoutError, AiParseError,
} from './ai.types.js';
import { extractJson } from './validators/json-extractor.js';
import { validateCategories } from './validators/priority.validator.js';
import {
  NOTE_POLISHER_SYSTEM, buildPolishPrompt,
} from './prompts/note-polisher.prompt.js';
import {
  EXPLANATION_SYSTEM, buildExplanationPrompt,
} from './prompts/explanation-generator.prompt.js';
import {
  PRIORITY_SYSTEM, buildCategorizePrompt,
} from './prompts/priority-categorizer.prompt.js';
import {
  EMAIL_DRAFTER_SYSTEM, buildEmailDraftPrompt,
} from './prompts/email-drafter.prompt.js';

const DEFAULT_TIMEOUT_MS = 30_000; // 30s — local models can be slow
const DEFAULT_MAX_TOKENS = 1024;

class AiService {
  private client: OpenAI | null = null;
  private config: AiConfig = { enabled: false, baseUrl: 'http://localhost:1234/v1', model: '' };
  private connectionState: 'unknown' | 'connected' | 'disconnected' = 'unknown';
  private lastError: string | null = null;

  /** Load config from database settings */
  loadConfig(): AiConfig {
    this.config = {
      enabled: settingsRepo.getTyped<boolean>('ai_enabled', false),
      baseUrl: settingsRepo.getTyped<string>('lmstudio_url', 'http://localhost:1234/v1'),
      model: settingsRepo.getTyped<string>('lmstudio_model', ''),
    };
    this.rebuildClient();
    return this.config;
  }

  /** Get current config (read-only snapshot) */
  getConfig(): AiConfig {
    return { ...this.config };
  }

  /** Save config to database */
  saveConfig(config: Partial<AiConfig>): void {
    if (config.enabled !== undefined) settingsRepo.setTyped('ai_enabled', config.enabled);
    if (config.baseUrl !== undefined) settingsRepo.setTyped('lmstudio_url', config.baseUrl);
    if (config.model !== undefined) settingsRepo.setTyped('lmstudio_model', config.model);
    this.loadConfig();
  }

  /** Rebuild OpenAI client with current config */
  private rebuildClient(): void {
    if (!this.config.enabled) {
      this.client = null;
      return;
    }
    this.client = new OpenAI({
      baseURL: this.config.baseUrl,
      apiKey: 'lm-studio', // LM Studio doesn't require a real key but the SDK does
      dangerouslyAllowBrowser: false,
      maxRetries: 1,
      timeout: DEFAULT_TIMEOUT_MS,
    });
  }

  /** Test connection: GET /v1/models and return available models */
  async testConnection(): Promise<{ ok: boolean; models: string[]; error?: string }> {
    if (!this.client) {
      // Try temporarily creating a client for testing
      const baseUrl = settingsRepo.getTyped<string>('lmstudio_url', 'http://localhost:1234/v1');
      const testClient = new OpenAI({
        baseURL: baseUrl,
        apiKey: 'lm-studio',
        timeout: 10_000,
        maxRetries: 0,
      });

      try {
        const response = await testClient.models.list();
        const models = response.data.map(m => m.id);
        this.connectionState = 'connected';
        this.lastError = null;
        return { ok: true, models };
      } catch (err: any) {
        this.connectionState = 'disconnected';
        this.lastError = err.message;
        return { ok: false, models: [], error: err.message };
      }
    }

    try {
      const response = await this.client.models.list();
      const models = response.data.map(m => m.id);
      this.connectionState = 'connected';
      this.lastError = null;

      // Auto-detect model if not set
      if (!this.config.model && models.length > 0) {
        this.config.model = models[0];
        settingsRepo.setTyped('lmstudio_model', models[0]);
      }

      return { ok: true, models };
    } catch (err: any) {
      this.connectionState = 'disconnected';
      this.lastError = err.message;
      return { ok: false, models: [], error: err.message };
    }
  }

  /** Lightweight ping for status indicator polling */
  async ping(): Promise<boolean> {
    const result = await this.testConnection();
    return result.ok;
  }

  /** Get current status */
  async getStatus(): Promise<AiStatus> {
    const config = this.loadConfig();
    let models: string[] = [];
    let connected = false;
    let error: string | null = null;

    if (config.enabled) {
      const result = await this.testConnection();
      connected = result.ok;
      models = result.models;
      error = result.error ?? null;
    }

    return {
      connected,
      enabled: config.enabled,
      models,
      model: config.model || (models.length > 0 ? models[0] : null),
      error,
    };
  }

  // ── Core Chat Methods ──

  /**
   * Public chat method for external modules (e.g. parts scraper).
   * Sends a system+user prompt and returns the raw response text.
   */
  async rawChat(
    systemPrompt: string,
    userContent: string,
    opts?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    return this.chat(systemPrompt, userContent, opts);
  }

  private async chat(
    systemPrompt: string,
    userContent: string,
    opts?: { temperature?: number; maxTokens?: number },
  ): Promise<string> {
    // Reload config to pick up model changes from settings
    this.loadConfig();
    
    if (!this.config.enabled) {
      throw new AiNotEnabledError();
    }
    if (!this.client) {
      this.rebuildClient();
    }
    if (!this.client) {
      throw new AiNotEnabledError();
    }

    const model = this.config.model;
    if (!model) {
      throw new AiUnavailableError('No model configured. Please select a model in Settings.');
    }

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: opts?.temperature ?? 0.3,
        max_tokens: opts?.maxTokens ?? DEFAULT_MAX_TOKENS,
      });

      this.connectionState = 'connected';
      this.lastError = null;

      const content = response.choices[0]?.message?.content?.trim() ?? '';
      if (!content || content.length === 0) {
        console.warn('[AiService] Model returned empty response for prompt:', systemPrompt.substring(0, 80));
      }
      return content;
    } catch (err: any) {
      this.connectionState = 'disconnected';
      this.lastError = err.message;

      // Classify errors
      if (err.code === 'ECONNREFUSED' || err.message?.includes('Connection error')) {
        throw new AiUnavailableError('LM Studio is not running. Start LM Studio and ensure the local server is on.');
      }
      if (err.code === 'ETIMEDOUT' || err.name === 'AbortError' || err.name === 'RequestTimeoutError') {
        throw new AiTimeoutError('LM Studio took too long to respond. Try a smaller/faster model.');
      }
      throw new AiUnavailableError(`AI service error: ${err.message}`);
    }
  }

  // ── Feature Methods ──

  /** Polish grammar and spelling of raw note text */
  async polishNote(rawText: string): Promise<PolishResult> {
    const polished = await this.chat(NOTE_POLISHER_SYSTEM, buildPolishPrompt(rawText), {
      temperature: 0.1,
      maxTokens: Math.max(rawText.length * 2, 256),
    });
    
    if (!polished || polished.trim().length === 0) {
      console.warn('[AiService] Polish returned empty — returning original');
      return { original: rawText, polished: rawText };
    }
    return { original: rawText, polished };
  }

  /** Generate a layperson-friendly explanation for a repair item */
  async explainPart(partDescription: string, vehicleContext?: string): Promise<string> {
    const explanation = await this.chat(
      EXPLANATION_SYSTEM,
      buildExplanationPrompt(partDescription, vehicleContext),
      { temperature: 0.4, maxTokens: 300 },
    );
    return explanation;
  }

  /** Categorize line items into safety/recommended/optional buckets */
  async categorizeLineItems(
    items: { index: number; description: string; cost: number }[],
    notes?: string,
  ): Promise<CategorizedItem[]> {
    const raw = await this.chat(PRIORITY_SYSTEM, buildCategorizePrompt(items, notes), {
      temperature: 0.1,
      maxTokens: 500,
    });

    let parsed: unknown[];
    try {
      parsed = extractJson<unknown[]>(raw);
    } catch (err: any) {
      throw new AiParseError('Failed to parse categorization result. The AI response was not valid JSON.', raw);
    }

    return validateCategories(parsed);
  }

  /** Draft a personalized email cover letter */
  async draftEmail(params: EmailDraftParams): Promise<string> {
    const systemPrompt = EMAIL_DRAFTER_SYSTEM.replace('{TONE}', params.tone);
    const email = await this.chat(systemPrompt, buildEmailDraftPrompt(params), {
      temperature: 0.5,
      maxTokens: 800,
    });
    return email;
  }
}

// Singleton
export const aiService = new AiService();
/**
 * AI module type definitions.
 * LM Studio exposes an OpenAI-compatible API at {baseUrl}/chat/completions
 */

export interface AiConfig {
  enabled: boolean;
  baseUrl: string;
  model: string;
}

export interface AiStatus {
  connected: boolean;
  enabled: boolean;
  models: string[];
  model: string | null;
  error: string | null;
}

export interface PolishResult {
  original: string;
  polished: string;
}

export interface CategorizedItem {
  index: number;
  category: 'safety_critical' | 'required' | 'recommended' | 'optional';
  reason: string;
}

export interface EmailDraftParams {
  customerName: string;
  vehicleInfo: string;
  quoteSummary: string;
  shopName: string;
  tone: 'professional' | 'friendly';
}

// ── Error Classes ──

export class AiNotEnabledError extends Error {
  constructor() { super('AI features are not enabled'); this.name = 'AiNotEnabledError'; }
}

export class AiUnavailableError extends Error {
  constructor(msg = 'LM Studio is not reachable') { super(msg); this.name = 'AiUnavailableError'; }
}

export class AiTimeoutError extends Error {
  constructor(msg = 'AI request timed out') { super(msg); this.name = 'AiTimeoutError'; }
}

export class AiParseError extends Error {
  rawResponse: string;
  constructor(msg: string, raw: string) {
    super(msg);
    this.name = 'AiParseError';
    this.rawResponse = raw;
  }
}
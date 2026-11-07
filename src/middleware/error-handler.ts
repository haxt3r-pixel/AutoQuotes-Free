import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  AiNotEnabledError, AiUnavailableError, AiTimeoutError, AiParseError,
} from '../ai/ai.types.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error(`[ERROR] ${err.name}: ${err.message}`);

  // Validation errors — return 400 with field details
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'validation_error',
      message: 'Invalid request data',
      issues: err.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
    });
    return;
  }

  // AI-related errors — always return 200 with structured error for graceful UI handling
  if (err instanceof AiNotEnabledError) {
    res.status(200).json({ success: false, error: 'ai_not_enabled', message: err.message });
    return;
  }
  if (err instanceof AiUnavailableError) {
    res.status(200).json({ success: false, error: 'ai_unavailable', message: err.message });
    return;
  }
  if (err instanceof AiTimeoutError) {
    res.status(200).json({ success: false, error: 'ai_timeout', message: err.message });
    return;
  }
  if (err instanceof AiParseError) {
    res.status(200).json({
      success: false,
      error: 'ai_parse_error',
      message: err.message,
      rawResponse: err.rawResponse.slice(0, 500),
    });
    return;
  }

  // Generic errors
  const status = (err as any).statusCode || (err as any).status || 500;
  res.status(status).json({
    success: false,
    error: 'internal_error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
}
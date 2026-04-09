/**
 * Ollama provider integration test
 * Verifies that the OpenRouter agent can be configured to use Ollama's
 * OpenAI-compatible API endpoint instead of OpenRouter's cloud API.
 *
 * RED PHASE: Tests must FAIL until the URL is made configurable.
 */

import { describe, it, expect } from 'bun:test';
import { SettingsDefaultsManager } from '../src/shared/SettingsDefaultsManager.js';

describe('Ollama provider configuration', () => {
  it('CLAUDE_MEM_OPENROUTER_BASE_URL setting exists in defaults', () => {
    // The settings system should recognise a base URL override
    // so we can point at Ollama (localhost:11434) instead of OpenRouter
    const defaults = SettingsDefaultsManager.getAllDefaults();
    expect('CLAUDE_MEM_OPENROUTER_BASE_URL' in defaults).toBe(true);
  });

  it('default base URL is OpenRouter cloud', () => {
    const defaults = SettingsDefaultsManager.getAllDefaults();
    expect(defaults.CLAUDE_MEM_OPENROUTER_BASE_URL).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('Ollama URL format is valid', () => {
    const ollamaUrl = 'http://localhost:11434/v1/chat/completions';
    expect(ollamaUrl).toMatch(/^https?:\/\//);
    expect(ollamaUrl).toContain('localhost');
  });
});

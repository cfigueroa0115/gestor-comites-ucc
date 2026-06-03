import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAIProvider, getProviderName } from './factory';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { FallbackProvider } from './fallback.provider';

describe('createAIProvider', () => {
  const originalEnv = process.env.AI_PROVIDER;
  const originalApiKey = process.env.AI_API_KEY;

  beforeEach(() => {
    delete process.env.AI_PROVIDER;
    // OpenAI SDK v6 requires API key at instantiation
    process.env.AI_API_KEY = 'test-key-for-factory';
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.AI_PROVIDER = originalEnv;
    } else {
      delete process.env.AI_PROVIDER;
    }
    if (originalApiKey !== undefined) {
      process.env.AI_API_KEY = originalApiKey;
    } else {
      delete process.env.AI_API_KEY;
    }
  });

  it('returns OpenAIProvider when AI_PROVIDER is "openai"', () => {
    process.env.AI_PROVIDER = 'openai';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('returns OpenAIProvider when AI_PROVIDER is "OpenAI" (case-insensitive)', () => {
    process.env.AI_PROVIDER = 'OpenAI';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('returns AnthropicProvider when AI_PROVIDER is "anthropic"', () => {
    process.env.AI_PROVIDER = 'anthropic';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('returns AnthropicProvider when AI_PROVIDER is "Anthropic" (case-insensitive)', () => {
    process.env.AI_PROVIDER = 'Anthropic';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('returns FallbackProvider when AI_PROVIDER is empty string', () => {
    process.env.AI_PROVIDER = '';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(FallbackProvider);
  });

  it('returns FallbackProvider when AI_PROVIDER is unset', () => {
    delete process.env.AI_PROVIDER;
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(FallbackProvider);
  });

  it('returns FallbackProvider when AI_PROVIDER is "fallback"', () => {
    process.env.AI_PROVIDER = 'fallback';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(FallbackProvider);
  });

  it('returns FallbackProvider for unknown provider values', () => {
    process.env.AI_PROVIDER = 'unknown-provider';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(FallbackProvider);
  });

  it('trims whitespace from AI_PROVIDER value', () => {
    process.env.AI_PROVIDER = '  openai  ';
    const provider = createAIProvider();
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });
});

describe('getProviderName', () => {
  const originalEnv = process.env.AI_PROVIDER;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.AI_PROVIDER = originalEnv;
    } else {
      delete process.env.AI_PROVIDER;
    }
  });

  it('returns "openai" when AI_PROVIDER is "openai"', () => {
    process.env.AI_PROVIDER = 'openai';
    expect(getProviderName()).toBe('openai');
  });

  it('returns "anthropic" when AI_PROVIDER is "anthropic"', () => {
    process.env.AI_PROVIDER = 'anthropic';
    expect(getProviderName()).toBe('anthropic');
  });

  it('returns "fallback" when AI_PROVIDER is empty', () => {
    process.env.AI_PROVIDER = '';
    expect(getProviderName()).toBe('fallback');
  });

  it('returns "fallback" when AI_PROVIDER is unset', () => {
    delete process.env.AI_PROVIDER;
    expect(getProviderName()).toBe('fallback');
  });
});

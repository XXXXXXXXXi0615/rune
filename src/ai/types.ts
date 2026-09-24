import type { AIProvider, ProviderType } from '@/types';
import type { ProviderRequestType } from '@/features/apiUsage/apiUsageTypes';

export type { AIProvider };

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'image'; inlineData: { mimeType: string; data: string } };

export interface ChatMessage {
  role: ChatRole;
  content: string | ContentPart[];
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  responseMeta?: { status: number; contentType?: string; requestId?: string; finishReason?: string };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cachedInputTokens?: number;
    cacheCreationTokens?: number;
    totalTokens?: number;
    estimated: boolean;
  };
  finalToolCalls?: ToolCall[];
}

/* ── Tool types ── */

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolCall {
  id: string;
  type?: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  content: string | ContentPart[];
}

export interface AIRequestConfig {
  provider: AIProvider;
  providerConfigId?: string;
  providerType?: ProviderType;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  systemPrompt: string;
  streamingEnabled?: boolean;
  chatEndpoint?: string;
  apiKeyOptional?: boolean;
  /** Defaults to true. Pre-auth isolated transports may explicitly disable local usage writes. */
  persistUsage?: boolean;
  tools?: ToolDefinition[];
  telemetry?: {
    requestId?: string;
    operationId?: string;
    conversationId?: string;
    requestType?: ProviderRequestType;
    attempt?: number;
    toolRound?: number;
  };
}

export class AIProviderHttpError extends Error {
  readonly status: number;
  readonly retryAfter?: string;
  readonly contentType?: string;

  constructor(message: string, response: Pick<Response, 'status' | 'headers'>) {
    super(message);
    this.name = 'AIProviderHttpError';
    this.status = response.status;
    this.retryAfter = response.headers.get('retry-after') || undefined;
    this.contentType = response.headers.get('content-type') || undefined;
  }
}

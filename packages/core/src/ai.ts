// The AI-provider contract shared by every client. Keys are never stored
// server-side — clients send provider/model/key per request as X-AI-* headers
// (see server AiService), so this list, the default models, and the header
// shape are duplicated identically across web/, rn/, and extension/. Single-source
// them here.

export type AIProvider =
  | 'gemini'
  | 'openai'
  | 'claude'
  | 'deepseek'
  | 'kimi'
  | 'doubao'
  | 'grok'
  | 'qwen'
  | 'wenxin';

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  claude: 'claude-sonnet-4-5',
  deepseek: 'deepseek-chat',
  kimi: 'moonshot-v1-8k',
  doubao: 'doubao-pro-32k',
  grok: 'grok-3',
  qwen: 'qwen-plus',
  wenxin: 'ernie-4.0-8k',
};

/** The stored multi-provider settings (web + rn keep a key/model per provider). */
export interface AISettings {
  provider: AIProvider;
  keys: Partial<Record<AIProvider, string>>;
  models: Partial<Record<AIProvider, string>>;
}

/** The resolved per-request trio that becomes the X-AI-* headers. */
export interface ResolvedAiSettings {
  provider: string;
  model: string;
  key: string;
}

/** Build the X-AI-* request headers from a resolved trio. Omits the key header when empty. */
export function buildAiHeaders(settings: { provider: string; model: string; key?: string }): Record<string, string> {
  const headers: Record<string, string> = {
    'X-AI-Provider': settings.provider,
    'X-AI-Model': settings.model,
  };
  if (settings.key) headers['X-AI-Key'] = settings.key;
  return headers;
}

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

/** Settings-screen metadata per provider (web AiServicesTab + rn ai-services). */
export interface AiProviderInfo {
  id: AIProvider;
  label: string;
  shortLabel: string;
  placeholder: string;
  docsHint: string;
  badge?: string;
}

export const AI_PROVIDERS: AiProviderInfo[] = [
  { id: 'gemini', label: 'Google Gemini', shortLabel: 'Gemini', placeholder: 'AIza...', docsHint: 'aistudio.google.com' },
  { id: 'openai', label: 'OpenAI', shortLabel: 'OpenAI', placeholder: 'sk-...', docsHint: 'platform.openai.com' },
  { id: 'claude', label: 'Anthropic Claude', shortLabel: 'Claude', placeholder: 'sk-ant-...', docsHint: 'console.anthropic.com' },
  { id: 'grok', label: 'xAI Grok', shortLabel: 'Grok', placeholder: 'xai-...', docsHint: 'console.x.ai' },
  { id: 'deepseek', label: 'DeepSeek', shortLabel: 'DeepSeek', placeholder: 'sk-...', docsHint: 'platform.deepseek.com', badge: 'Low cost' },
  { id: 'kimi', label: 'Kimi AI', shortLabel: 'Kimi', placeholder: 'sk-...', docsHint: 'platform.moonshot.cn' },
  { id: 'doubao', label: 'Doubao', shortLabel: 'Doubao', placeholder: 'your-doubao-key', docsHint: 'console.volcengine.com' },
  { id: 'qwen', label: 'Alibaba Qwen', shortLabel: 'Qwen', placeholder: 'sk-...', docsHint: 'dashscope.aliyuncs.com' },
  { id: 'wenxin', label: 'Wenxin Yiyan', shortLabel: 'Wenxin', placeholder: 'bce-v3/ALXXXXXXXXXX/...', docsHint: 'console.bce.baidu.com/qianfan' },
];

export const AI_PROVIDER_IDS: AIProvider[] = AI_PROVIDERS.map((p) => p.id);

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

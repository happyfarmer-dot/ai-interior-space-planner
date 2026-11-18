export type AIMode = 'mock' | 'live';

export interface AIServiceConfig {
  mode: AIMode;
  vlmEndpoint: string;
  vlmApiKeySet: boolean;
  diffusionEndpoint: string;
  diffusionApiKeySet: boolean;
  llmEndpoint: string;
  llmApiKeySet: boolean;
}

export function getAIServiceConfig(): AIServiceConfig {
  const rawMode = import.meta.env.VITE_AI_MODE;
  const hasAnyKey = Boolean(
    import.meta.env.VITE_VLM_API_KEY ||
      import.meta.env.VITE_DIFFUSION_API_KEY ||
      import.meta.env.VITE_LLM_API_KEY
  );
  const mode: AIMode = rawMode === 'live' && hasAnyKey ? 'live' : 'mock';

  return {
    mode,
    vlmEndpoint:
      import.meta.env.VITE_VLM_API_URL || 'https://api.openai.com/v1/chat/completions',
    vlmApiKeySet: Boolean(import.meta.env.VITE_VLM_API_KEY),
    diffusionEndpoint:
      import.meta.env.VITE_DIFFUSION_API_URL || 'https://api.replicate.com/v1/predictions',
    diffusionApiKeySet: Boolean(import.meta.env.VITE_DIFFUSION_API_KEY),
    llmEndpoint:
      import.meta.env.VITE_LLM_API_URL || 'https://api.openai.com/v1/chat/completions',
    llmApiKeySet: Boolean(import.meta.env.VITE_LLM_API_KEY),
  };
}

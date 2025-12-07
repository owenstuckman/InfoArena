/**
 * Grok API Service (xAI)
 * Uses the xAI API to generate knowledge content
 * API Docs: https://docs.x.ai/
 */

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';

// Note: In production, API calls should go through your backend/edge functions
// to keep API keys secure. This is for reference only.

export interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GrokResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface GrokOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are Grokipedia, a knowledgeable AI encyclopedia. Provide factual, comprehensive information about topics. Be informative yet accessible. Structure your responses clearly with key facts and context. Keep responses concise but thorough (2-3 paragraphs unless more detail is specifically requested).`;

/**
 * Generate content using Grok API
 * Note: This should be called from server-side/edge functions in production
 */
export async function generateGrokContent(
  prompt: string,
  apiKey: string,
  options: GrokOptions = {}
): Promise<string> {
  const {
    model = 'grok-2-latest',
    temperature = 0.3,
    maxTokens = 500,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
  } = options;

  try {
    const response = await fetch(XAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Grok API error: ${response.status} - ${error}`);
    }

    const data: GrokResponse = await response.json();
    return data.choices[0]?.message?.content || 'No response generated.';
  } catch (error) {
    console.error('Grok API error:', error);
    throw error;
  }
}

/**
 * Get Grokipedia content for a topic
 * This is a wrapper that formats the prompt for encyclopedia-style content
 */
export async function getGrokipediaContent(
  topic: string,
  apiKey: string
): Promise<string> {
  return generateGrokContent(
    `Explain: ${topic}`,
    apiKey,
    {
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      temperature: 0.3,
      maxTokens: 500,
    }
  );
}

/**
 * Blend multiple knowledge sources using Grok
 */
export async function blendKnowledgeSources(
  sources: { name: string; content: string; weight: number }[],
  apiKey: string,
  formatPrompt?: string
): Promise<string> {
  const sourceText = sources
    .map(s => `[${s.name} (weight: ${(s.weight * 100).toFixed(0)}%)]:\n${s.content}`)
    .join('\n\n---\n\n');

  const systemPrompt = `You are a knowledge synthesizer. Blend the following sources according to their weights, prioritizing information from higher-weighted sources. ${formatPrompt || 'Provide a balanced, comprehensive response that combines the best aspects of each source.'}

When blending:
- Give more prominence to higher-weighted sources
- Resolve contradictions by favoring higher-weighted sources
- Maintain factual accuracy
- Create a cohesive, well-structured response
- Cite which source provided key information when relevant`;

  return generateGrokContent(sourceText, apiKey, {
    systemPrompt,
    temperature: 0.5,
    maxTokens: 800,
  });
}

/**
 * Verify claims across sources using Grok
 */
export async function verifyClaims(
  sources: { name: string; content: string }[],
  apiKey: string
): Promise<{
  claims: {
    text: string;
    sources: string[];
    confidence: 'high' | 'medium' | 'low' | 'disputed';
  }[];
}> {
  const sourceText = sources
    .map(s => `[${s.name}]:\n${s.content}`)
    .join('\n\n---\n\n');

  const systemPrompt = `You are a fact-checker. Analyze the following sources and extract claims, noting which sources support each claim.

For each claim, determine:
- "high" confidence: All sources agree
- "medium" confidence: Most sources agree
- "low" confidence: Only one source mentions it
- "disputed": Sources contradict each other

Respond in JSON format:
{
  "claims": [
    {
      "text": "The claim text",
      "sources": ["Source1", "Source2"],
      "confidence": "high|medium|low|disputed"
    }
  ]
}`;

  const response = await generateGrokContent(sourceText, apiKey, {
    systemPrompt,
    temperature: 0.2,
    maxTokens: 1000,
  });

  try {
    // Try to parse JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse claims response:', e);
  }

  return { claims: [] };
}

/**
 * Check if Grok API is available (has API key)
 */
export function isGrokAvailable(): boolean {
  // In browser, we can't access API keys directly
  // This would need to check via a server endpoint
  return false;
}

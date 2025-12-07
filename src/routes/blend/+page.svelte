<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { supabase, isSupabaseConfigured } from '$lib/supabaseClient';
  import { authStore, isAuthenticated, currentUser } from '$lib/stores/auth';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import { 
    fetchContentFromSource, 
    searchWikipedia,
    getSourceLogo,
    getSourceColor,
    type SourceSlug,
    type SourceContent 
  } from '$lib/services/content';
  import type { Source } from '$lib/types/database';

  // Types
  interface BlendConfig {
    weights: Record<string, number>;
    style: string;
    customPrompt: string;
  }

  // Constants
  const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
  
  const OUTPUT_STYLES = [
    { value: 'balanced', label: 'Balanced', desc: 'Mix of detail and brevity' },
    { value: 'concise', label: 'Concise', desc: 'Short and to the point' },
    { value: 'detailed', label: 'Detailed', desc: 'Comprehensive coverage' },
    { value: 'academic', label: 'Academic', desc: 'Scholarly tone with structure' },
    { value: 'casual', label: 'Casual', desc: 'Friendly and conversational' },
    { value: 'eli5', label: 'ELI5', desc: 'Explain like I\'m 5' },
  ];

  const PRESET_FORMATS = [
    { label: 'None', value: '' },
    { label: 'Bullet points', value: 'Use bullet points for key facts' },
    { label: 'Numbered list', value: 'Present information as a numbered list' },
    { label: 'Q&A format', value: 'Present as questions and answers' },
    { label: 'Timeline', value: 'Present chronologically as a timeline' },
    { label: 'Pros & Cons', value: 'Organize into pros and cons' },
    { label: 'Compare & Contrast', value: 'Compare and contrast different aspects' },
  ];

  // State
  let sources: Source[] = [];
  let weights: Record<string, number> = {};
  let enabledSources: Record<string, boolean> = {};
  let query = '';
  let outputStyle = 'balanced';
  let customPrompt = '';
  let selectedPreset = '';
  let result = '';
  let loading = false;
  let loadingPhase = '';
  let error = '';
  let showAuthModal = false;
  let searchResults: { title: string; description: string }[] = [];
  let isSearching = false;
  let searchTimeout: ReturnType<typeof setTimeout>;
  let fetchedContents: Record<string, SourceContent> = {};
  let blendHistory: { query: string; result: string; timestamp: Date }[] = [];

  // Helpers
  function getLogo(slug: string): string {
    return getSourceLogo(slug as SourceSlug);
  }
  
  function getColor(slug: string): string {
    return getSourceColor(slug as SourceSlug);
  }

  onMount(async () => {
    await authStore.init();
    await loadSources();
  });

  async function loadSources() {
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('sources')
        .select('*')
        .eq('is_active', true);
      if (data && data.length >= 2) {
        sources = data;
      }
    }
    
    // Fallback to demo sources
    if (sources.length < 2) {
      sources = [
        { id: 'demo-wiki', name: 'Wikipedia', slug: 'wikipedia', description: 'The free encyclopedia', rating: 1500, rating_deviation: 350, volatility: 0.06, total_matches: 0, total_wins: 0, total_losses: 0, total_ties: 0, is_active: true, api_endpoint: null, api_config: {}, logo_url: null, created_at: '', updated_at: '' },
        { id: 'demo-grok', name: 'Grokipedia', slug: 'grokipedia', description: 'AI-powered knowledge', rating: 1500, rating_deviation: 350, volatility: 0.06, total_matches: 0, total_wins: 0, total_losses: 0, total_ties: 0, is_active: true, api_endpoint: null, api_config: {}, logo_url: null, created_at: '', updated_at: '' },
        { id: 'demo-brit', name: 'Encyclopedia Britannica', slug: 'britannica', description: 'Trusted since 1768', rating: 1500, rating_deviation: 350, volatility: 0.06, total_matches: 0, total_wins: 0, total_losses: 0, total_ties: 0, is_active: true, api_endpoint: null, api_config: {}, logo_url: null, created_at: '', updated_at: '' },
      ];
    }
    
    // Initialize weights and enabled state
    sources.forEach(s => {
      weights[s.id] = 1 / sources.length;
      enabledSources[s.id] = true;
    });
    weights = { ...weights };
    enabledSources = { ...enabledSources };
  }

  function toggleSource(sourceId: string) {
    enabledSources[sourceId] = !enabledSources[sourceId];
    enabledSources = { ...enabledSources };
    normalizeWeights();
  }

  function updateWeight(sourceId: string, value: number) {
    weights[sourceId] = value / 100;
    normalizeWeights();
  }

  function normalizeWeights() {
    const enabledIds = Object.entries(enabledSources)
      .filter(([_, enabled]) => enabled)
      .map(([id]) => id);
    
    const total = enabledIds.reduce((sum, id) => sum + (weights[id] || 0), 0);
    
    if (total > 0) {
      enabledIds.forEach(id => {
        weights[id] = weights[id] / total;
      });
    }
    weights = { ...weights };
  }

  function resetWeights() {
    const enabledCount = Object.values(enabledSources).filter(Boolean).length;
    sources.forEach(s => {
      if (enabledSources[s.id]) {
        weights[s.id] = 1 / enabledCount;
      }
    });
    weights = { ...weights };
  }

  async function handleSearch() {
    if (!query.trim()) {
      searchResults = [];
      return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      isSearching = true;
      try {
        searchResults = await searchWikipedia(query, 6);
      } catch (e) {
        console.error('Search error:', e);
        searchResults = [];
      }
      isSearching = false;
    }, 300);
  }

  function selectTopic(topic: string) {
    query = topic;
    searchResults = [];
  }

  async function blend() {
    if (!query.trim()) {
      error = 'Please enter a topic or question';
      return;
    }

    const enabledSourceList = sources.filter(s => enabledSources[s.id]);
    if (enabledSourceList.length === 0) {
      error = 'Please enable at least one source';
      return;
    }

    loading = true;
    error = '';
    result = '';
    fetchedContents = {};

    try {
      // Phase 1: Fetch content from all enabled sources
      loadingPhase = 'Fetching content from sources...';
      
      const contentPromises = enabledSourceList.map(async (source) => {
        const content = await fetchContentFromSource(query, source.slug as SourceSlug);
        if (content) {
          fetchedContents[source.id] = content;
        }
        return { source, content };
      });

      const results = await Promise.all(contentPromises);
      
      // Phase 2: Blend with Grok
      loadingPhase = 'Blending knowledge with AI...';
      
      const blendedResult = await blendWithGrok(results.filter(r => r.content !== null));
      
      result = blendedResult;
      
      // Save to history
      blendHistory = [
        { query, result: blendedResult, timestamp: new Date() },
        ...blendHistory.slice(0, 9)
      ];

    } catch (e) {
      console.error('Blend error:', e);
      error = e instanceof Error ? e.message : 'Failed to blend knowledge';
    } finally {
      loading = false;
      loadingPhase = '';
    }
  }

  async function blendWithGrok(
    sourceContents: { source: Source; content: SourceContent | null }[]
  ): Promise<string> {
    // Build the context from all sources
    const sourceContexts = sourceContents
      .filter(sc => sc.content)
      .map(sc => {
        const weight = Math.round(weights[sc.source.id] * 100);
        const truncatedContent = sc.content!.content.substring(0, 4000);
        return `### Source: ${sc.source.name} (Weight: ${weight}%)
${truncatedContent}`;
      })
      .join('\n\n---\n\n');

    // Build style instruction
    const styleInstructions: Record<string, string> = {
      balanced: 'Provide a balanced mix of detail and brevity. Be informative but not overwhelming.',
      concise: 'Be extremely concise. Get straight to the point with minimal elaboration.',
      detailed: 'Provide comprehensive coverage with examples, context, and thorough explanations.',
      academic: 'Use a scholarly, formal tone. Structure with clear sections and maintain objectivity.',
      casual: 'Write in a friendly, conversational tone. Use simple language and relatable examples.',
      eli5: 'Explain like I\'m 5 years old. Use very simple words, analogies, and short sentences.',
    };

    const stylePrompt = styleInstructions[outputStyle] || styleInstructions.balanced;
    const formatPrompt = customPrompt || selectedPreset;

    // Build the full prompt
    const systemPrompt = `You are a knowledge synthesizer that blends information from multiple encyclopedia sources into a unified, coherent response.

CRITICAL RULES:
1. Do NOT mention the source names in your response
2. Do NOT say "according to Source A" or reference sources by name
3. Synthesize the information naturally as if writing an original article
4. When sources conflict, prefer information from higher-weighted sources
5. Use markdown formatting (headings, lists, bold) appropriately
6. Include tables if the source content contains tabular data

OUTPUT STYLE: ${stylePrompt}
${formatPrompt ? `FORMAT INSTRUCTIONS: ${formatPrompt}` : ''}

Your response should be a well-structured article about the topic that combines the best information from all sources.`;

    const userPrompt = `Topic: ${query}

Here is the content from multiple knowledge sources. Please synthesize this into a single, unified article:

${sourceContexts}

Remember: Do NOT mention source names. Write as if this is original content.`;

    // Try to use xAI API if available, otherwise use demo mode
    const xaiApiKey = browser ? (window as any).__XAI_API_KEY__ : null;
    
    if (xaiApiKey) {
      try {
        const response = await fetch(XAI_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${xaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'grok-2-latest',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.3,
            max_tokens: 3000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return data.choices?.[0]?.message?.content || generateDemoBlend(sourceContents);
        }
      } catch (e) {
        console.error('Grok API error:', e);
      }
    }

    // Demo mode - create a synthesized response
    return generateDemoBlend(sourceContents);
  }

  function generateDemoBlend(
    sourceContents: { source: Source; content: SourceContent | null }[]
  ): string {
    const validContents = sourceContents.filter(sc => sc.content);
    
    if (validContents.length === 0) {
      return `# ${query}\n\nNo content available from the selected sources.`;
    }

    // Find the highest weighted source with content
    let primaryContent = validContents[0];
    let maxWeight = 0;
    
    validContents.forEach(sc => {
      const weight = weights[sc.source.id] || 0;
      if (weight > maxWeight) {
        maxWeight = weight;
        primaryContent = sc;
      }
    });

    // Build a blended response
    const intro = `# ${query}

This is a synthesized article combining information from ${validContents.length} knowledge source${validContents.length > 1 ? 's' : ''}.

`;

    // Extract key sections from primary source
    const primaryText = primaryContent.content!.content;
    
    // Add style-specific formatting
    let styledContent = primaryText;
    
    if (outputStyle === 'concise') {
      // Take just the first few paragraphs
      const paragraphs = primaryText.split('\n\n').slice(0, 4);
      styledContent = paragraphs.join('\n\n');
    } else if (outputStyle === 'eli5') {
      styledContent = `${primaryText}\n\n---\n\n*In simple terms:* This topic is about ${query}. It's an interesting subject that many people find useful to learn about!`;
    }

    // Add custom format note if provided
    const formatNote = customPrompt || selectedPreset;
    if (formatNote) {
      styledContent += `\n\n---\n\n*Format applied: ${formatNote}*`;
    }

    // Add source weight info at the bottom
    const weightInfo = validContents
      .map(sc => `- ${sc.source.name}: ${Math.round(weights[sc.source.id] * 100)}%`)
      .join('\n');

    return `${intro}${styledContent}\n\n---\n\n**Sources blended:**\n${weightInfo}\n\n*Note: In production with an xAI API key configured, this would be a fully AI-synthesized response that intelligently combines all sources.*`;
  }

  function clearResult() {
    result = '';
    fetchedContents = {};
  }

  function loadFromHistory(item: { query: string; result: string }) {
    query = item.query;
    result = item.result;
  }
</script>

<svelte:head>
  <title>Knowledge Blender - WikiArena</title>
</svelte:head>

<AuthModal bind:open={showAuthModal} />

<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <!-- Header -->
  <div class="text-center mb-8">
    <h1 class="text-2xl font-bold mb-2">Knowledge Blender</h1>
    <p class="text-slate-400 text-sm">Blend multiple knowledge sources into a single, customized response</p>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
    <!-- Left Sidebar - Configuration -->
    <div class="lg:col-span-3 space-y-6">
      <!-- Source Selection & Weights -->
      <div class="arena-card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-semibold">Sources</h2>
          <button 
            class="text-xs text-slate-500 hover:text-slate-300"
            on:click={resetWeights}
          >
            Reset
          </button>
        </div>
        
        <div class="space-y-4">
          {#each sources as source (source.id)}
            <div class="p-3 rounded-lg {enabledSources[source.id] ? 'bg-slate-800/50' : 'bg-slate-900/30 opacity-60'}">
              <div class="flex items-center gap-3 mb-2">
                <button
                  class="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                    {enabledSources[source.id] 
                      ? 'bg-amber-500 border-amber-500 text-slate-900' 
                      : 'border-slate-600 hover:border-slate-500'}"
                  on:click={() => toggleSource(source.id)}
                >
                  {#if enabledSources[source.id]}
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  {/if}
                </button>
                <img src={getLogo(source.slug)} alt="" class="w-5 h-5 object-contain" />
                <span class="text-sm font-medium {getColor(source.slug)}">{source.name}</span>
              </div>
              
              {#if enabledSources[source.id]}
                <div class="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(weights[source.id] * 100)}
                    on:input={(e) => updateWeight(source.id, parseInt(e.currentTarget.value))}
                    class="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none
                      [&::-webkit-slider-thumb]:w-3
                      [&::-webkit-slider-thumb]:h-3
                      [&::-webkit-slider-thumb]:rounded-full
                      [&::-webkit-slider-thumb]:bg-amber-500
                      [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                  <span class="text-xs text-amber-400 font-mono w-10 text-right">
                    {Math.round(weights[source.id] * 100)}%
                  </span>
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <!-- Output Style -->
      <div class="arena-card">
        <h2 class="font-semibold mb-4">Output Style</h2>
        <div class="grid grid-cols-2 gap-2">
          {#each OUTPUT_STYLES as style}
            <button
              class="text-left p-2 rounded-lg transition-all text-xs
                {outputStyle === style.value 
                  ? 'bg-amber-500/20 border border-amber-500/50' 
                  : 'bg-slate-800/50 border border-transparent hover:bg-slate-700/50'}"
              on:click={() => outputStyle = style.value}
            >
              <span class="font-medium">{style.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Format Presets -->
      <div class="arena-card">
        <h2 class="font-semibold mb-4">Format</h2>
        <select
          bind:value={selectedPreset}
          class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm
            focus:outline-none focus:border-amber-500/50"
        >
          {#each PRESET_FORMATS as preset}
            <option value={preset.value}>{preset.label}</option>
          {/each}
        </select>
        
        <div class="mt-3">
          <label class="text-xs text-slate-500 mb-1 block">Custom instructions</label>
          <textarea
            bind:value={customPrompt}
            placeholder="e.g., 'Focus on recent developments'..."
            class="w-full h-16 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg
              text-xs placeholder-slate-500 resize-none
              focus:outline-none focus:border-amber-500/50"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- Main Panel -->
    <div class="lg:col-span-9 space-y-6">
      <!-- Query Input -->
      <div class="arena-card">
        <h2 class="font-semibold mb-4">What do you want to know?</h2>
        <div class="relative">
          <input
            type="text"
            bind:value={query}
            on:input={handleSearch}
            placeholder="Enter a topic or question..."
            class="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl
              placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-lg"
            on:keydown={(e) => e.key === 'Enter' && !isSearching && blend()}
          />
          {#if isSearching}
            <div class="absolute right-4 top-1/2 -translate-y-1/2">
              <div class="animate-spin h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full"></div>
            </div>
          {/if}
        </div>

        <!-- Search Suggestions -->
        {#if searchResults.length > 0}
          <div class="mt-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div class="flex flex-wrap gap-2">
              {#each searchResults as result}
                <button
                  class="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-sm transition-colors"
                  on:click={() => selectTopic(result.title)}
                >
                  {result.title}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <div class="flex items-center justify-between mt-4">
          <div class="text-sm text-slate-500">
            {#if Object.values(enabledSources).filter(Boolean).length > 0}
              Blending {Object.values(enabledSources).filter(Boolean).length} source{Object.values(enabledSources).filter(Boolean).length > 1 ? 's' : ''}
            {:else}
              No sources selected
            {/if}
          </div>
          <button
            class="vote-btn vote-btn-primary"
            disabled={loading || !query.trim() || Object.values(enabledSources).filter(Boolean).length === 0}
            on:click={blend}
          >
            {#if loading}
              <span class="inline-flex items-center gap-2">
                <div class="animate-spin h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full"></div>
                Blending...
              </span>
            {:else}
              Blend Knowledge
            {/if}
          </button>
        </div>
        
        {#if error}
          <p class="mt-3 text-sm text-red-400">{error}</p>
        {/if}
      </div>

      <!-- Loading State -->
      {#if loading}
        <div class="arena-card">
          <div class="flex flex-col items-center justify-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-4 border-amber-500/30 border-t-amber-500"></div>
            <p class="text-slate-400 mt-6">{loadingPhase}</p>
            <div class="flex items-center gap-2 mt-4">
              {#each sources.filter(s => enabledSources[s.id]) as source}
                <div class="flex items-center gap-1 px-2 py-1 bg-slate-800/50 rounded-full text-xs">
                  <img src={getLogo(source.slug)} alt="" class="w-4 h-4 object-contain" />
                  <span class="{fetchedContents[source.id] ? 'text-green-400' : 'text-slate-500'}">
                    {fetchedContents[source.id] ? '✓' : '...'}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        </div>

      <!-- Result -->
      {:else if result}
        <div class="arena-card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold">Blended Result</h2>
            <button
              class="text-sm text-slate-500 hover:text-slate-300"
              on:click={clearResult}
            >
              Clear
            </button>
          </div>
          
          <div class="max-h-[70vh] overflow-y-auto scrollbar-thin">
            <Markdown content={result} />
          </div>
        </div>

      <!-- Empty State -->
      {:else}
        <div class="arena-card">
          <div class="flex flex-col items-center justify-center py-12 text-center">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-4">
              <svg class="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">Blend Knowledge Sources</h3>
            <p class="text-slate-400 text-sm max-w-md">
              Enter a topic to combine information from multiple encyclopedias into a single, unified article tailored to your preferences.
            </p>
            
            <div class="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-xl">
              <button 
                class="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors text-left"
                on:click={() => { query = 'Quantum Computing'; blend(); }}
              >
                <div class="font-medium text-sm">Quantum Computing</div>
                <div class="text-xs text-slate-500">Technology</div>
              </button>
              <button 
                class="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors text-left"
                on:click={() => { query = 'Climate Change'; blend(); }}
              >
                <div class="font-medium text-sm">Climate Change</div>
                <div class="text-xs text-slate-500">Science</div>
              </button>
              <button 
                class="p-3 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors text-left"
                on:click={() => { query = 'Renaissance Art'; blend(); }}
              >
                <div class="font-medium text-sm">Renaissance Art</div>
                <div class="text-xs text-slate-500">History</div>
              </button>
            </div>
          </div>
        </div>
      {/if}

      <!-- Recent Blends -->
      {#if blendHistory.length > 0 && !loading}
        <div class="arena-card">
          <h2 class="font-semibold mb-4">Recent Blends</h2>
          <div class="flex flex-wrap gap-2">
            {#each blendHistory as item}
              <button
                class="px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg text-sm transition-colors"
                on:click={() => loadFromHistory(item)}
              >
                {item.query}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Info Box -->
      <div class="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50">
        <h3 class="font-medium mb-3 text-sm text-slate-300">How the Blender Works</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-slate-400">
          <div>
            <span class="text-amber-400 font-medium">1. Fetch</span>
            <p class="text-xs mt-1">Content is retrieved from each enabled source for your topic.</p>
          </div>
          <div>
            <span class="text-amber-400 font-medium">2. Weight</span>
            <p class="text-xs mt-1">Higher-weighted sources have more influence on the final result.</p>
          </div>
          <div>
            <span class="text-amber-400 font-medium">3. Synthesize</span>
            <p class="text-xs mt-1">AI combines all sources into a unified article with your preferred style.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

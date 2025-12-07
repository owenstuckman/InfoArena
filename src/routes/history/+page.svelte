<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { supabase, isSupabaseConfigured, getSessionId } from '$lib/supabaseClient';
  import { authStore, isAuthenticated, currentUser } from '$lib/stores/auth';
  import AuthModal from '$lib/components/AuthModal.svelte';
  import { getSourceLogo, getSourceColor, type SourceSlug } from '$lib/services/content';

  interface VoteRecord {
    id: string;
    created_at: string;
    winner: string;
    time_to_vote_ms: number | null;
    source_a_rating_before: number;
    source_a_rating_after: number;
    source_b_rating_before: number;
    source_b_rating_after: number;
    match: {
      topic_query: string;
      source_a: { name: string; slug: string };
      source_b: { name: string; slug: string };
    };
  }

  interface UserStats {
    totalVotes: number;
    sourcesCompared: Set<string>;
    favoriteSource: string | null;
    avgTimeToVote: number;
    votesThisWeek: number;
  }

  let showAuthModal = false;
  let votes: VoteRecord[] = [];
  let stats: UserStats = {
    totalVotes: 0,
    sourcesCompared: new Set(),
    favoriteSource: null,
    avgTimeToVote: 0,
    votesThisWeek: 0,
  };
  let loading = true;
  let error: string | null = null;
  let hasLoadedOnce = false;

  onMount(async () => {
    await authStore.init();
    loading = false;
  });

  // React to auth changes - only load once user is fully authenticated
  $: if (browser && $isAuthenticated && $currentUser && !hasLoadedOnce) {
    hasLoadedOnce = true;
    loadVoteHistory();
  }
  
  // Reset when user logs out
  $: if (browser && !$isAuthenticated) {
    hasLoadedOnce = false;
    votes = [];
    stats = {
      totalVotes: 0,
      sourcesCompared: new Set(),
      favoriteSource: null,
      avgTimeToVote: 0,
      votesThisWeek: 0,
    };
  }

  function handleAuthSuccess() {
    // Reset flag so reactive statement can trigger
    hasLoadedOnce = false;
  }

  async function loadVoteHistory() {
    if (!isSupabaseConfigured || !$currentUser?.id) {
      return;
    }

    loading = true;
    error = null;

    try {
      // Get votes for the current user
      const { data, error: fetchError } = await supabase
        .from('votes')
        .select(`
          id,
          created_at,
          winner,
          time_to_vote_ms,
          source_a_rating_before,
          source_a_rating_after,
          source_b_rating_before,
          source_b_rating_after,
          match:matches (
            topic_query,
            source_a:sources!matches_source_a_id_fkey (name, slug),
            source_b:sources!matches_source_b_id_fkey (name, slug)
          )
        `)
        .eq('user_id', $currentUser.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (fetchError) throw fetchError;

      votes = (data || []) as unknown as VoteRecord[];
      calculateStats();
    } catch (e) {
      console.error('Error loading vote history:', e);
      error = e instanceof Error ? e.message : 'Failed to load history';
    } finally {
      loading = false;
    }
  }

  function calculateStats() {
    const sourceWins: Record<string, number> = {};
    let totalTime = 0;
    let timeCount = 0;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    stats.sourcesCompared = new Set();
    stats.votesThisWeek = 0;

    for (const vote of votes) {
      // Track sources
      if (vote.match?.source_a?.slug) {
        stats.sourcesCompared.add(vote.match.source_a.slug);
      }
      if (vote.match?.source_b?.slug) {
        stats.sourcesCompared.add(vote.match.source_b.slug);
      }

      // Track wins
      if (vote.winner === 'a' && vote.match?.source_a?.name) {
        sourceWins[vote.match.source_a.name] = (sourceWins[vote.match.source_a.name] || 0) + 1;
      } else if (vote.winner === 'b' && vote.match?.source_b?.name) {
        sourceWins[vote.match.source_b.name] = (sourceWins[vote.match.source_b.name] || 0) + 1;
      }

      // Track time
      if (vote.time_to_vote_ms) {
        totalTime += vote.time_to_vote_ms;
        timeCount++;
      }

      // Count this week
      if (new Date(vote.created_at) > oneWeekAgo) {
        stats.votesThisWeek++;
      }
    }

    stats.totalVotes = votes.length;
    stats.avgTimeToVote = timeCount > 0 ? Math.round(totalTime / timeCount / 1000) : 0;
    
    // Find favorite source
    let maxWins = 0;
    for (const [source, wins] of Object.entries(sourceWins)) {
      if (wins > maxWins) {
        maxWins = wins;
        stats.favoriteSource = source;
      }
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getWinnerDisplay(vote: VoteRecord): string {
    if (vote.winner === 'a') return vote.match?.source_a?.name || 'Source A';
    if (vote.winner === 'b') return vote.match?.source_b?.name || 'Source B';
    if (vote.winner === 'tie') return 'Tie';
    return 'Both Bad';
  }

  function getRatingChange(vote: VoteRecord, side: 'a' | 'b'): number {
    if (side === 'a') {
      return Math.round(vote.source_a_rating_after - vote.source_a_rating_before);
    }
    return Math.round(vote.source_b_rating_after - vote.source_b_rating_before);
  }

  // Helper to avoid TypeScript 'as' in template
  function getLogo(slug: string | undefined, fallback: string): string {
    return getSourceLogo((slug || fallback) as SourceSlug);
  }
  
  function getColor(slug: string | undefined, fallback: string): string {
    return getSourceColor((slug || fallback) as SourceSlug);
  }
</script>

<svelte:head>
  <title>Vote History - WikiArena</title>
</svelte:head>

<AuthModal bind:open={showAuthModal} on:success={handleAuthSuccess} />

<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  <div class="text-center mb-8">
    <h1 class="text-2xl font-bold mb-2">Vote History</h1>
    <p class="text-slate-400 text-sm">Track your comparisons and see your impact on the leaderboard</p>
  </div>

  {#if !$isAuthenticated}
    <!-- Sign In Prompt -->
    <div class="arena-card text-center py-12">
      <div class="w-12 h-12 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
        <svg class="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
      </div>
      <h2 class="text-xl font-semibold mb-2">Sign in to view your history</h2>
      <p class="text-slate-400 text-sm mb-6 max-w-md mx-auto">
        Create an account to track your votes, see your preferences, and maintain your comparison history across devices.
      </p>
      <button
        class="vote-btn vote-btn-primary"
        on:click={() => showAuthModal = true}
      >
        Sign In or Create Account
      </button>
      
      <p class="text-xs text-slate-500 mt-6">
        You can still vote without an account - your votes count toward the global leaderboard!
      </p>
    </div>

  {:else if loading}
    <div class="flex flex-col items-center justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mb-4"></div>
      <p class="text-slate-400">Loading your history...</p>
    </div>

  {:else if error}
    <div class="arena-card text-center py-12">
      <div class="w-12 h-12 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-4">
        <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <h2 class="text-lg font-semibold mb-2">Failed to load history</h2>
      <p class="text-slate-400 text-sm mb-4">{error}</p>
      <button class="vote-btn vote-btn-secondary" on:click={loadVoteHistory}>
        Try Again
      </button>
    </div>

  {:else}
    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="arena-card text-center">
        <div class="text-3xl font-bold text-amber-400">{stats.totalVotes}</div>
        <div class="text-sm text-slate-400">Total Votes</div>
      </div>
      <div class="arena-card text-center">
        <div class="text-3xl font-bold text-purple-400">{stats.sourcesCompared.size}</div>
        <div class="text-sm text-slate-400">Sources Compared</div>
      </div>
      <div class="arena-card text-center">
        <div class="text-3xl font-bold text-emerald-400">{stats.votesThisWeek}</div>
        <div class="text-sm text-slate-400">This Week</div>
      </div>
      <div class="arena-card text-center">
        <div class="text-3xl font-bold text-blue-400">{stats.avgTimeToVote}s</div>
        <div class="text-sm text-slate-400">Avg Decision Time</div>
      </div>
    </div>

    {#if stats.favoriteSource}
      <div class="arena-card mb-8">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-md bg-rose-500/10 flex items-center justify-center">
            <svg class="w-4 h-4 text-rose-400" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div>
            <div class="text-xs text-slate-500">Your Favorite Source</div>
            <div class="font-semibold">{stats.favoriteSource}</div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Vote History List -->
    <div class="arena-card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold">Recent Votes</h2>
        <button 
          class="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1"
          on:click={() => { hasLoadedOnce = false; loadVoteHistory(); }}
          disabled={loading}
        >
          <svg class="w-4 h-4 {loading ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      
      {#if votes.length === 0}
        <div class="text-center py-8 text-slate-400">
          <p>No votes yet. Head to the Arena to start comparing!</p>
          <a href="/arena" class="vote-btn vote-btn-primary mt-4 inline-block">
            Go to Arena
          </a>
        </div>
      {:else}
        <div class="space-y-4">
          {#each votes as vote}
            <div class="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium">{vote.match?.topic_query || 'Unknown Topic'}</span>
                <span class="text-xs text-slate-500">{formatDate(vote.created_at)}</span>
              </div>
              
              <div class="flex items-center gap-4 text-sm">
                <div class="flex items-center gap-2">
                  <img 
                    src={getLogo(vote.match?.source_a?.slug, 'wikipedia')} 
                    alt=""
                    class="w-5 h-5 object-contain"
                  />
                  <span class="{vote.winner === 'a' ? 'text-emerald-400 font-semibold' : 'text-slate-400'}">
                    {vote.match?.source_a?.name || 'Source A'}
                  </span>
                  <span class="text-xs {getRatingChange(vote, 'a') >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                    ({getRatingChange(vote, 'a') >= 0 ? '+' : ''}{getRatingChange(vote, 'a')})
                  </span>
                </div>
                
                <span class="text-slate-600">vs</span>
                
                <div class="flex items-center gap-2">
                  <img 
                    src={getLogo(vote.match?.source_b?.slug, 'grokipedia')} 
                    alt=""
                    class="w-5 h-5 object-contain"
                  />
                  <span class="{vote.winner === 'b' ? 'text-emerald-400 font-semibold' : 'text-slate-400'}">
                    {vote.match?.source_b?.name || 'Source B'}
                  </span>
                  <span class="text-xs {getRatingChange(vote, 'b') >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                    ({getRatingChange(vote, 'b') >= 0 ? '+' : ''}{getRatingChange(vote, 'b')})
                  </span>
                </div>
              </div>
              
              <div class="mt-2 text-xs text-slate-500">
                Winner: <span class="text-slate-300">{getWinnerDisplay(vote)}</span>
                {#if vote.time_to_vote_ms}
                  • Decided in {Math.round(vote.time_to_vote_ms / 1000)}s
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

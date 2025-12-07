<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authStore, currentUser } from '$lib/stores/auth';
  
  export let open = false;
  
  const dispatch = createEventDispatcher();
  
  let showChangePassword = false;
  let newPassword = '';
  let confirmPassword = '';
  let passwordError = '';
  let passwordSuccess = '';
  let loading = false;
  
  function close() {
    open = false;
    showChangePassword = false;
    newPassword = '';
    confirmPassword = '';
    passwordError = '';
    passwordSuccess = '';
  }
  
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest('.profile-dropdown')) {
      close();
    }
  }
  
  async function handleSignOut() {
    await authStore.signOut();
    close();
  }
  
  async function handleChangePassword() {
    passwordError = '';
    passwordSuccess = '';
    
    if (newPassword.length < 6) {
      passwordError = 'Password must be at least 6 characters';
      return;
    }
    
    if (newPassword !== confirmPassword) {
      passwordError = 'Passwords do not match';
      return;
    }
    
    loading = true;
    const { error } = await authStore.updatePassword(newPassword);
    loading = false;
    
    if (error) {
      passwordError = error;
    } else {
      passwordSuccess = 'Password updated successfully';
      newPassword = '';
      confirmPassword = '';
      setTimeout(() => {
        showChangePassword = false;
        passwordSuccess = '';
      }, 2000);
    }
  }
  
  async function handleResetPassword() {
    if (!$currentUser?.email) return;
    
    loading = true;
    const { error } = await authStore.resetPassword($currentUser.email);
    loading = false;
    
    if (error) {
      passwordError = error;
    } else {
      passwordSuccess = 'Password reset email sent!';
      setTimeout(() => {
        passwordSuccess = '';
      }, 3000);
    }
  }
  
  function getInitials(email: string): string {
    return email.charAt(0).toUpperCase();
  }
  
  function getDisplayName(email: string): string {
    return email.split('@')[0];
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="relative profile-dropdown">
  <!-- Profile Button -->
  <button
    class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
    on:click|stopPropagation={() => open = !open}
  >
    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-900 font-semibold text-sm">
      {getInitials($currentUser?.email || 'U')}
    </div>
    <span class="hidden sm:block text-sm text-slate-300 max-w-[120px] truncate">
      {getDisplayName($currentUser?.email || 'User')}
    </span>
    <svg 
      class="w-4 h-4 text-slate-500 transition-transform {open ? 'rotate-180' : ''}" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>
  
  <!-- Dropdown Menu -->
  {#if open}
    <div 
      class="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
      on:click|stopPropagation
    >
      <!-- User Info Header -->
      <div class="p-4 border-b border-slate-800">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-900 font-bold">
            {getInitials($currentUser?.email || 'U')}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium text-slate-200 truncate">
              {getDisplayName($currentUser?.email || 'User')}
            </div>
            <div class="text-xs text-slate-500 truncate">
              {$currentUser?.email}
            </div>
          </div>
        </div>
      </div>
      
      <!-- Menu Items -->
      {#if !showChangePassword}
        <div class="py-2">
          <!-- View History -->
          <a
            href="/history"
            class="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
            on:click={close}
          >
            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Vote History
          </a>
          
          <!-- Change Password -->
          <button
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
            on:click={() => showChangePassword = true}
          >
            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Change Password
          </button>
          
          <!-- Send Reset Email -->
          <button
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 transition-colors"
            on:click={handleResetPassword}
            disabled={loading}
          >
            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send Password Reset Email
          </button>
        </div>
        
        <div class="border-t border-slate-800 py-2">
          <!-- Sign Out -->
          <button
            class="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-800 transition-colors"
            on:click={handleSignOut}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
        
        <!-- Success/Error Messages -->
        {#if passwordSuccess}
          <div class="px-4 py-2 bg-emerald-500/10 border-t border-emerald-500/20">
            <p class="text-xs text-emerald-400">{passwordSuccess}</p>
          </div>
        {/if}
        
        {#if passwordError}
          <div class="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
            <p class="text-xs text-red-400">{passwordError}</p>
          </div>
        {/if}
        
      {:else}
        <!-- Change Password Form -->
        <div class="p-4">
          <div class="flex items-center gap-2 mb-4">
            <button
              class="p-1 hover:bg-slate-800 rounded transition-colors"
              on:click={() => { showChangePassword = false; passwordError = ''; }}
            >
              <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span class="text-sm font-medium">Change Password</span>
          </div>
          
          <div class="space-y-3">
            <div>
              <label class="block text-xs text-slate-500 mb-1">New Password</label>
              <input
                type="password"
                bind:value={newPassword}
                placeholder="Enter new password"
                class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm
                  placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
            </div>
            
            <div>
              <label class="block text-xs text-slate-500 mb-1">Confirm Password</label>
              <input
                type="password"
                bind:value={confirmPassword}
                placeholder="Confirm new password"
                class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm
                  placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                on:keydown={(e) => e.key === 'Enter' && handleChangePassword()}
              />
            </div>
            
            {#if passwordError}
              <p class="text-xs text-red-400">{passwordError}</p>
            {/if}
            
            {#if passwordSuccess}
              <p class="text-xs text-emerald-400">{passwordSuccess}</p>
            {/if}
            
            <button
              class="w-full py-2 bg-amber-500 text-slate-900 rounded-lg text-sm font-medium
                hover:bg-amber-400 transition-colors disabled:opacity-50"
              on:click={handleChangePassword}
              disabled={loading || !newPassword || !confirmPassword}
            >
              {#if loading}
                <span class="inline-flex items-center gap-2">
                  <div class="animate-spin h-4 w-4 border-2 border-slate-900 border-t-transparent rounded-full"></div>
                  Updating...
                </span>
              {:else}
                Update Password
              {/if}
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<script lang="ts">
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let color: 'amber' | 'white' | 'slate' = 'amber';
  
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-8 w-8 border-3',
    lg: 'h-12 w-12 border-4',
  };
  
  const colorClasses = {
    amber: 'border-amber-500 border-t-transparent',
    white: 'border-white border-t-transparent',
    slate: 'border-slate-400 border-t-transparent',
  };
</script>

<div 
  class="animate-spin rounded-full {sizeClasses[size]} {colorClasses[color]}"
  role="status"
  aria-label="Loading"
>
  <span class="sr-only">Loading...</span>
</div>

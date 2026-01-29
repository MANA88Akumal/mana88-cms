import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: 'mana88-cms-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit'
  }
})

// Debug helper
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  (window as any).clearAuth = () => {
    localStorage.clear()
    sessionStorage.clear()
    window.location.href = '/login'
  }
}

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/** false quando as variáveis de ambiente ainda não foram preenchidas. */
export const isSupabaseConfigured = Boolean(url && anonKey)

// Somente a chave ANON é usada aqui. A segurança real está no RLS do banco.
export const supabase = createClient(url || 'http://localhost:54321', anonKey || 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

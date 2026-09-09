import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * Headers for a fetch() to one of our own API routes.
 *
 * Server routes now derive company_id from the bearer token rather than from a
 * query parameter (see lib/auth.ts), so every call to /api/* that touches company
 * data has to carry the current session's access token or it will come back 401.
 *
 *     const res = await fetch('/api/documents', { headers: await authHeaders() })
 *     await fetch('/api/documents', {
 *       method: 'POST',
 *       headers: await authHeaders({ 'Content-Type': 'application/json' }),
 *       body: JSON.stringify({ ... }),
 *     })
 */
export async function authHeaders(
  extra: Record<string, string> = {}
): Promise<Record<string, string>> {
  const { data: { session } } = await createClient().auth.getSession()
  return { ...extra, Authorization: `Bearer ${session?.access_token ?? ''}` }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Row = Record<string, any>

/**
 * A small in-memory Postgres-shaped stand-in: enough of PostgREST's builder for the four sweeps
 * to run unmodified. It MUTATES its tables, so "the read-only company's rows are untouched" is
 * a real assertion about state and not about a call that was not made.
 */
export function makeDb(tables: Record<string, Row[]>) {
  const log: string[] = []
  let seq = 0
  function from(table: string) {
    tables[table] ??= []
    let op: 'select' | 'update' | 'insert' | 'delete' = 'select'
    let patch: Row | null = null
    const filters: Array<(r: Row) => boolean> = []
    let orderBy: string | null = null, asc = true, lim: number | null = null
    const q: any = {}
    const add = (f: (r: Row) => boolean) => { filters.push(f); return q }
    q.select = () => q
    q.eq = (c: string, v: any) => add((r) => r[c] === v)
    q.neq = (c: string, v: any) => add((r) => r[c] !== v)
    q.in = (c: string, vs: any[]) => add((r) => vs.includes(r[c]))
    q.is = (c: string, v: any) => add((r) => (v === null ? r[c] == null : r[c] === v))
    q.lt = (c: string, v: any) => add((r) => r[c] != null && r[c] < v)
    q.lte = (c: string, v: any) => add((r) => r[c] != null && r[c] <= v)
    q.gt = (c: string, v: any) => add((r) => r[c] != null && r[c] > v)
    q.gte = (c: string, v: any) => add((r) => r[c] != null && r[c] >= v)
    q.not = (c: string, o: string, v: any) => {
      if (o === 'in') { const set = String(v).replace(/^\(|\)$/g, '').split(',').filter(Boolean); return add((r) => !set.includes(r[c])) }
      if (o === 'is') return add((r) => r[c] != null)
      return q
    }
    // `claimTopic` uses `.or(...)`; the claim succeeding is the case under test.
    q.or = () => q
    q.order = (c: string, o?: { ascending?: boolean }) => { orderBy = c; asc = o?.ascending !== false; return q }
    q.limit = (n: number) => { lim = n; return q }
    q.update = (p: Row) => { op = 'update'; patch = p; return q }
    q.insert = (p: Row) => { op = 'insert'; patch = p; return q }
    q.delete = () => { op = 'delete'; return q }
    const rows = () => {
      let rs = tables[table].filter((r) => filters.every((f) => f(r)))
      if (orderBy) rs = [...rs].sort((a, b) => String(a[orderBy!] ?? '').localeCompare(String(b[orderBy!] ?? '')) * (asc ? 1 : -1))
      if (lim != null) rs = rs.slice(0, lim)
      return rs
    }
    const run = () => {
      if (op === 'insert') {
        const row = { id: `${table}-${++seq}`, ...(patch as Row) }
        tables[table].push(row); log.push(`insert ${table}`); return { data: [row], error: null }
      }
      if (op === 'update') {
        const rs = rows()
        for (const r of rs) Object.assign(r, patch)
        log.push(`update ${table} n=${rs.length} ${JSON.stringify(patch)}`)
        return { data: rs, error: null }
      }
      if (op === 'delete') { const rs = rows(); for (const r of rs) tables[table].splice(tables[table].indexOf(r), 1); return { data: rs, error: null } }
      return { data: rows(), error: null }
    }
    q.maybeSingle = async () => { const r = run(); return { data: r.data[0] ?? null, error: null } }
    q.single = async () => { const r = run(); return { data: r.data[0] ?? null, error: r.data[0] ? null : { message: 'no rows' } } }
    q.then = (res: any, rej: any) => Promise.resolve(run()).then(res, rej)
    return q
  }
  const storage = {
    from: () => ({
      download: async () => ({ data: null, error: { message: 'not in this test' } }),
    }),
  }
  return { from, storage, tables, log, auth: { admin: { getUserById: async () => ({ data: { user: null } }) } } }
}

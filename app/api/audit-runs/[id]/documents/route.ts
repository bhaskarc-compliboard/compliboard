// THE DOCUMENTS AN AUDIT READ, AS A ZIP — Audits Run 3, item 3.
//
//   GET /api/audit-runs/[id]/documents
//
// *** THE ORIGINAL FILES, IN CITATION ORDER, WITH AN INDEX. *** An audit report is worth little on
// its own: the person taking it to an inspector needs the documents it cites, numbered the way the
// report numbers them. So the zip is the report's last page made real — same order, same numbers.
//
// *** NO CONVERSION. *** Whatever was uploaded is what comes out. Converting a .docx to PDF here
// would mean the inspector is shown something we made rather than something the company holds, and
// the file-types run is where conversion belongs.
//
// *** A FILE WE CANNOT FETCH IS LISTED AS MISSING, NOT A FAILED DOWNLOAD. *** One unreachable object
// in storage must not cost the person the other eleven documents. It appears in `index.txt` with the
// reason, which is also the only place a person would find out at all (§5.1: never silent).
//
// The zip is built with `node:zlib` and a hand-written central directory, the same way
// `scripts/render-golden-docs.js` writes a .docx — there is no zip dependency in this project and
// adding one to stream twelve files would be a dependency the product does not need.

import { NextResponse, type NextRequest } from 'next/server'
import { deflateRawSync, crc32 } from 'node:zlib'

import { requireCompany, supabaseAdmin } from '@/lib/auth'

const BUCKET = 'company-documents'

/** Zip needs a DOS timestamp; one fixed value keeps the archive byte-stable for the same inputs. */
const DOS_TIME = 0x0000
// year-1980 in bits 9-15, month in 5-8, day in 0-4. (20 << 9) | (1 << 5) | 1 = 1 January 2000.
// The first value here was 0x2100, which decodes to day 0 of August 1996 — `unzip -l` printed
// "08-00-1996", and a date nobody can read is a date that makes a reader doubt the archive.
const DOS_DATE = (20 << 9) | (1 << 5) | 1

function zipOf(files: Array<{ name: string; bytes: Buffer }>): Buffer {
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8')
    const crc = crc32(f.bytes)
    const deflated = deflateRawSync(f.bytes)
    // Stored beats deflated when deflating made it bigger, which happens on already-compressed PDFs.
    const useDeflate = deflated.length < f.bytes.length
    const data = useDeflate ? deflated : f.bytes
    const method = useDeflate ? 8 : 0

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    // *** BIT 11 SAYS THE NAME IS UTF-8, AND WITHOUT IT AN EM DASH IS MOJIBAKE. ***
    // A document title is the reading's own words and they contain en and em dashes; `unzip -l`
    // printed "Permit No. 26-2841-ST-01 ��� Portland Facility" until this flag was set, because
    // a zip name defaults to code page 437.
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(DOS_TIME, 10); local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(f.bytes.length, 22)
    local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28)
    chunks.push(local, nameBuf, data)

    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8)
    cd.writeUInt16LE(method, 10)
    cd.writeUInt16LE(DOS_TIME, 12); cd.writeUInt16LE(DOS_DATE, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(data.length, 20)
    cd.writeUInt32LE(f.bytes.length, 24)
    cd.writeUInt16LE(nameBuf.length, 28)
    cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32); cd.writeUInt16LE(0, 34)
    cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38)
    cd.writeUInt32LE(offset, 42)
    central.push(cd, nameBuf)

    offset += local.length + nameBuf.length + data.length
  }

  const cdBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(cdBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...chunks, cdBuf, end])
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 90)

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authed = await requireCompany(request)
    if (!authed.ok) return authed.response
    const { db } = authed.auth
    const { id } = await ctx.params

    const { data: run } = await db.from('audit_runs')
      .select('id, agency_label, finished_at, created_at').eq('id', id).maybeSingle()
    if (!run) return NextResponse.json({ error: 'That audit was not found.' }, { status: 404 })

    const [{ data: secs }, { data: finds }] = await Promise.all([
      db.from('audit_sections').select('documents_read').eq('run_id', id).order('ordinal'),
      db.from('audit_findings')
        .select('title, word, kind, document_id, document_b_id, locator')
        .eq('run_id', id).order('ordinal'),
    ])
    const findings = ((finds ?? []) as unknown as Array<Record<string, unknown>>)
    const read = [...new Set(((secs ?? []) as unknown as Array<{ documents_read: string[] | null }>)
      .flatMap((s) => s.documents_read ?? []))]

    // The report's own order, computed the same way `citationOrder` does in the drawer, so page N
    // of the print and file N of the zip are the same document.
    const order: string[] = []
    for (const f of findings) {
      for (const d of [f.document_id, f.document_b_id]) {
        if (d && !order.includes(d as string)) order.push(d as string)
      }
    }
    for (const d of read) if (!order.includes(d)) order.push(d)

    if (!order.length) {
      return NextResponse.json({ error: 'This audit read no documents, so there is nothing to download.' },
        { status: 404 })
    }

    // Ownership again, and on the caller's client: the ids came from rows they can see, and this is
    // what makes the storage path safe to use — it is read off the row we just authorised, never
    // off the request (§3.6, the documents DELETE pattern).
    // *** THE TITLE A PERSON SEES, AND THE FILE NAME FOR ITS EXTENSION. *** `documents.name` is the
    // uploaded file name; `document_index_v.title` is what the reading called it and what the
    // report, the page and the drawer all show. The zip is read beside the printed report, so the
    // two must name the same document the same way.
    const [{ data: docs }, { data: titled }] = await Promise.all([
      db.from('documents').select('id, name, file_url, file_type').in('id', order),
      db.from('document_index_v').select('document_id, title').in('document_id', order),
    ])
    const titleById = new Map(((titled ?? []) as unknown as Array<{ document_id: string; title: string }>)
      .map((t) => [t.document_id, t.title]))
    const byId = new Map((docs ?? []).map((d: Record<string, unknown>) => [d.id as string, d]))

    const files: Array<{ name: string; bytes: Buffer }> = []
    const index: string[] = [
      `Documents read by the ${run.agency_label ?? 'compliance'} audit of `
        + `${String(run.finished_at ?? run.created_at).slice(0, 10)}`,
      'Numbered in the order the report cites them.',
      '',
    ]

    let n = 0
    for (const docId of order) {
      n++
      const row = byId.get(docId)
      const cites = findings.filter((f) => f.document_id === docId || f.document_b_id === docId)
      if (!row) {
        index.push(`${n}. (a document this audit cited is no longer on file)`, '')
        continue
      }
      const fileName = String(row.name ?? 'document')
      const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.') + 1) : 'bin'
      const title = titleById.get(docId) ?? (fileName.includes('.')
        ? fileName.slice(0, fileName.lastIndexOf('.')) : fileName)
      const entry = `${n}-${safe(title)}.${ext}`

      let bytes: Buffer | null = null
      let why: string | null = null
      try {
        const { data: blob, error } = await supabaseAdmin.storage.from(BUCKET)
          .download(row.file_url as string)
        if (error || !blob) why = error?.message ?? 'the file is not where its record says it is'
        else bytes = Buffer.from(await blob.arrayBuffer())
      } catch (e) {
        why = e instanceof Error ? e.message : String(e)
      }

      index.push(`${n}. ${title}   (${fileName})${bytes ? '' : '   [MISSING FROM THIS ZIP]'}`)
      if (!bytes) index.push(`   We could not fetch this file: ${why}. Its record and its reading are intact.`)
      for (const c of cites) {
        index.push(`   - ${c.title}${c.word ? ` [${String(c.word).replace(/_/g, ' ')}]` : ''}`
          + `${c.locator ? ` — ${c.locator}` : ''}`)
      }
      if (!cites.length) index.push('   - read for context; no finding cites it')
      index.push('')
      if (bytes) files.push({ name: entry, bytes })
    }

    files.push({ name: 'index.txt', bytes: Buffer.from(index.join('\n'), 'utf8') })
    const zip = zipOf(files)

    const name = `${safe(String(run.agency_label ?? 'audit'))} audit `
      + `${String(run.finished_at ?? run.created_at).slice(0, 10)}.zip`
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${name}"`,
        'content-length': String(zip.length),
      },
    })
  } catch (error) {
    console.error('audit-runs/[id]/documents GET:', error)
    return NextResponse.json({ error: 'We could not build that download just now.' }, { status: 500 })
  }
}

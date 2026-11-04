/**
 * A GENUINELY PASSWORD-PROTECTED PDF, built from scratch — GAPS-PLAN Part B step B4.
 *
 * Nothing on this laptop makes one: no qpdf, no pdftk, no LibreOffice, and `textutil` does not
 * write PDF at all. So it is built here, with the PDF 1.4 standard security handler (RC4 40-bit,
 * /V 1 /R 2) implemented from the specification — Algorithm 2 for the key, 4 for /U, 3 for /O.
 *
 * Encrypting an EXISTING PDF would mean re-encrypting every string and stream in it; generating
 * the document at the same time means there are exactly two strings and one stream to handle.
 */
import { createHash, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const PAD = Buffer.from([
  0x28,0xBF,0x4E,0x5E,0x4E,0x75,0x8A,0x41,0x64,0x00,0x4E,0x56,0xFF,0xFA,0x01,0x08,
  0x2E,0x2E,0x00,0xB6,0xD0,0x68,0x3E,0x80,0x2F,0x0C,0xA9,0xFE,0x64,0x53,0x69,0x7A,
])

/** RC4, because OpenSSL 3 no longer offers it and it is fifteen lines. */
function rc4(key, data) {
  const s = Array.from({ length: 256 }, (_, i) => i)
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255
    ;[s[i], s[j]] = [s[j], s[i]]
  }
  const out = Buffer.alloc(data.length)
  for (let k = 0, i = 0, j = 0; k < data.length; k++) {
    i = (i + 1) & 255
    j = (j + s[i]) & 255
    ;[s[i], s[j]] = [s[j], s[i]]
    out[k] = data[k] ^ s[(s[i] + s[j]) & 255]
  }
  return out
}

const pad = (pw) => Buffer.concat([Buffer.from(pw, 'latin1'), PAD]).subarray(0, 32)

const USER_PW = 'drums2026'
const OWNER_PW = 'drums2026'
const P = -1                                  // every permission; the point is the open password
const id = randomBytes(16)

// Algorithm 3 — /O from the owner password.
const oKey = createHash('md5').update(pad(OWNER_PW)).digest().subarray(0, 5)
const O = rc4(oKey, pad(USER_PW))

// Algorithm 2 — the file encryption key.
const pBuf = Buffer.alloc(4); pBuf.writeInt32LE(P, 0)
const key = createHash('md5')
  .update(pad(USER_PW)).update(O).update(pBuf).update(id)
  .digest().subarray(0, 5)

// Algorithm 4 — /U for revision 2 is the padding string encrypted with the file key.
const U = rc4(key, PAD)

/** Per-object key: the file key plus the object and generation numbers, MD5'd (Algorithm 1). */
const objKey = (num, gen) => createHash('md5').update(Buffer.concat([
  key, Buffer.from([num & 255, (num >> 8) & 255, (num >> 16) & 255, gen & 255, (gen >> 8) & 255]),
])).digest().subarray(0, Math.min(key.length + 5, 16))

const stream = Buffer.from(
  'BT /F1 18 Tf 72 720 Td (Oregon DEQ Air Contaminant Discharge Permit) Tj ET\n'
  + 'BT /F1 12 Tf 72 690 Td (Permit No. 26-2841-ST-01 - Portland facility) Tj ET\n'
  + 'BT /F1 12 Tf 72 670 Td (Expires 15 November 2026) Tj ET\n', 'latin1')
const encStream = rc4(objKey(4, 0), stream)

const hex = (b) => '<' + b.toString('hex') + '>'
const objs = [
  '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
  '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
  '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
    + '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n',
  `4 0 obj\n<< /Length ${encStream.length} >>\nstream\n`,
  '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  `6 0 obj\n<< /Filter /Standard /V 1 /R 2 /O ${hex(O)} /U ${hex(U)} /P ${P} >>\nendobj\n`,
]

const parts = []
const offsets = []
let at = 0
const push = (b) => { const buf = Buffer.isBuffer(b) ? b : Buffer.from(b, 'latin1'); parts.push(buf); at += buf.length }
push('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
for (let i = 0; i < objs.length; i++) {
  offsets.push(at)
  push(objs[i])
  if (i === 3) { push(encStream); push('\nendstream\nendobj\n') }
}
const xrefAt = at
let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
for (const o of offsets) xref += String(o).padStart(10, '0') + ' 00000 n \n'
push(xref)
push(`trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Encrypt 6 0 R /ID [${hex(id)} ${hex(id)}] >>\n`
  + `startxref\n${xrefAt}\n%%EOF\n`)

writeFileSync(process.argv[2], Buffer.concat(parts))
console.log(`written ${process.argv[2]} — user password "${USER_PW}"`)

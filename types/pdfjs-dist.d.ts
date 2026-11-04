/**
 * `pdfjs-dist`'s two deep paths — `docs/GAPS-PLAN.md` Part C, decision 61.
 *
 * The package ships full types at `types/src/pdf.d.ts` and names them in `package.json`, so
 * `import('pdfjs-dist')` is typed. It has **no `exports` map**, so the two files the binder needs
 * by name resolve fine at runtime and have no types of their own:
 *
 *   · `pdfjs-dist/build/pdf.mjs`        — the same module the package's `main` points at. It is
 *     imported by its full path rather than by the package name so that the library and its worker
 *     are one pair of adjacent dynamic imports, and so no bundler can decide to pull the Node
 *     build in for a browser page.
 *   · `pdfjs-dist/build/pdf.worker.mjs` — parked on `globalThis.pdfjsWorker`, which is the hook
 *     `pdf.mjs` itself checks before it looks for a Web Worker
 *     (`#mainThreadWorkerMessageHandler`, `node_modules/pdfjs-dist/build/pdf.mjs:15660`). It is a
 *     module of machinery with no surface the caller touches, so `unknown` is the honest type: the
 *     only thing done with it is handing it back to pdf.js.
 *
 * Declared here rather than silenced with `any` at the call site, which is the pattern
 * `types/heic-decode.d.ts` set for the other untyped dependency.
 */
declare module 'pdfjs-dist/build/pdf.mjs' {
  export * from 'pdfjs-dist'
}

declare module 'pdfjs-dist/build/pdf.worker.mjs' {
  const worker: unknown
  export default worker
}

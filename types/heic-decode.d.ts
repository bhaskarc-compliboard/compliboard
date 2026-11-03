/**
 * `heic-decode` ships no types — GAPS-PLAN Part B step B2, 3 November 2026.
 *
 * Written from its own source rather than from a guess: `node_modules/heic-decode/lib.js`
 * returns `{ width, height, data }` from `one()`, where `data` is the `Uint8ClampedArray` of
 * width * height * 4 RGBA bytes it allocated, and `all()` returns a list of images each with a
 * `decode()` of its own. Only `one()` is used here (`lib/imageConvert.ts` takes the first image
 * of a Live Photo or a burst), and `all` is declared because leaving half a module's surface
 * undeclared is how the next person writes a call that compiles and does nothing.
 */
declare module 'heic-decode' {
  type HeicImageData = { width: number; height: number; data: Uint8ClampedArray }
  function decode(input: { buffer: Buffer | ArrayBufferView }): Promise<HeicImageData>
  namespace decode {
    function all(input: { buffer: Buffer | ArrayBufferView }): Promise<Array<{
      width: number
      height: number
      decode: () => Promise<HeicImageData>
    }>>
  }
  export default decode
}

/**
 * THE GREEN WAVES — public pages step 14 (`docs/PUBLIC-PAGES-PLAN.md` decision 12).
 *
 * Four bands of green rising from the bottom right, palest at the back, the app's own `--green`
 * at the front. They are the one piece of decoration on the public pages, and they are drawn
 * rather than fetched: an inline SVG costs no request, scales with its container and takes its
 * colours from the tokens, so a change to `--wave-2` moves every wave on the site at once.
 *
 * TWO VARIANTS, AND THE DIFFERENCE IS THE POINT. `full` is the hero and the closing panel: four
 * paths, `--wave-1` → `--wave-2` → `--wave-3` → `--green`. `faint` is what sits behind a panel's
 * card: two paths in the two palest greens only (`--green-wash` and `--wave-1`), because
 * decision 12 keeps the strong green for the hero and the close. There is no third variant and
 * no gradient — a gradient would reach a green darker than the variant allows, which is exactly
 * what decision 12 rules out.
 *
 * `preserveAspectRatio="none"` with `width`/`height` at 100%: the waves take the width AND the
 * height of whatever box they are placed in, so the caller decides how tall they are. Nothing
 * here is readable, so the whole SVG is `aria-hidden` and carries no title.
 *
 * `fill` is set through `style`, not as an attribute: `var()` inside a presentation attribute is
 * not resolved by every browser, and inside `style` it always is.
 */

/** The four-wave set: back to front, pale to the app's green. One viewBox for both variants. */
const FULL: { d: string; fill: string }[] = [
  { d: 'M0 240 C 260 226, 520 186, 760 120 C 940 70, 1080 34, 1200 18 L1200 320 L0 320 Z', fill: 'var(--wave-1)' },
  { d: 'M0 276 C 280 266, 560 230, 800 170 C 980 126, 1090 92, 1200 74 L1200 320 L0 320 Z', fill: 'var(--wave-2)' },
  { d: 'M0 302 C 300 296, 600 272, 840 222 C 1010 186, 1110 154, 1200 132 L1200 320 L0 320 Z', fill: 'var(--wave-3)' },
  { d: 'M0 318 C 320 314, 640 300, 880 266 C 1040 242, 1120 214, 1200 192 L1200 320 L0 320 Z', fill: 'var(--green)' },
]

/** The pale pair, for behind a card. The palest token in the product, then the first wave green. */
const FAINT: { d: string; fill: string }[] = [
  { d: 'M0 210 C 260 198, 520 160, 780 104 C 950 68, 1080 40, 1200 24 L1200 320 L0 320 Z', fill: 'var(--green-wash)' },
  { d: 'M0 272 C 300 262, 600 224, 840 166 C 1000 128, 1110 98, 1200 80 L1200 320 L0 320 Z', fill: 'var(--wave-1)' },
]

export default function Waves({
  faint = false,
  className = '',
}: {
  /**
   * Four paths, through to the app's `--green` — the hero and the closing panel. It is the
   * DEFAULT, and the prop exists so the call site says which set it means: `<Waves full />`
   * reads as a choice, `<Waves />` reads as an oversight. `faint` is the only switch.
   */
  full?: boolean
  /** Two paths, the two palest greens. Behind a panel's card. */
  faint?: boolean
  className?: string
}) {
  const paths = faint ? FAINT : FULL
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1200 320"
      preserveAspectRatio="none"
      className={`block h-full w-full ${className}`}
    >
      {paths.map((p) => (
        <path key={p.fill} d={p.d} style={{ fill: p.fill }} />
      ))}
    </svg>
  )
}

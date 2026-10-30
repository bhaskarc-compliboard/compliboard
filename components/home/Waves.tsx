/**
 * THE GREEN WAVES — public pages step 14, redrawn from the board at step 15c
 * (`docs/PUBLIC-PAGES-PLAN.md` decision 12).
 *
 * Four bands of green nesting into the BOTTOM-RIGHT CORNER, palest at the back, the app's own
 * `--green` at the front. They are the one piece of decoration on the public pages, and they are
 * drawn rather than fetched: an inline SVG costs no request, scales with its container and takes
 * its colours from the tokens, so a change to `--wave-2` moves every wave on the site at once.
 *
 * *** THESE PATHS ARE THE BOARD'S, NOT A COMPOSITION. *** The first version of this file was four
 * near-parallel bands running the full width inside a 320px strip — drawn from the description of
 * the design rather than from the design. The board's waves differ in three ways, and all three
 * are visible on the page: each band STARTS FURTHER RIGHT than the one behind it, so the left side
 * of the screen stays open for the words; each BENDS TWICE rather than once; and each SHADES
 * lighter-to-darker along its length instead of being one flat colour.
 *
 * TWO VARIANTS, AND THE DIFFERENCE IS THE POINT. `full` is the hero and the closing panel, at its
 * own aspect for the two shapes of screen (`phone`), because a set of curves drawn for a 1440×900
 * laptop and squeezed into a 390-wide phone is not the same drawing. `faint` is what sits behind a
 * panel's card: two paths in the two palest greens only (`--green-wash` and `--wave-1`), because
 * decision 12 keeps the strong green for the hero and the close.
 *
 * *** THE GRADIENTS, AND WHY THEY DO NOT BREAK DECISION 12'S CEILING. *** This file used to say
 * there were no gradients, on the reasoning that one would reach a green darker than the variant
 * allows. That is true of a gradient chosen freely and false of these: each one runs between two
 * NEIGHBOURING tokens of its own set and stops there — wash→`--wave-1`, a shade of `--wave-2`→
 * `--wave-2`, a shade of `--wave-3`→`--wave-3`, and the front band from #3C8F62 to `--green`.
 * `--green` is the darkest colour anywhere in the drawing, which is exactly what decision 12 asks:
 * the set's own ceiling is never passed.
 *
 * *** THE GRADIENT IDS ARE UNIQUE PER INSTANCE, AND THEY HAVE TO BE. *** An SVG gradient is
 * referenced by `url(#id)` and resolved against the WHOLE DOCUMENT, so two sets of waves on one
 * page with the same ids is one set of waves and one piece of silent nonsense. Step 24's closing
 * panel draws these same waves on this same page, and the hero already draws two (laptop and
 * phone). `useId()` gives each instance its own prefix — it works in a server component in React
 * 19 (`react.react-server`'s exports include it), so this stays a server component and ships no
 * JavaScript. Its ids contain characters SVG references do not need, so they are stripped.
 *
 * The SVG takes the width AND the height of whatever box it is placed in; `preserveAspectRatio`
 * decides what happens to the drawing inside it — `slice` for the full sets, which cover the box
 * and are cropped (the hero's box is the whole section), `meet` for `faint`, which fits inside it.
 * Nothing here is readable, so the whole SVG is `aria-hidden` and carries no title.
 *
 * `fill` and `stop-color` are set through `style`, not as attributes: `var()` inside an SVG
 * presentation attribute is not resolved by every browser, and inside `style` it always is.
 */
import { useId } from 'react'

/** One band: either a gradient of the set (`grad`, 1–4) or a flat token. */
type WavePath = { d: string; grad?: 1 | 2 | 3 | 4; token?: string }

/**
 * The four gradients, back to front. `diagonal` is the front band only, which runs corner to
 * corner rather than straight across because it is the one the eye reads as a solid shape.
 * Each pair is two neighbouring greens; none of them passes `--green`.
 */
const GRADIENTS: { from: string; fromOpacity?: number; to: string; diagonal?: boolean }[] = [
  { from: 'var(--green-wash)', fromOpacity: 0, to: 'var(--wave-1)' },
  { from: '#CFE6D7', to: 'var(--wave-2)' },
  { from: '#8FC4A3', to: 'var(--wave-3)' },
  { from: '#3C8F62', to: 'var(--green)', diagonal: true },
]

/** The laptop set, drawn at 1440×900 — the hero's own shape. */
const LAPTOP: { viewBox: string; fit: string; prefix: string; paths: WavePath[] } = {
  viewBox: '0 0 1440 900',
  fit: 'xMidYMax slice',
  prefix: 'g',
  paths: [
    { d: 'M 0 790 C 260 720, 520 900, 820 790 S 1220 560, 1440 620 L 1440 900 L 0 900 Z', grad: 1 },
    { d: 'M 380 900 C 600 760, 820 880, 1040 740 S 1340 540, 1440 580 L 1440 900 Z', grad: 2 },
    { d: 'M 700 900 C 880 820, 1020 880, 1180 760 S 1380 620, 1440 650 L 1440 900 Z', grad: 3 },
    { d: 'M 960 900 C 1080 860, 1180 830, 1290 760 S 1410 690, 1440 705 L 1440 900 Z', grad: 4 },
    /* The small wash in the top-right corner, which is what keeps the top of the hero from being
       a flat white band above the gradient. */
    { d: 'M 1180 0 C 1260 120, 1380 160, 1440 140 L 1440 0 Z', token: 'var(--green-wash)' },
  ],
}

/** The phone set, drawn at 390×844 — the same four bands, redrawn for a tall narrow screen. */
const PHONE: { viewBox: string; fit: string; prefix: string; paths: WavePath[] } = {
  viewBox: '0 0 390 844',
  fit: 'xMidYMax slice',
  prefix: 'p',
  paths: [
    { d: 'M 0 760 C 90 720, 160 800, 240 750 S 350 660, 390 680 L 390 844 L 0 844 Z', grad: 1 },
    { d: 'M 60 844 C 140 770, 220 820, 290 740 S 370 660, 390 672 L 390 844 Z', grad: 2 },
    { d: 'M 170 844 C 230 800, 280 820, 330 760 S 380 700, 390 708 L 390 844 Z', grad: 3 },
    { d: 'M 260 844 C 300 820, 340 800, 370 770 S 385 750, 390 752 L 390 844 Z', grad: 4 },
  ],
}

/**
 * The pale pair, for behind a card: the palest token in the product, then the first wave green.
 * Low and right, and no gradient — two flat tokens are all decision 12 allows back there.
 * NOTHING USES IT YET; step 16's audit panel is what finds it ready.
 */
const FAINT: { viewBox: string; fit: string; prefix: string; paths: WavePath[] } = {
  viewBox: '0 0 640 460',
  fit: 'xMaxYMax meet',
  prefix: 'f',
  paths: [
    { d: 'M 0 400 C 160 330, 300 420, 440 340 S 600 240, 640 260 L 640 460 L 0 460 Z', token: 'var(--green-wash)' },
    { d: 'M 260 460 C 380 400, 480 420, 560 350 S 630 300, 640 306 L 640 460 Z', token: 'var(--wave-1)' },
  ],
}

export default function Waves({
  faint = false,
  phone = false,
  className = '',
}: {
  /**
   * Four paths, through to the app's `--green` — the hero and the closing panel. It is the
   * DEFAULT, and the prop exists so the call site says which set it means: `<Waves full />`
   * reads as a choice, `<Waves />` reads as an oversight.
   */
  full?: boolean
  /** The full set redrawn at 390×844, for below the `lg` breakpoint. Ignored by `faint`. */
  phone?: boolean
  /** Two paths, the two palest greens. Behind a panel's card. */
  faint?: boolean
  className?: string
}) {
  const set = faint ? FAINT : phone ? PHONE : LAPTOP
  /* Stripped to letters and digits: React's own id carries delimiters an `url(#…)` reference has
     no need of, and the only job this string has is to be different from the next instance's. */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const gid = (n: number) => `${uid}-${set.prefix}${n}`

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={set.viewBox}
      preserveAspectRatio={set.fit}
      className={`block h-full w-full ${className}`}
    >
      {!faint && (
        <defs>
          {GRADIENTS.map((g, i) => (
            <linearGradient
              key={i}
              id={gid(i + 1)}
              x1="0"
              y1="0"
              x2="1"
              y2={g.diagonal ? '1' : '0'}
            >
              <stop offset="0" style={{ stopColor: g.from, stopOpacity: g.fromOpacity ?? 1 }} />
              <stop offset="1" style={{ stopColor: g.to }} />
            </linearGradient>
          ))}
        </defs>
      )}
      {set.paths.map((p, i) => (
        <path key={i} d={p.d} style={{ fill: p.grad ? `url(#${gid(p.grad)})` : p.token }} />
      ))}
    </svg>
  )
}

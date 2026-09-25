/**
 * THE DRAWER — lifted out of app/compliance/page.tsx unchanged, Documents Run 4.
 *
 * It was local to the workspace and the Documents report needs the same object: same 720, same
 * scrim, same sticky header, same print behaviour. Copying it would have been two drawers that
 * drift, and the one that drifts is always the one nobody is looking at. `DESIGN.md` §4 names
 * one drawer for the product; this is it.
 *
 * *** MOVED, NOT REWRITTEN. *** The markup, the sizes, the print header and `printDrawer()` are
 * byte-for-byte what the workspace shipped. Nothing about the workspace changes in this run, and
 * a diff that mixes a move with an edit is a diff nobody can review.
 */
'use client'

/**
 * PRINTING A DRAWER PRINTS THE DRAWER — Fix Round 1 (E).
 *
 * `window.print()` from inside a drawer printed the drawer's 560px fixed column AND the whole
 * page behind it — tabs, the other conversations, the composer. The drawer is `position: fixed`,
 * so it also clipped at the first page. This stamps a class on <body> for the duration of the
 * dialog; the print rules in the page's <style> hide `.print-page` and let `.print-drawer` flow
 * as an ordinary document.
 *
 * `afterprint` is the honest place to take the class off — `print()` returns before the dialog
 * closes in some browsers — but the listener is removed either way so a second print is clean.
 */
function printDrawer() {
  const body = document.body
  const done = () => { body.classList.remove('printing-drawer'); window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  body.classList.add('printing-drawer')
  window.print()
  // A belt-and-braces removal: if `afterprint` never fires, the class must not survive the page.
  setTimeout(done, 1000)
}

/**
 * *** 720 WIDE, NOT 560. *** Both drawers hold reading text — a checklist you work down and a
 * one-paragraph summary — and at 560 the summary was a narrow column of serif. `w-full` keeps
 * it filling the screen on anything narrower, so this only widens where there is room.
 */
function Drawer({ title, sub, children, footer, onClose, company }: {
  title: string; sub?: string; children: React.ReactNode; footer?: React.ReactNode
  onClose: () => void; company?: string | null
}) {
  return (
    <aside className="print-drawer fixed inset-y-0 right-0 z-50 flex w-full max-w-[720px] flex-col border-l border-gray-200 bg-white shadow-2xl">
      {/*
        THE PRINTED HEADER. On screen this is not there at all; on paper it is the only thing
        that says whose document this is and when it was taken. A printed compliance page with
        no company and no date is not evidence of anything.
      */}
      <div className="hidden print:block border-b border-gray-300 pb-2 mb-4">
        {company && <p className="text-[13px] font-semibold text-gray-900">{company}</p>}
        <p className="text-[15px] font-medium text-gray-900">{title}</p>
        <p className="text-[11px] text-gray-600">
          {sub ? `${sub} · ` : ''}Printed {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })} · CompliBoard
        </p>
      </div>
      <header className="no-print flex items-start justify-between gap-4 px-6 pt-5">
        <div className="min-w-0">
          <h2 className="text-lg font-medium leading-snug text-gray-900">{title}</h2>
          {sub && <p className="mt-0.5 text-[12.5px] text-gray-500">{sub}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="no-print rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </header>
      <div className="drawer-body flex-1 overflow-y-auto px-6 py-4">{children}</div>
      {footer && <footer className="no-print flex items-center gap-2 border-t border-gray-200 px-6 py-3">{footer}</footer>}
    </aside>
  )
}

export { Drawer, printDrawer }

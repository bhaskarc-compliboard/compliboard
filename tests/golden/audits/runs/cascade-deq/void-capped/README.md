# Void — run under DEV_MAX_SEARCHES=2

Two `whole` runs from an aborted first attempt on 29 September 2026, before the run was restarted with
search uncapped. `scripts/run-golden-docs.js` prints `CAPPED AT n — VOID` for exactly this reason: a
capped run cannot be compared with production or with another configuration, so averaging it into a
figure quietly corrupts the figure.

**They are kept, not deleted.** Both happen to record `searches=0` — the model chose not to search
either way — so the cap changed nothing about these two answers, and that is worth being able to check
rather than assert. They are out of the parent folder so a glob cannot pick them up by accident.

They were also judged by a broken `forbidden_words` matcher (substring, not word boundary), which
failed two must-nots on words like "maintenance" and "metal". Their stored `verdicts` are therefore
wrong as well as void.

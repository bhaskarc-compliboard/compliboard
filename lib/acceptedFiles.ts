/**
 * The file types the product accepts, in one place.
 *
 * Deliberately its own module with NO imports. `lib/documentContent.ts` does the parsing
 * and pulls in xlsx, mammoth and officeparser — importing that from a page would bundle
 * three parsers into the browser for the sake of one string. This file is safe to import
 * from a client component.
 *
 * Every file picker in the app uses this. Before 11 Sep each page had its own hand-written
 * list and no two agreed: /documents offered Word and PowerPoint, /compliance offered Word
 * but not PowerPoint, /upload offered neither. The route behind them had changed and the
 * pickers had not.
 */
export const ACCEPTED_FILE_TYPES = '.pdf,.xlsx,.xls,.csv,.txt,.doc,.docx,.ppt,.pptx,image/*'

/** Prose version, for telling a user what they may upload. Kept next to the list so the
 *  two cannot drift. */
export const ACCEPTED_FILE_TYPES_PROSE =
  'PDFs, images, Excel, CSV, text, Word and PowerPoint files'

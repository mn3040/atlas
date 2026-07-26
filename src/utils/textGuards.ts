/**
 * Undoes markdown's backslash-escaping of special characters -- mammoth's
 * convertToMarkdown (used for docx import) escapes literal parens/dashes as
 * "\(", "\)", "\-" etc. when they could be read as markdown syntax, and
 * nothing downstream ever un-escaped them, so raw "\(9/13\-9/23\)" leaked
 * straight into inferred trip names.
 */
export function unescapeMarkdown(value: string): string {
  return value.replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')
}

/**
 * Guardrail for any user-typed "name" field (trip name, display name, day
 * label): strips HTML-looking markup and control characters, unescapes
 * markdown backslash-escapes that leak in from docx/markdown imports,
 * collapses whitespace, trims, and caps length.
 */
export function sanitizeName(raw: string, maxLength = 80): string {
  // eslint-disable-next-line no-control-regex -- intentional: stripping control characters from user input
  const controlCharPattern = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g')
  return unescapeMarkdown(raw)
    .normalize('NFC')
    .replace(/<[^>]*>/g, '')
    .replace(controlCharPattern, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function isBlankName(value: string): boolean {
  return sanitizeName(value).length === 0
}

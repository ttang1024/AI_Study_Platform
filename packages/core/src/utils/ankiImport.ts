export interface ParsedAnkiRow {
  front: string;
  back: string;
  cardType?: string;
  tags?: string[];
}

/**
 * Parses an Anki "Notes in Plain Text" export (.txt) or a generic CSV/TSV.
 * Anki headers like "#separator:tab" are honored; cloze syntax ({{c1::...}})
 * is detected and imported as cloze cards.
 */
export function parseAnkiExport(text: string): ParsedAnkiRow[] {
  let separator = '\t';
  const lines = text.split(/\r?\n/);
  const rows: ParsedAnkiRow[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.startsWith('#')) {
      const m = line.match(/^#separator:(.+)$/i);
      if (m) {
        const sep = m[1].trim().toLowerCase();
        separator = sep === 'tab' ? '\t' : sep === 'comma' ? ',' : sep === 'semicolon' ? ';' : sep;
      }
      continue;
    }

    // Fall back to comma/semicolon when the line has no tab at all.
    const actualSep = line.includes('\t') ? '\t' : line.includes(separator) ? separator : line.includes(';') ? ';' : ',';
    const parts = line.split(actualSep);
    if (parts.length < 2) continue;

    const clean = (s: string) => s
      .replace(/^"|"$/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();

    const front = clean(parts[0]);
    const back = clean(parts[1]);
    if (!front || !back) continue;

    // Anki puts tags in the last column, space-separated.
    const tags = parts.length > 2
      ? clean(parts[parts.length - 1]).split(/\s+/).filter((t) => t && t.length <= 40).slice(0, 10)
      : undefined;

    rows.push({
      front,
      back,
      cardType: /\{\{c\d+::/.test(front) ? 'cloze' : 'basic',
      tags: tags && tags.length > 0 ? tags : undefined,
    });
  }
  return rows;
}

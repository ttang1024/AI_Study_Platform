import { extensionOf } from './syntaxHighlight';

/** Above this, re-serializing JSON costs more than the tidier output is worth. */
const PRETTY_PRINT_LIMIT = 2_000_000;

const LABELS: Record<string, string> = {
  json: 'JSON', jsonl: 'JSON Lines', ndjson: 'JSON Lines', json5: 'JSON5', jsonc: 'JSON with comments',
  yaml: 'YAML', yml: 'YAML', toml: 'TOML', xml: 'XML', plist: 'Property list',
  opml: 'OPML', rss: 'RSS', atom: 'Atom', ini: 'INI', cfg: 'Config', conf: 'Config',
  properties: 'Properties', avsc: 'Avro schema', edn: 'EDN',
};

/**
 * Minified JSON is unreadable, and a lot of real-world `.json` uploads are one
 * long line. Re-indent when we can; leave every other data format untouched,
 * since we have no parser for them and a wrong guess would corrupt the view.
 */
export function prettyPrintData(text: string, fileName: string): string {
  const extension = extensionOf(fileName);
  if (text.length > PRETTY_PRINT_LIMIT) return text;

  if (extension === 'json' || extension === 'avsc') {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }

  if (extension === 'jsonl' || extension === 'ndjson') {
    const lines = text.split('\n');
    // One JSON document per line — keep the line structure, tidy each record.
    return lines
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return line;
        try {
          return JSON.stringify(JSON.parse(trimmed), null, 2);
        } catch {
          return line;
        }
      })
      .join('\n');
  }

  return text;
}

export const dataCaption = (text: string, fileName: string): string => {
  const label = LABELS[extensionOf(fileName)];
  const lines = text === '' ? 0 : text.split('\n').length;
  return label ? `${label} · ${lines.toLocaleString()} lines` : `${lines.toLocaleString()} lines`;
};

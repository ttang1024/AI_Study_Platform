/** Rows past this are dropped — the viewer renders a plain table, not a grid. */
export const MAX_TABLE_ROWS = 2000;

export interface DelimitedTable {
  headers: string[];
  rows: string[][];
  /** True when the file had more rows than MAX_TABLE_ROWS. */
  truncated: boolean;
  totalRows: number;
}

const delimiterFor = (fileName: string, text: string): string => {
  if (/\.tsv$/i.test(fileName)) return '\t';
  if (/\.csv$/i.test(fileName)) return ',';

  // Unknown extension: whichever candidate appears most on the first line wins.
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
  const counts = [',', '\t', ';', '|'].map(d => [d, firstLine.split(d).length - 1] as const);
  const best = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] > 0 ? best[0] : ',';
};

/**
 * RFC 4180 parser: quoted fields may contain the delimiter, newlines, and
 * doubled quotes. Anything it cannot make sense of still comes back as rows —
 * the caller decides whether the shape is worth rendering as a table.
 */
export function parseDelimited(text: string, fileName: string): DelimitedTable {
  const delimiter = delimiterFor(fileName, text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    if (ch === '"' && field === '') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      endField();
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      endRow();
      i++;
      continue;
    }

    field += ch;
    i++;
  }

  if (field !== '' || row.length > 0) endRow();

  // A trailing newline leaves one empty row behind.
  while (rows.length > 0 && rows[rows.length - 1].every(cell => cell === '')) rows.pop();

  const [headers = [], ...body] = rows;
  return {
    headers,
    rows: body.slice(0, MAX_TABLE_ROWS),
    truncated: body.length > MAX_TABLE_ROWS,
    totalRows: body.length,
  };
}

/** A table is only worth rendering as a grid if it has more than one column. */
export const isTabular = (table: DelimitedTable): boolean =>
  table.headers.length > 1 && table.rows.length > 0;

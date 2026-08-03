import React, { useMemo } from 'react';
import { parseDelimited, isTabular } from '../../utils/delimitedText';
import { CodeFileViewer } from './CodeFileViewer';

interface Props {
  text: string;
  fileName: string;
}

const isNumeric = (value: string) => value !== '' && !Number.isNaN(Number(value.replace(/,/g, '')));

/**
 * CSV/TSV as a real table. Files that do not parse into a grid (a single
 * column, or free text that happened to be named .csv) fall back to the source
 * view rather than rendering a one-column table that hides the content.
 */
export const TableFileViewer: React.FC<Props> = ({ text, fileName }) => {
  const table = useMemo(() => parseDelimited(text, fileName), [text, fileName]);

  if (!isTabular(table)) return <CodeFileViewer code={text} fileName={fileName} />;

  // Right-align a column only when every cell in it is a number.
  const numericColumns = table.headers.map((_, column) =>
    table.rows.every(row => row[column] === undefined || row[column] === '' || isNumeric(row[column])),
  );

  return (
    <div className="not-prose">
      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium text-zinc-500">
        <span>
          {table.totalRows.toLocaleString()} rows · {table.headers.length} columns
        </span>
        {table.truncated && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
            showing first {table.rows.length.toLocaleString()}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-zinc-50">
            <tr>
              <th className="w-px select-none border-b border-r border-zinc-200 px-2 py-2 text-right text-[11px] font-medium text-zinc-300">
                #
              </th>
              {table.headers.map((header, index) => (
                <th
                  key={index}
                  className="border-b border-zinc-200 px-3 py-2 text-left font-semibold text-zinc-700 whitespace-nowrap"
                >
                  {header || <span className="text-zinc-300">—</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-zinc-50/70 transition-colors">
                <td className="select-none border-r border-zinc-100 px-2 py-1.5 text-right text-[11px] text-zinc-300 tabular-nums">
                  {rowIndex + 1}
                </td>
                {table.headers.map((_, column) => (
                  <td
                    key={column}
                    className={`px-3 py-1.5 text-zinc-700 ${numericColumns[column] ? 'text-right tabular-nums' : ''}`}
                  >
                    {row[column] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

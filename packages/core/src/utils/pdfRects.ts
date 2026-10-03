/**
 * Highlight geometry for PDF annotations.
 *
 * Coordinates are normalised to the page box (0–1 on each axis) rather than stored in points, so a
 * highlight lands in the same place whatever width the page is rendered at — which is what lets
 * web's canvas overlay and rn's WebView paint the same stored annotation.
 */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Rects come back from the API as a JSON string column. Anything unparseable yields no highlight
 * rather than throwing: a single malformed row shouldn't take down the whole document view.
 */
export const parseRects = (rectJson: string): NormRect[] => {
  try {
    const parsed = JSON.parse(rectJson);
    return Array.isArray(parsed) ? (parsed as NormRect[]) : [];
  } catch {
    return [];
  }
};

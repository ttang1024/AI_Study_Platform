import React, { useRef, useEffect } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { xmindMarkToMarkdown } from './xmindMarkdown';

const transformer = new Transformer();

export function MarkmapRenderer({
  text,
  mmRef,
}: {
  text: string;
  mmRef: React.MutableRefObject<Markmap | null>;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Keep the latest transformed data so we can (re)create markmap when the tab becomes visible
  const dataRef = useRef<any>(null);
  const isHiddenRef = useRef(true);

  // Transform text → data; if already visible, push update + refit
  useEffect(() => {
    const markdown = xmindMarkToMarkdown(text);
    const { root } = transformer.transform(markdown);
    dataRef.current = root;

    if (mmRef.current && !isHiddenRef.current) {
      mmRef.current.setData(root);
      requestAnimationFrame(() => mmRef.current?.fit());
    }
  }, [text]);

  // Create / destroy markmap based on SVG visibility.
  // We MUST recreate (not just fit) each time the SVG goes from 0×0 → real dimensions,
  // because Markmap.create() bakes the D3 zoom extent from the SVG size at creation time.
  // A stale 0×0 extent causes fit() to use the wrong viewport centre and rescale() to
  // zoom around (0,0) instead of the midpoint.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;

      if (width > 0 && height > 0 && isHiddenRef.current) {
        // Hidden → visible: (re)create with correct dimensions
        isHiddenRef.current = false;
        if (mmRef.current) { mmRef.current.destroy(); mmRef.current = null; }
        if (dataRef.current) {
          mmRef.current = Markmap.create(svg, {}, dataRef.current);
        }
        // Double-rAF: first frame commits the creation paint, second reads final layout
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            mmRef.current?.fit();
            svg.style.opacity = '1';
          })
        );
      } else if ((width === 0 || height === 0) && !isHiddenRef.current) {
        // Visible → hidden: tear down so next show starts with a fresh instance
        isHiddenRef.current = true;
        svg.style.opacity = '0';
        if (mmRef.current) { mmRef.current.destroy(); mmRef.current = null; }
      } else if (width > 0 && height > 0 && !isHiddenRef.current) {
        // Already visible but dimensions changed (fullscreen toggle, window resize) → refit.
        // markmap's own ResizeObserver only calls renderData(), never fit(), so we must do it.
        // fit() is idempotent and cancels any in-progress transition, so rapid fires are safe.
        requestAnimationFrame(() => mmRef.current?.fit());
      }
    });

    ro.observe(svg);
    return () => ro.disconnect();
  }, []);

  // Final cleanup on unmount
  useEffect(() => () => {
    if (mmRef.current) { mmRef.current.destroy(); mmRef.current = null; }
  }, []);

  // Start invisible; revealed only after fit() confirms correct centering
  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ opacity: 0, transition: 'opacity 0.15s ease' }}
    />
  );
}

import React, { useCallback } from 'react';
import type { Markmap } from 'markmap-view';

// Rasterize the mind map at its FULL natural size rather than the on-screen viewport.
//
// On screen the map is fit-to-view (zoomed out) inside a small container, so capturing the
// container only yields viewport-resolution pixels — blurry when enlarged. Instead we clone
// the live SVG, undo the d3 zoom transform (back to scale 1), and size the clone to the
// content's bounding box. Every node then renders at native resolution. We capture with
// html-to-image (not raw canvas) because markmap node content is HTML inside <foreignObject>,
// which only html-to-image rasterizes reliably. The clone is attached off-screen so
// getComputedStyle resolves while capturing.
const PAGE_PIXEL_RATIO = 2;
const PAGE_PADDING = 24;

export function useMindMapDownloads({
  mmRef,
  activeMindMarkText,
  downloadName,
  closeMenu,
}: {
  mmRef: React.MutableRefObject<Markmap | null>;
  activeMindMarkText: string | null;
  downloadName: string;
  closeMenu: () => void;
}) {
  const captureFullResolution = useCallback(async (): Promise<{
    dataUrl: string;
    width: number;
    height: number;
  } | null> => {
    const liveSvg = (mmRef.current as any)?.svg?.node?.() as SVGSVGElement | undefined;
    if (!liveSvg) return null;
    const liveG = liveSvg.querySelector<SVGGraphicsElement>(':scope > g');
    if (!liveG) return null;

    const bbox = liveG.getBBox();
    if (!bbox.width || !bbox.height) return null;
    const width = Math.ceil(bbox.width + PAGE_PADDING * 2);
    const height = Math.ceil(bbox.height + PAGE_PADDING * 2);

    const clone = liveSvg.cloneNode(true) as SVGSVGElement;
    const cloneG = clone.querySelector<SVGGraphicsElement>(':scope > g');
    cloneG?.setAttribute('transform', `translate(${PAGE_PADDING - bbox.x},${PAGE_PADDING - bbox.y})`);
    clone.setAttribute('width', `${width}`);
    clone.setAttribute('height', `${height}`);
    clone.setAttribute('viewBox', `0 0 ${width} ${height}`);
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.opacity = '1';

    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;';
    holder.appendChild(clone);
    document.body.appendChild(holder);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(clone as unknown as HTMLElement, {
        backgroundColor: '#ffffff',
        width,
        height,
        pixelRatio: PAGE_PIXEL_RATIO,
      });
      return { dataUrl, width, height };
    } finally {
      document.body.removeChild(holder);
    }
  }, []);

  const downloadAsImage = useCallback(async () => {
    closeMenu();
    const result = await captureFullResolution();
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.dataUrl;
    a.download = `${downloadName}.png`;
    a.click();
  }, [downloadName, captureFullResolution, closeMenu]);

  const downloadAsPdf = useCallback(async () => {
    closeMenu();
    const result = await captureFullResolution();
    if (!result) return;
    const { dataUrl, width, height } = result;
    const { default: jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: width > height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [width, height],
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
    pdf.save(`${downloadName}.pdf`);
  }, [downloadName, captureFullResolution, closeMenu]);

  const downloadAsXMind = useCallback(async () => {
    closeMenu();
    if (!activeMindMarkText) return;
    try {
      const { parseXMindMarkToXMindFile } = await import('xmindmark');
      const buffer = await parseXMindMarkToXMindFile(activeMindMarkText);
      const blob = new Blob([buffer], { type: 'application/vnd.xmind.workbook' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${downloadName}.xmind`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      console.error('xmind download failed', err);
    }
  }, [activeMindMarkText, downloadName, closeMenu]);

  const downloadAsXMindMark = useCallback(() => {
    closeMenu();
    if (!activeMindMarkText) return;
    const blob = new Blob([activeMindMarkText], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${downloadName}.xmindmark`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [activeMindMarkText, downloadName, closeMenu]);

  return { downloadAsImage, downloadAsPdf, downloadAsXMind, downloadAsXMindMark };
}

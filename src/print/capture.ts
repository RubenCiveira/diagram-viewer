import { getViewportForBounds, type Rect, type Viewport } from '@xyflow/react';
import { toPng } from 'html-to-image';

export type CaptureArea = 'view' | 'fit';
export type Capture = { dataUrl: string; width: number; height: number };

/** Lado mayor de la imagen al capturar todo el diagrama */
const FIT_SIZE = 2400;

/**
 * Captura el lienzo de React Flow como PNG:
 * - `view`: lo que se ve ahora (mismo encuadre y tamaño que el lienzo);
 * - `fit`: todo el diagrama, encuadrado con un pequeño margen.
 */
export async function captureDiagram(
  container: HTMLElement,
  /** Límites absolutos de todos los nodos (de la instancia de React Flow, que conoce los padres) */
  bounds: Rect,
  viewport: Viewport,
  area: CaptureArea,
  background: string,
): Promise<Capture> {
  const target = container.querySelector<HTMLElement>('.react-flow__viewport');
  if (!target) throw new Error('No se encuentra el lienzo del diagrama');

  let width: number;
  let height: number;
  let vp: Viewport;
  if (area === 'view') {
    width = container.clientWidth;
    height = container.clientHeight;
    vp = viewport;
  } else {
    const ratio = bounds.width / Math.max(bounds.height, 1);
    width = ratio >= 1 ? FIT_SIZE : Math.round(FIT_SIZE * ratio);
    height = ratio >= 1 ? Math.round(FIT_SIZE / ratio) : FIT_SIZE;
    vp = getViewportForBounds(bounds, width, height, 0.05, 4, 0.04);
  }

  const dataUrl = await toPng(target, {
    backgroundColor: background,
    width,
    height,
    pixelRatio: area === 'view' ? 2 : 1,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
  });
  return { dataUrl, width, height };
}

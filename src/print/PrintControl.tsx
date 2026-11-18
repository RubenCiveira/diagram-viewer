import React from 'react';
import { createPortal } from 'react-dom';
import { useReactFlow } from '@xyflow/react';
import { Printer, X } from 'lucide-react';
import type { ViewModel } from '../diagram';
import type { PaletteInterface } from '../palette';
import { captureDiagram, type CaptureArea } from './capture';
import { buildInventory, plainText } from './inventory';
import { buildPdf } from './pdf';

type Props = {
  view: ViewModel;
  palette: PaletteInterface;
  title: string;
  /** Ruta del diagrama, para el pie de página */
  source: string;
  /** Fuerza un tema mientras se captura (null = volver al del usuario) */
  setThemeOverride: (t: 'light' | 'dark' | null) => void;
  onError: (message: string) => void;
};

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Botón «Imprimir» y su diálogo. Debe estar dentro del lienzo de React Flow. */
export default function PrintControl({ view, palette, title, source, setThemeOverride, onError }: Props) {
  const rf = useReactFlow();
  const [open, setOpen] = React.useState(false);
  const [area, setArea] = React.useState<CaptureArea>('fit');
  const [inventory, setInventory] = React.useState(true);
  const [orientation, setOrientation] = React.useState<'landscape' | 'portrait'>('landscape');
  const [busy, setBusy] = React.useState(false);
  /** Capa que tapa el visor mientras se captura en tema claro (con los colores fijos del tema actual) */
  const [cover, setCover] = React.useState<{ bg: string; fg: string } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy]);

  const generate = async () => {
    setBusy(true);
    try {
      // Tapar el visor antes de pasar a tema claro, para que el cambio no se vea
      const body = getComputedStyle(document.body);
      setCover({ bg: body.backgroundColor, fg: body.color });
      await nextFrame();
      // Imagen siempre en tema claro: esperar a que se apliquen los estilos
      setThemeOverride('light');
      await nextFrame();
      await nextFrame();
      const container = document.querySelector<HTMLElement>('.react-flow');
      if (!container) throw new Error('No se encuentra el lienzo del diagrama');
      const image = await captureDiagram(container, rf.getNodesBounds(rf.getNodes()), rf.getViewport(), area, '#ffffff');
      setThemeOverride(null);
      const doc = buildPdf({
        title,
        description: plainText(view.description),
        source,
        image,
        orientation: inventory ? 'portrait' : orientation,
        inventory: inventory ? buildInventory(view, palette) : undefined,
      });
      doc.save(`${title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'diagrama'}.pdf`);
      setOpen(false);
    } catch (e: any) {
      onError(`No se ha podido generar el PDF: ${e?.message ?? e}`);
    } finally {
      setThemeOverride(null);
      await nextFrame();
      setCover(null);
      setBusy(false);
    }
  };

  return (
    <>
      <button className="dv-icon-btn" onClick={() => setOpen(true)} title="Imprimir (PDF)">
        <Printer size={15} />
      </button>
      {cover &&
        createPortal(
          <div className="dv-print-cover" style={{ background: cover.bg, color: cover.fg }} role="status">
            <Printer size={20} /> Generando PDF…
          </div>,
          document.body,
        )}
      {open &&
        !cover &&
        createPortal(
          <div className="dv-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && setOpen(false)}>
            <div className="dv-modal" role="dialog" aria-modal="true" aria-labelledby="dv-print-title">
              <header className="dv-modal-head">
                <h2 id="dv-print-title">Imprimir diagrama</h2>
                <button className="dv-icon-btn" onClick={() => setOpen(false)} disabled={busy} title="Cerrar (Esc)">
                  <X size={16} />
                </button>
              </header>

              <fieldset className="dv-choice">
                <legend>¿Qué imprimir?</legend>
                <label>
                  <input type="radio" checked={area === 'view'} onChange={() => setArea('view')} />
                  <span>
                    Recuadro actual<small>Lo que se ve ahora, con el mismo encuadre y zoom.</small>
                  </span>
                </label>
                <label>
                  <input type="radio" checked={area === 'fit'} onChange={() => setArea('fit')} />
                  <span>
                    Todo el diagrama<small>Ajustado para que quepa entero.</small>
                  </span>
                </label>
              </fieldset>

              <fieldset className="dv-choice">
                <legend>Inventario</legend>
                <label>
                  <input type="radio" checked={inventory} onChange={() => setInventory(true)} />
                  <span>
                    Incluir inventario<small>Tras la imagen, una ficha por nodo con descripción, propiedades y relaciones. Página vertical.</small>
                  </span>
                </label>
                <label>
                  <input type="radio" checked={!inventory} onChange={() => setInventory(false)} />
                  <span>Sólo la imagen</span>
                </label>
              </fieldset>

              {!inventory && (
                <fieldset className="dv-choice dv-choice-row">
                  <legend>Orientación</legend>
                  <label>
                    <input type="radio" checked={orientation === 'landscape'} onChange={() => setOrientation('landscape')} />
                    <span>Apaisada</span>
                  </label>
                  <label>
                    <input type="radio" checked={orientation === 'portrait'} onChange={() => setOrientation('portrait')} />
                    <span>Vertical</span>
                  </label>
                </fieldset>
              )}

              <footer className="dv-modal-foot">
                <button className="dv-btn" onClick={() => setOpen(false)} disabled={busy}>
                  Cancelar
                </button>
                <button className="dv-btn dv-btn-primary" onClick={generate} disabled={busy}>
                  <Printer size={16} /> {busy ? 'Generando…' : 'Generar PDF'}
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

import React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CircleAlert, Link2, TriangleAlert, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { findEdgeType, findNodeType, type PaletteInterface } from '../../palette';
import type { DetailField, DetailTarget, ElementDetail } from '../../palette/DiagramElementType';
import type { CatalogIndex, ViewModel, ViewNode } from '../resolve';

type Props = {
  target: DetailTarget | null;
  model: ViewModel;
  catalog: CatalogIndex | null;
  path: string;
  palette: PaletteInterface;
  onClose: () => void;
};

type View = {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  detail: ElementDetail;
  errors?: string[];
  warns?: string[];
  /** Etiquetas de origen: catálogo, importado… */
  tags?: string[];
  /** Relaciones del nodo en el catálogo (estén o no pintadas) */
  relations?: RelationRow[];
  footer: string;
};

type RelationRow = { dir: 'out' | 'in'; other: string; type?: string; label?: string; shown: boolean; uses?: boolean };

/** Ficha lateral con los datos del nodo o la arista seleccionados. */
export default function DetailPanel({ target, model, catalog, path, palette, onClose }: Props) {
  const view = React.useMemo(
    () => (target ? buildView(target, model, catalog, path, palette) : null),
    [target, model, catalog, path, palette],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <aside className={`dv-detail${view ? ' is-open' : ''}`} aria-hidden={!view}>
      {view && (
        <>
          <header className="dv-detail-head">
            {view.icon && <div className="dv-detail-icon">{view.icon}</div>}
            <div className="dv-detail-titles">
              <h2>{view.title}</h2>
              <div className="dv-detail-sub">{view.subtitle}</div>
            </div>
            <button className="dv-icon-btn" onClick={onClose} title="Cerrar (Esc)">
              <X size={16} />
            </button>
          </header>
          <div className="dv-detail-body">
            {!!view.tags?.length && (
              <div className="dv-chips">
                {view.tags.map((t) => (
                  <span key={t} className="dv-chip">
                    {t}
                  </span>
                ))}
              </div>
            )}
            {!!view.errors?.length && <Issues kind="error" items={view.errors} />}
            {!!view.warns?.length && <Issues kind="warn" items={view.warns} />}
            {view.detail.description && (
              <div className="dv-md">
                <ReactMarkdown>{view.detail.description}</ReactMarkdown>
              </div>
            )}
            {view.detail.fields.length > 0 && <Fields fields={view.detail.fields} />}
            {!!view.relations?.length && <Relations rows={view.relations} />}
            {!view.detail.description && !view.detail.fields.length && !view.errors?.length && !view.relations?.length && (
              <p className="dv-muted">Sin propiedades</p>
            )}
          </div>
          <footer className="dv-detail-foot" title={view.footer}>
            {view.footer}
          </footer>
        </>
      )}
    </aside>
  );
}

function buildView(
  target: DetailTarget,
  model: ViewModel,
  catalog: CatalogIndex | null,
  path: string,
  palette: PaletteInterface,
): View | null {
  const name = (n: ViewNode) => findNodeType(n.type, palette).label({ name: n.name, props: n.props });
  if (target.type === 'node') {
    const { node } = target;
    const type = findNodeType(node.type, palette);
    const view: View = {
      icon: type.paletteIcon,
      title: name(node),
      subtitle: type.title,
      detail: type.detail?.(node.props, node) ?? { fields: [] },
      errors: node.errors,
      warns: node.warns,
      footer: `${path} › ${node.id}`,
    };
    if (node.origin.kind === 'ref' && catalog?.nodes.has(node.origin.catalogId)) {
      const id = node.origin.catalogId;
      view.tags = [`Catálogo: ${id}`, ...(node.origin.imported ? ['Importado por una relación'] : [])];
      view.footer = node.origin.imported ? `catálogo › ${id}` : view.footer;
      const shown = new Set(model.edges.map((e) => e.relationId).filter(Boolean));
      const label = (cid: string) => {
        const c = catalog.nodes.get(cid);
        return c ? (c.name ?? findNodeType(c.type, palette).label({ name: c.name, props: c.props ?? {} })) : cid;
      };
      view.relations = [
        ...(catalog.outgoing.get(id) ?? []).map((r) => ({ dir: 'out' as const, other: label(r.target), type: r.type, label: r.label, shown: shown.has(r.id), uses: r.uses })),
        ...(catalog.incoming.get(id) ?? []).map((r) => ({ dir: 'in' as const, other: label(r.source), type: r.type, label: r.label, shown: shown.has(r.id), uses: r.uses })),
      ];
    }
    return view;
  }
  const { edge } = target;
  const source = model.nodes.find((n) => n.id === edge.source);
  const target_ = model.nodes.find((n) => n.id === edge.target);
  if (!source || !target_) return null;
  const ctx = { edge, source, target: target_ };
  const edgeType = findEdgeType(ctx, palette);
  const detail = edgeType?.detail?.(edge.props ?? {}, ctx) ?? { description: edge.description, fields: [] };
  if (edge.technology) detail.fields = [{ label: 'Tecnología', value: edge.technology }, ...detail.fields];
  if (edge.type) detail.fields = [{ label: 'Tipo de relación', value: edge.type }, ...detail.fields];
  return {
    tags: [...(edge.uses ? ['Uso (acoplamiento fuerte)'] : []), ...(edge.relationId ? [`Catálogo: ${edge.relationId}`] : [])],
    icon: <Link2 size={18} />,
    title: edge.label ?? edgeType?.label?.(ctx) ?? edgeType?.title ?? 'Conexión',
    subtitle: `${name(source)} → ${name(target_)}`,
    detail,
    footer: edge.relationId ? `catálogo › ${edge.relationId}` : `${path} › ${edge.id}`,
  };
}

function Relations({ rows }: { rows: RelationRow[] }) {
  return (
    <section>
      <h3 className="dv-detail-section">Relaciones en el catálogo</h3>
      <ul className="dv-relations">
        {rows.map((r, i) => (
          <li
            key={i}
            className={r.shown ? '' : 'is-hidden'}
            title={`${r.uses ? 'Uso (acoplamiento fuerte). ' : ''}${r.shown ? 'Pintada en este diagrama' : 'No incluida en este diagrama'}`}
          >
            {r.uses ? (
              r.dir === 'out' ? <ArrowDown size={14} className="is-uses" /> : <ArrowUp size={14} className="is-uses" />
            ) : r.dir === 'out' ? (
              <ArrowRight size={14} />
            ) : (
              <ArrowLeft size={14} />
            )}
            <span className="dv-relations-other">{r.other}</span>
            {r.label && <span className="dv-muted">{r.label}</span>}
            {r.type && <span className="dv-chip">{r.type}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Issues({ kind, items }: { kind: 'error' | 'warn'; items: string[] }) {
  return (
    <ul className={`dv-issues dv-issues-${kind}`}>
      {items.map((t, i) => (
        <li key={i}>
          {kind === 'error' ? <CircleAlert size={14} /> : <TriangleAlert size={14} />}
          {t}
        </li>
      ))}
    </ul>
  );
}

function Fields({ fields }: { fields: DetailField[] }) {
  return (
    <dl className="dv-fields">
      {fields.map((f, i) => (
        <React.Fragment key={i}>
          <dt>{f.label}</dt>
          <dd>
            <Value value={f.value} />
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function Value({ value }: { value: unknown }): React.ReactNode {
  if (value == null || value === '') return <span className="dv-muted">—</span>;
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (Array.isArray(value)) {
    if (value.every((v) => v == null || typeof v !== 'object'))
      return (
        <div className="dv-chips">
          {value.map((v, i) => (
            <span key={i} className="dv-chip">
              {String(v)}
            </span>
          ))}
        </div>
      );
    return value.map((v, i) => <Value key={i} value={v} />);
  }
  if (typeof value === 'object') return <Fields fields={Object.entries(value).map(([label, v]) => ({ label, value: v }))} />;
  const text = String(value);
  if (/^https?:\/\/\S+$/.test(text))
    return (
      <a href={text} target="_blank" rel="noopener noreferrer">
        {text}
      </a>
    );
  return text;
}

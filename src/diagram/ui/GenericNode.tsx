import { Handle, Position, type NodeProps } from '@xyflow/react';
import { CircleAlert, Layers, TriangleAlert } from 'lucide-react';
import type { GenericFlowNode, HandleId } from './toFlow';

type HandleDef = { id: HandleId; type: 'source' | 'target'; position: Position };

/** El flujo lateral (in/out) sigue la dirección del diagrama; el anidado (parent/children) va en perpendicular. */
const HANDLES: Record<'LR' | 'TB', HandleDef[]> = {
  LR: [
    { id: 'in', type: 'target', position: Position.Left },
    { id: 'out', type: 'source', position: Position.Right },
    { id: 'parent', type: 'target', position: Position.Top },
    { id: 'children', type: 'source', position: Position.Bottom },
  ],
  TB: [
    { id: 'in', type: 'target', position: Position.Top },
    { id: 'out', type: 'source', position: Position.Bottom },
    { id: 'parent', type: 'target', position: Position.Left },
    { id: 'children', type: 'source', position: Position.Right },
  ],
};

/** Nodo único para todos los kinds: la forma, el icono y la etiqueta los decide el tipo de la paleta. */
export default function GenericNode({ data, selected }: NodeProps<GenericFlowNode>) {
  const { node, type, label, size, handles, clickable, direction } = data;
  const props = node.props;
  const imported = node.origin.kind === 'ref' && node.origin.imported;
  const background = type.isBackground?.() ?? false;

  const content = (
    <>
      {type.nodeIcon?.(props)}
      {!!node.errors?.length && (
        <span className="dv-flag dv-flag-error" title={node.errors.join('\n')}>
          <CircleAlert size={14} />
        </span>
      )}
      {node.subdiagram && (
        <span className="dv-flag dv-flag-sub" title="Abre su subdiagrama">
          <Layers size={12} />
        </span>
      )}
      {!!node.warns?.length && (
        <span className="dv-flag dv-flag-warn" title={node.warns.join('\n')}>
          <TriangleAlert size={14} />
        </span>
      )}
    </>
  );
  const shape = type.renderShape?.(props, content) ?? <div className="dv-shape dv-shape-square">{content}</div>;
  const tooltip = type.open ? node.description : undefined;

  return (
    <div
      className={['dv-node', background && 'is-background', clickable && 'is-clickable', selected && 'is-selected', imported && 'is-imported']
        .filter(Boolean)
        .join(' ')}
      title={tooltip}
    >
      <div className="dv-node-box" style={{ width: size.width, height: size.height }}>
        {HANDLES[direction].map((h) => (
          <Handle
            key={h.id}
            id={h.id}
            type={h.type}
            position={h.position}
            isConnectable={false}
            className={handles.includes(h.id) ? 'dv-handle' : 'dv-handle is-hidden'}
          />
        ))}
        {shape}
      </div>
      {!background && (
        <div className="dv-node-label" style={{ width: Math.max(size.width, 140) }}>
          {label}
        </div>
      )}
    </div>
  );
}

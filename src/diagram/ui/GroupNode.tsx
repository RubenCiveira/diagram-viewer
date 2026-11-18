import type { CSSProperties } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { GroupFlowNode } from './toFlow';

/** Caja que envuelve a los nodos de un grupo, con su nombre arriba a la izquierda. */
export default function GroupNode({ data }: NodeProps<GroupFlowNode>) {
  const { group } = data;
  return (
    <div
      className="dv-group"
      style={group.color ? ({ '--c': group.color } as CSSProperties) : undefined}
      title={group.description}
    >
      <div className="dv-group-label">{group.name}</div>
    </div>
  );
}

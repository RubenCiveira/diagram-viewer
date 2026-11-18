import React from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type ColorMode,
} from '@xyflow/react';
import type { PaletteInterface } from '../../palette';
import type { ViewModel, ViewNode } from '../resolve';
import GenericNode from './GenericNode';
import GroupNode from './GroupNode';
import { toFlow, type FlowEdge, type FlowNode } from './toFlow';
import type { DetailTarget } from '../../palette/DiagramElementType';
import type { Viewport } from '../../app/urlState';

const NODE_TYPES = { generic: GenericNode, dvgroup: GroupNode };

type Props = {
  model: ViewModel;
  palette: PaletteInterface;
  colorMode: ColorMode;
  onActivateNode: (node: ViewNode) => void;
  onShowDetail: (target: DetailTarget | null) => void;
  onWarnings?: (warnings: string[]) => void;
  /** Encuadre inicial (de la URL). Si falta, se ajusta el diagrama a la vista. */
  initialViewport?: Viewport;
  /** Nodo o arista seleccionado al montar (de la URL) */
  selectedId?: string;
  /** Al terminar de desplazar o hacer zoom */
  onViewportChange?: (vp: Viewport) => void;
  /** Paneles superpuestos (cabecera, barra de herramientas…) */
  children?: React.ReactNode;
};

/**
 * Lienzo de sólo lectura. Los nodos se pueden mover para despejar la vista,
 * pero no se guarda nada. Se debe montar con un `key` distinto por diagrama
 * para que el estado y el encuadre inicial se reinicien.
 */
export default function DiagramCanvas({
  model,
  palette,
  colorMode,
  onActivateNode,
  onShowDetail,
  onWarnings,
  initialViewport,
  selectedId,
  onViewportChange,
  children,
}: Props) {
  const initial = React.useMemo(() => toFlow(model, palette), [model, palette]);
  // La selección inicial sólo se aplica al montar (cada diagrama monta un lienzo nuevo)
  const [nodes, , onNodesChange] = useNodesState<FlowNode>(
    selectedId ? initial.nodes.map((n) => (n.id === selectedId ? { ...n, selected: true } : n)) : initial.nodes,
  );
  const [edges, , onEdgesChange] = useEdgesState<FlowEdge>(
    selectedId ? initial.edges.map((e) => (e.id === selectedId ? { ...e, selected: true } : e)) : initial.edges,
  );

  React.useEffect(() => {
    if (initial.warnings.length) onWarnings?.(initial.warnings);
  }, [initial, onWarnings]);

  return (
    <ReactFlow<FlowNode, FlowEdge>
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={(_, n) => n.type === 'generic' && n.data.clickable && onActivateNode(n.data.node)}
      onEdgeClick={(_, e) => e.data?.clickable && onShowDetail({ type: 'edge', edge: e.data.edge })}
      onPaneClick={() => onShowDetail(null)}
      nodesConnectable={false}
      edgesFocusable={false}
      deleteKeyCode={null}
      colorMode={colorMode}
      minZoom={0.1}
      maxZoom={3}
      fitView={!initialViewport}
      defaultViewport={initialViewport}
      onMoveEnd={(_, vp) => onViewportChange?.(vp)}
      // Margen superior extra para que la cabecera no tape los nodos
      fitViewOptions={{ padding: { top: '140px', bottom: '40px', left: '60px', right: '60px' }, maxZoom: 1.2 }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap position="bottom-right" pannable zoomable nodeBorderRadius={6} />
      {children}
      {!model.nodes.length && (
        <Panel position="top-center" className="dv-empty">
          Este diagrama no tiene nodos
        </Panel>
      )}
    </ReactFlow>
  );
}

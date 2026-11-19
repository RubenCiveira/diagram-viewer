import React from 'react';
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type ColorMode,
} from '@xyflow/react';
import { Lock, LockOpen } from 'lucide-react';
import type { PaletteInterface } from '../../palette';
import type { ViewModel, ViewNode } from '../resolve';
import GenericNode from './GenericNode';
import GroupNode from './GroupNode';
import { relatedEdges, toFlow, type FlowEdge, type FlowNode } from './toFlow';
import type { DetailTarget } from '../../palette/DiagramElementType';
import type { Viewport } from '../../app/urlState';

const NODE_TYPES = { generic: GenericNode, dvgroup: GroupNode };

/**
 * Bloqueo de nodos: el lienzo se monta de nuevo con cada diagrama, así que se recuerda aquí lo
 * último elegido para no volver a bloquear al navegar. Al cargar la página empieza bloqueado.
 */
let lockedPref = true;

type Props = {
  model: ViewModel;
  palette: PaletteInterface;
  colorMode: ColorMode;
  onActivateNode: (node: ViewNode) => void;
  onShowDetail: (target: DetailTarget | null) => void;
  /** Al cambiar el nodo seleccionado (`null` si no hay ninguno, o no se puede activar) */
  onSelectNode?: (node: ViewNode | null) => void;
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
 * Lienzo de sólo lectura. Desbloqueado, los nodos se pueden mover para despejar la vista,
 * pero no se guarda nada. Se debe montar con un `key` distinto por diagrama
 * para que el estado y el encuadre inicial se reinicien.
 */
export default function DiagramCanvas({
  model,
  palette,
  colorMode,
  onActivateNode,
  onShowDetail,
  onSelectNode,
  onWarnings,
  initialViewport,
  selectedId,
  onViewportChange,
  children,
}: Props) {
  const [locked, setLocked] = React.useState(lockedPref);
  const toggleLock = () => setLocked((v) => (lockedPref = !v));
  const initial = React.useMemo(() => toFlow(model, palette), [model, palette]);
  // La selección inicial sólo se aplica al montar (cada diagrama monta un lienzo nuevo)
  const [nodes, , onNodesChange] = useNodesState<FlowNode>(
    selectedId ? initial.nodes.map((n) => (n.id === selectedId ? { ...n, selected: true } : n)) : initial.nodes,
  );
  const [edges, , onEdgesChange] = useEdgesState<FlowEdge>(
    selectedId ? initial.edges.map((e) => (e.id === selectedId ? { ...e, selected: true } : e)) : initial.edges,
  );

  // Resaltado: con un nodo seleccionado, sus aristas (y el resto de tramos de las que pasan por un
  // intermedio) y, más suaves, las transitivas de entrada y salida; con una arista, igual a partir
  // de ella. Las demás se atenúan.
  const selNode = nodes.find((n) => n.selected && n.type === 'generic')?.id;
  const selEdge = selNode ? undefined : edges.find((e) => e.selected)?.id;
  const shownEdges = React.useMemo(() => {
    if (!selNode && !selEdge) return edges;
    const { direct, transitive } = relatedEdges(edges, { nodeId: selNode, edgeId: selEdge });
    if (!direct.size && !transitive.size) return edges;
    return edges.map((e) => {
      const level = direct.has(e.id) ? 'is-highlighted' : transitive.has(e.id) ? 'is-related' : 'is-dimmed';
      const on = level !== 'is-dimmed';
      const base = (e.className ?? '').replace(/ ?is-(highlighted|related|dimmed)/g, '');
      // Sin color propio, la punta de flecha toma el del resaltado
      const marker = on && !e.style?.stroke && typeof e.markerEnd === 'object' ? { markerEnd: { ...e.markerEnd, color: 'var(--dv-accent)' } } : {};
      return { ...e, ...marker, className: `${base} ${level}`, zIndex: level === 'is-highlighted' ? 2 : on ? 1 : 0 };
    });
  }, [edges, selNode, selEdge]);

  // Un clic sólo selecciona; un clic sobre el nodo ya seleccionado, o un doble clic, lo activa
  // (abre su ficha o su subdiagrama). La selección de antes del clic se lee de una ref: cuando
  // llega `onNodeClick`, React Flow ya ha pedido seleccionarlo pero aún no se ha repintado.
  const selRef = React.useRef(selNode);
  selRef.current = selNode;
  const lastActivation = React.useRef({ id: '', at: 0 });
  const activate = (n: FlowNode) => {
    if (n.type !== 'generic' || !n.data.clickable) return;
    // El doble clic llega tras dos clics: si el primero ya lo activó, no se repite
    const last = lastActivation.current;
    if (last.id === n.id && Date.now() - last.at < 600) return;
    lastActivation.current = { id: n.id, at: Date.now() };
    onActivateNode(n.data.node);
  };
  const onNodeClick = (event: React.MouseEvent, n: FlowNode) => {
    // El segundo clic de un doble clic lo atiende `onNodeDoubleClick`
    if (event.detail > 1) return;
    if (selRef.current === n.id) activate(n);
  };

  const selected = nodes.find((n) => n.id === selNode);
  const selectedView = selected?.type === 'generic' && selected.data.clickable ? selected.data.node : null;
  React.useEffect(() => {
    onSelectNode?.(selectedView);
  }, [selectedView, onSelectNode]);
  React.useEffect(() => () => onSelectNode?.(null), [onSelectNode]);

  React.useEffect(() => {
    if (initial.warnings.length) onWarnings?.(initial.warnings);
  }, [initial, onWarnings]);

  return (
    <ReactFlow<FlowNode, FlowEdge>
      nodes={nodes}
      edges={shownEdges}
      nodeTypes={NODE_TYPES}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={(_, n) => activate(n)}
      zoomOnDoubleClick={false}
      onEdgeClick={(_, e) => e.data?.clickable && onShowDetail({ type: 'edge', edge: e.data.edge })}
      onPaneClick={() => onShowDetail(null)}
      nodesConnectable={false}
      nodesDraggable={!locked}
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
      <Controls showInteractive={false} position="bottom-left">
        <ControlButton
          onClick={toggleLock}
          className={locked ? 'dv-lock is-locked' : 'dv-lock'}
          title={locked ? 'Desbloquear: permitir mover los nodos' : 'Bloquear: impedir mover los nodos'}
          aria-label={locked ? 'Desbloquear nodos' : 'Bloquear nodos'}
          aria-pressed={locked}
        >
          {locked ? <Lock /> : <LockOpen />}
        </ControlButton>
      </Controls>
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

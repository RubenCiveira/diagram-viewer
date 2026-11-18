import type { CSSProperties, ReactNode } from 'react';
import { Layers } from 'lucide-react';
import { baseName, INLINE_SEP, stripExt, type ViewNode } from '../../../../diagram';
import type { DiagramElementType, DiagramViewerContext } from '../../../DiagramElementType';

export type SubdiagramProps = {
  /** Fichero del diagrama, relativo al diagrama que contiene el nodo (viene de `file` en kind=diagram) */
  file?: string;
  /** Color de acento */
  color?: string;
};

/**
 * Tipo de los nodos `kind: "diagram"`: representa otro diagrama. Al pulsarlo,
 * el visor navega a ese fichero y lo añade a las migas de pan.
 */
export class SubdiagramElement implements DiagramElementType<SubdiagramProps> {
  kind = 'subdiagram';
  title = 'Subdiagrama';
  paletteIcon = (<Layers size={18} />);

  nodeIcon() {
    return <Layers size={40} strokeWidth={1.6} />;
  }

  label({ name, props }: { name?: string; props: SubdiagramProps }) {
    return name ?? (stripExt(baseName((props?.file ?? '').split(INLINE_SEP).pop() ?? '')) || 'Subdiagrama');
  }

  category() {
    return 'component' as const;
  }

  nodeSize() {
    return { width: 104, height: 96 };
  }

  renderShape(props: SubdiagramProps, content: ReactNode): ReactNode {
    return (
      <div className="dv-shape dv-shape-stack" style={{ '--c': props?.color ?? '#6366f1' } as CSSProperties}>
        {content}
      </div>
    );
  }

  open(props: SubdiagramProps, node: ViewNode, viewer: DiagramViewerContext) {
    if (props?.file) viewer.openDiagram(props.file, this.label({ name: node.name, props }));
    else viewer.showDetail({ type: 'node', node });
  }

  detail(props: SubdiagramProps, node: ViewNode) {
    return {
      description: node.description,
      fields: [
        props?.file?.startsWith(INLINE_SEP)
          ? { label: 'Definición', value: 'En este mismo diagrama' }
          : { label: 'Fichero', value: props?.file || '⚠ Falta "file" o "diagram"' },
      ],
    };
  }
}

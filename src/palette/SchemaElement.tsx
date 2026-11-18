import type { CSSProperties, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ElementType, ViewNode } from '../diagram';
import type { DiagramElementType, ElementDetail, NodeCategory } from './DiagramElementType';
import { schemaFields, type Definition } from './schema';

/**
 * Base para los tipos de nodo cuyo contenido se describe con un JSON Schema:
 * icono, color, forma y ficha generada a partir del schema. Los tipos
 * concretos sólo declaran kind, title, icon y definition().
 */
export abstract class SchemaElement<P extends Record<string, any> = Record<string, any>>
  implements DiagramElementType<P>
{
  abstract kind: ElementType;
  abstract title: string;
  protected abstract icon: LucideIcon;
  /** Color de acento del borde y del icono */
  protected color = '#64748b';
  protected shape: 'square' | 'round' = 'square';

  get paletteIcon(): ReactNode {
    const Icon = this.icon;
    return <Icon size={18} />;
  }

  nodeIcon(_props: P): ReactNode {
    const Icon = this.icon;
    return <Icon size={this.shape === 'round' ? 34 : 42} strokeWidth={1.6} />;
  }

  definition(): Definition {
    return { schema: {} };
  }

  label({ name }: { name?: string; props: P }): string {
    return name ?? this.title;
  }

  category(): NodeCategory {
    return 'component';
  }

  nodeSize(_input: { props: P }) {
    return this.shape === 'round' ? { width: 80, height: 80 } : { width: 96, height: 96 };
  }

  renderShape(_props: P, content: ReactNode): ReactNode {
    return (
      <div className={`dv-shape dv-shape-${this.shape}`} style={{ '--c': this.color } as CSSProperties}>
        {content}
      </div>
    );
  }

  detail(props: P, node: ViewNode): ElementDetail | null {
    return {
      description: node.description ?? (typeof props?.description === 'string' ? props.description : undefined),
      fields: schemaFields(this.definition().schema, props),
    };
  }
}

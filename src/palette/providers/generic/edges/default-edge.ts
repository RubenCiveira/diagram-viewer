import { SchemaEdgeType } from '../../../SchemaEdgeType';

/**
 * Conexión sin tipo específico: aplica a todo con la mínima precedencia, así
 * cualquier arista con descripción o props tiene ficha.
 */
export class DefaultEdge extends SchemaEdgeType {
  title = 'Conexión';

  precedence() {
    return 0.1;
  }
}

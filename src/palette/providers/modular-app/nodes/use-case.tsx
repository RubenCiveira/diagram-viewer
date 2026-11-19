import { Workflow } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

/** Caso de uso: pieza interna de un microservicio (se ve en su detalle) */
export class UseCaseElement extends SchemaElement {
  kind = 'useCase';
  title = 'Caso de uso';
  protected icon = Workflow;
  protected color = '#8b5cf6';
  protected shape = 'round' as const;

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Caso de uso',
        properties: {
          trigger: { type: 'string', title: 'Disparador', description: 'REST, evento, batch…' },
          endpoint: { type: 'string', title: 'Endpoint / evento' },
          transactional: { type: 'boolean', title: 'Transaccional' },
        },
      },
    };
  }
}

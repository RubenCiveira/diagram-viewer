import { ExternalLink } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

export class ExternalTransactionElement extends SchemaElement {
  kind = 'externalTransaction';
  title = 'Transactional';
  protected icon = ExternalLink;
  protected color = '#71717a';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Transactional',
        properties: {
          type: { type: 'string', title: 'Tipo' },
          name: { type: 'string', title: 'Nombre' },
          endpoint: { type: 'string', title: 'Endpoint', format: 'url' },
          notes: { type: 'string', title: 'Notas' },
        },
      },
    };
  }
}

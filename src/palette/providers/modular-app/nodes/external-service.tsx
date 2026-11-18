import { ExternalLink } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

export class ExternalServiceElement extends SchemaElement {
  kind = 'externalService';
  title = 'Servicio REST';
  protected icon = ExternalLink;
  protected color = '#64748b';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Servicio REST',
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

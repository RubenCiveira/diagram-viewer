import { ExternalLink } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

export class ExternalSoapElement extends SchemaElement {
  kind = 'externalSoap';
  title = 'Web service';
  protected icon = ExternalLink;
  protected color = '#78716c';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Web service',
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

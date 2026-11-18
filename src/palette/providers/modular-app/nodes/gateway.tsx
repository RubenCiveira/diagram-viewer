import { Router } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

export class GatewayElement extends SchemaElement {
  kind = 'gateway';
  title = 'Gateway';
  protected icon = Router;
  protected color = '#22c55e';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Gateway de entrada',
        properties: {
          namePattern: { type: 'string', title: 'Nombre / patrón' },
          entryHost: { type: 'string', title: 'Host de entrada' },
          entryPath: { type: 'string', title: 'Path base' },
          rateLimit: { type: 'number', title: 'Rate limit (req/s)' },
        },
      },
    };
  }
}

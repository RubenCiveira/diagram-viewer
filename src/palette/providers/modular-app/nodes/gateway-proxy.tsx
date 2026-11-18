import { Waypoints } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

export class GatewayProxyElement extends SchemaElement {
  kind = 'gatewayProxy';
  title = 'Gateway Proxy';
  protected icon = Waypoints;
  protected color = '#16a34a';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Proxy Rule',
        properties: {
          path: { type: 'string', title: 'Path' },
          targetUrl: { type: 'string', title: 'Target URL', format: 'url' },
          rewrite: { type: 'string', title: 'Rewrite' },
          cors: { type: 'boolean', title: 'CORS' },
          cacheTtl: { type: 'integer', title: 'Cache TTL (s)' },
        },
      },
    };
  }
}

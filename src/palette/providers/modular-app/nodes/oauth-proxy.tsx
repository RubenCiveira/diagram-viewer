import { Shield } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

export class OAuthProxyElement extends SchemaElement {
  kind = 'remoteOAuth';
  title = 'OAuth';
  protected icon = Shield;
  protected color = '#0d9488';

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

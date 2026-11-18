import { Code } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

export class ApiElement extends SchemaElement {
  kind = 'api';
  title = 'API';
  protected icon = Code;
  protected color = '#0ea5e9';
  protected shape = 'round' as const;

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'API',
        properties: {
          protocol: { type: 'string', title: 'Protocolo', enum: ['http', 'https', 'grpc'] },
          auth: { type: 'string', title: 'Auth', enum: ['none', 'basic', 'oauth'] },
          basePath: { type: 'string', title: 'Path' },
          version: { type: 'string', title: 'Versión' },
          specUrl: { type: 'string', title: 'Spec URL', format: 'url' },
        },
      },
    };
  }
}

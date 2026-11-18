import { Database } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

export class DatabaseElement extends SchemaElement {
  kind = 'database';
  title = 'Database';
  protected icon = Database;
  protected color = '#0ea5e9';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Database',
        properties: {
          tech: { type: 'string', title: 'Tecnología', enum: ['quarkus', 'spring', 'php-slim', 'node'] },
          baseUrl: { type: 'string', title: 'Base URL', format: 'url' },
        },
      },
    };
  }
}

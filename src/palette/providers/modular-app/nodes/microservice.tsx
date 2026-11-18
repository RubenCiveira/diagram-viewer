import { Cog } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

export class MicroserviceElement extends SchemaElement {
  kind = 'microservice';
  title = 'Microservicio';
  protected icon = Cog;
  protected color = '#6366f1';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Microservicio',
        properties: {
          tech: { type: 'string', title: 'Tecnología', enum: ['quarkus', 'spring', 'php-slim', 'node'] },
          baseUrl: { type: 'string', title: 'Base URL', format: 'url' },
        },
      },
    };
  }
}

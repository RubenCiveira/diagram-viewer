import { DatabaseZap } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

/** Data gateway (adaptador de salida de persistencia) de un microservicio: su repositorio sobre una base de datos */
export class DataGatewayElement extends SchemaElement {
  kind = 'dataGateway';
  title = 'Data gateway';
  protected icon = DatabaseZap;
  protected color = '#0d9488';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Data gateway (repositorio)',
        properties: {
          port: { type: 'string', title: 'Puerto (interfaz)' },
          client: { type: 'string', title: 'Cliente / librería', description: 'ORM, driver… (Spring Data, Doctrine, Prisma…)' },
          entity: { type: 'string', title: 'Entidad / agregado' },
          store: { type: 'string', title: 'Tabla / colección' },
        },
      },
    };
  }
}

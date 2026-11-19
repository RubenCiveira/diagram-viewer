import { Plug } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

/** Gateway (adaptador de salida) de un microservicio: su acceso a una base de datos o a otro sistema */
export class ServiceGatewayElement extends SchemaElement {
  kind = 'serviceGateway';
  title = 'Gateway';
  protected icon = Plug;
  protected color = '#14b8a6';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Gateway (adaptador)',
        properties: {
          port: { type: 'string', title: 'Puerto (interfaz)' },
          client: { type: 'string', title: 'Cliente / librería' },
        },
      },
    };
  }
}

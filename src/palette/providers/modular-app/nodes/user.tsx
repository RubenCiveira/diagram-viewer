import { Contact } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

export class ActorUser extends SchemaElement {
  kind = 'actor-user';
  title = 'Usuario';
  protected icon = Contact;
  protected color = '#f59e0b';

  category() {
    return 'actor' as const;
  }

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Usuario',
        properties: {
          category: { type: 'string', title: 'Tipo', enum: ['Empleado', 'Cliente', 'Publico', 'Operador'] },
        },
      },
    };
  }
}

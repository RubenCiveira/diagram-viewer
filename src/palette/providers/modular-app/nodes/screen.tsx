import { AppWindow } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

/** Pantalla de un microfrontend (nodo interno, se ve en su detalle) */
export class ScreenElement extends SchemaElement {
  kind = 'screen';
  title = 'Pantalla';
  protected icon = AppWindow;
  protected color = '#f43f5e';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Pantalla',
        properties: {
          route: { type: 'string', title: 'Ruta' },
          component: { type: 'string', title: 'Componente' },
        },
      },
    };
  }
}

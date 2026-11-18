import { AppWindow } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

/** Página completa de otro equipo que la shell carga en su propia ruta. */
export class ExtMicroFrontElement extends SchemaElement {
  kind = 'ext-microfront';
  title = 'Micro front externo';
  protected icon = AppWindow;
  protected color = '#ea580c';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Micro front externo',
        properties: {
          team: { type: 'string', title: 'Equipo' },
          contact: { type: 'string', title: 'Contacto' },
          route: { type: 'string', title: 'Ruta' },
          remoteEntryUrl: { type: 'string', title: 'remoteEntryUrl', format: 'url' },
          exposedModule: { type: 'string', title: 'exposedModule' },
          version: { type: 'string', title: 'Versión' },
        },
      },
    };
  }
}

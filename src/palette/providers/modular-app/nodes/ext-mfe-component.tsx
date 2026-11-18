import { Blocks } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

/** Componente de otro equipo que nuestros microfrontends incrustan (no es una página completa). */
export class ExtMfeComponentElement extends SchemaElement {
  kind = 'ext-mfe-component';
  title = 'Componente externo';
  protected icon = Blocks;
  protected color = '#f97316';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Componente externo',
        properties: {
          team: { type: 'string', title: 'Equipo' },
          contact: { type: 'string', title: 'Contacto' },
          remoteEntryUrl: { type: 'string', title: 'remoteEntryUrl', format: 'url' },
          exposedModule: { type: 'string', title: 'exposedModule' },
          version: { type: 'string', title: 'Versión' },
        },
      },
    };
  }
}

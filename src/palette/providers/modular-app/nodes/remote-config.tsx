import { FileCog } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

/** Configuración remota que un microfrontend carga al arrancar (feature flags, endpoints…). */
export class RemoteConfigElement extends SchemaElement {
  kind = 'remoteConfig';
  title = 'Configuración';
  protected icon = FileCog;
  protected color = '#0891b2';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Configuración',
        properties: {
          source: { type: 'string', title: 'Origen', format: 'url' },
          format: { type: 'string', title: 'Formato', enum: ['json', 'yaml', 'env'] },
          refresh: { type: 'string', title: 'Refresco' },
          flags: { type: 'array', title: 'Feature flags', items: { type: 'string' } },
        },
      },
    };
  }
}

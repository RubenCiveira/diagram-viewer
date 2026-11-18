import { Puzzle } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

export class MicroFrontElement extends SchemaElement {
  kind = 'microFront';
  title = 'Micro Front';
  protected icon = Puzzle;
  protected color = '#a855f7';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Micro Front',
        properties: {
          route: { type: 'string', title: 'Ruta' },
          remoteEntryUrl: { type: 'string', title: 'remoteEntryUrl', format: 'url' },
          exposedModule: { type: 'string', title: 'exposedModule' },
          version: { type: 'string', title: 'Versión' },
          dependsOn: { type: 'array', title: 'Depende de', items: { type: 'string' } },
        },
      },
    };
  }
}

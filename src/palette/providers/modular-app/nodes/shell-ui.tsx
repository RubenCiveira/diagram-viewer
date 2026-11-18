import { LayoutTemplate } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

export class ShellUiElement extends SchemaElement {
  kind = 'shellUi';
  title = 'Shell UI';
  protected icon = LayoutTemplate;
  protected color = '#8b5cf6';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Shell UI',
        properties: {
          routeBase: { type: 'string', title: 'Ruta base' },
          authRequired: { type: 'boolean', title: 'Requiere auth' },
        },
      },
    };
  }
}

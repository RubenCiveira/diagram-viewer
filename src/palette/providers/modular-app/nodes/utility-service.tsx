import { Wrench } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

/** Servicio de utilidad de un microservicio: lógica reutilizable por varios casos de uso (cálculos, validaciones, mapeos…) */
export class UtilityServiceElement extends SchemaElement {
  kind = 'utilityService';
  title = 'Servicio de utilidad';
  protected icon = Wrench;
  protected color = '#a855f7';
  protected shape = 'round' as const;

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Servicio de utilidad',
        properties: {
          layer: { type: 'string', title: 'Capa', enum: ['domain', 'application'] },
          responsibility: { type: 'string', title: 'Responsabilidad' },
        },
      },
    };
  }
}

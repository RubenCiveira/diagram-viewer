import { Unlink } from 'lucide-react';
import { MISSING_TYPE } from '../../../../diagram';
import { SchemaElement } from '../../../SchemaElement';

/** Nodo que no se puede resolver: referencia a un id que no está en el catálogo, o sin `type`. */
export class MissingRefElement extends SchemaElement {
  kind = MISSING_TYPE;
  title = 'Referencia no resuelta';
  protected icon = Unlink;
  protected color = '#dc2626';
}

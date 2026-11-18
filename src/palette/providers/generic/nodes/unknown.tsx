import { CircleHelp } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

/** Kind que no está en la paleta: se pinta igualmente y su ficha muestra las props tal cual. */
export class UnknownElement extends SchemaElement {
  title: string;
  protected icon = CircleHelp;
  protected color = '#94a3b8';

  constructor(public kind: string) {
    super();
    this.title = `Tipo desconocido: ${kind}`;
  }

  label({ name }: { name?: string }) {
    return name ?? this.kind;
  }
}

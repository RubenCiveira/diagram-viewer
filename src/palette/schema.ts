import type { DetailField } from './DiagramElementType';

/** Subconjunto de JSON Schema que usan los tipos de la paleta para describir sus props. */
export type JsonSchema = {
  type?: string;
  title?: string;
  description?: string;
  format?: string;
  enum?: unknown[];
  default?: unknown;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
};

export type Definition = { schema: JsonSchema };

/** Props que no se muestran como campo porque ya tienen su sitio en la ficha. */
const RESERVED = new Set(['description']);

/**
 * Convierte las props de un elemento en filas de la ficha, usando los títulos
 * del schema y su orden. Las props que no están en el schema se añaden al final
 * con su nombre tal cual; los objetos anidados con schema propio se resuelven
 * recursivamente.
 */
export function schemaFields(schema: JsonSchema | undefined, props: Record<string, any> | undefined): DetailField[] {
  if (!props) return [];
  const known = schema?.properties ?? {};
  const fields: DetailField[] = [];
  for (const [key, sub] of Object.entries(known)) {
    if (RESERVED.has(key) || props[key] === undefined) continue;
    const value = props[key];
    fields.push({
      label: sub.title ?? key,
      value: sub.properties && value && typeof value === 'object' ? toRecord(schemaFields(sub, value)) : value,
    });
  }
  for (const [key, value] of Object.entries(props)) {
    if (RESERVED.has(key) || key in known || value === undefined) continue;
    fields.push({ label: key, value });
  }
  return fields;
}

function toRecord(fields: DetailField[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((f) => [f.label, f.value]));
}

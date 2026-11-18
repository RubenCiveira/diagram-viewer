import type { JsonSchema } from './schema';

/** Fragmentos de schema compartidos por varios tipos (equivalen a palette/schemas del editor). */
export const connectionSchema: JsonSchema = {
  type: 'object',
  title: 'Conexión',
  properties: {
    readTimeout: { type: 'string', title: 'Read timeout' },
    writeTimeout: { type: 'string', title: 'Write timeout' },
    connectTimeout: { type: 'string', title: 'Connect timeout' },
  },
};

export const retrySchema: JsonSchema = {
  type: 'object',
  title: 'Reintentos',
  properties: {
    maxAttempts: { type: 'integer', title: 'Intentos máximos' },
    backoff: { type: 'string', title: 'Backoff' },
  },
};

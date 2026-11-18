import { SchemaEdgeType } from '../../../SchemaEdgeType';
import { connectionSchema, retrySchema } from '../../../schemas';

export class RemoteWebRequest extends SchemaEdgeType {
  title = 'Petición REST';
  protected sources = ['microservice'];
  protected targets = ['externalService'];
  protected shortLabel = 'REST';

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Request',
        properties: {
          path: { type: 'string', title: 'Base Path' },
          method: { type: 'string', title: 'Method', enum: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] },
          connection: connectionSchema,
          retry: retrySchema,
        },
      },
    };
  }
}

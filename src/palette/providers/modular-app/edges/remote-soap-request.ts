import { SchemaEdgeType } from '../../../SchemaEdgeType';
import { connectionSchema } from '../../../schemas';

export class RemoteSoapRequest extends SchemaEdgeType {
  title = 'Petición SOAP';
  protected sources = ['microservice'];
  protected targets = ['externalSoap'];
  protected shortLabel = 'SOAP';
  protected edgeStyle = { dashed: true };

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Request',
        properties: {
          name: { type: 'string', title: 'Function' },
          connection: connectionSchema,
        },
      },
    };
  }
}

import { SchemaEdgeType } from '../../../SchemaEdgeType';

export class RemoteTransactionRequest extends SchemaEdgeType {
  title = 'Transacción';
  protected sources = ['microservice'];
  protected targets = ['externalTransaction'];
  protected shortLabel = 'TX';
  protected edgeStyle = { dashed: true };

  definition() {
    return {
      schema: {
        type: 'object',
        title: 'Transaction',
        properties: {
          code: { type: 'string', title: 'Código' },
          host: { type: 'string', title: 'Host' },
        },
      },
    };
  }
}

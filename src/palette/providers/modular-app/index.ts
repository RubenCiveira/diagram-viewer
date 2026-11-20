import type { PaletteInterface } from '../..';
import { DefaultEdge } from '../generic/edges/default-edge';
import { MissingRefElement } from '../generic/nodes/missing-ref';
import { NoteElement } from '../generic/nodes/note';
import { SubdiagramElement } from '../generic/nodes/subdiagram';
import { RemoteSoapRequest } from './edges/remote-soap-request';
import { RemoteTransactionRequest } from './edges/remote-transaction-request';
import { RemoteWebRequest } from './edges/remote-web-request';
import { ApiElement } from './nodes/api';
import { DataGatewayElement } from './nodes/data-gateway';
import { DatabaseElement } from './nodes/database';
import { ExternalServiceElement } from './nodes/external-service';
import { ExternalSoapElement } from './nodes/external-soap';
import { ExtMfeComponentElement } from './nodes/ext-mfe-component';
import { ExtMicroFrontElement } from './nodes/ext-microfront';
import { ExternalTransactionElement } from './nodes/external-transaction';
import { GatewayElement } from './nodes/gateway';
import { GatewayProxyElement } from './nodes/gateway-proxy';
import { MicroFrontElement } from './nodes/micro-front';
import { MicroserviceElement } from './nodes/microservice';
import { OAuthProxyElement } from './nodes/oauth-proxy';
import { RemoteConfigElement } from './nodes/remote-config';
import { ScreenElement } from './nodes/screen';
import { ServiceGatewayElement } from './nodes/service-gateway';
import { ShellUiElement } from './nodes/shell-ui';
import { UseCaseElement } from './nodes/use-case';
import { UtilityServiceElement } from './nodes/utility-service';
import { ActorUser } from './nodes/user';

export const ModularAppPalette: PaletteInterface = {
  nodes: [
    new ActorUser(),
    new ShellUiElement(),
    new MicroFrontElement(),
    new ScreenElement(),
    new ExtMicroFrontElement(),
    new ExtMfeComponentElement(),
    new GatewayElement(),
    new GatewayProxyElement(),
    new OAuthProxyElement(),
    new MicroserviceElement(),
    new UseCaseElement(),
    new UtilityServiceElement(),
    new ServiceGatewayElement(),
    new DataGatewayElement(),
    new DatabaseElement(),
    new ExternalServiceElement(),
    new ExternalSoapElement(),
    new ExternalTransactionElement(),
    new ApiElement(),
    new RemoteConfigElement(),
    new SubdiagramElement(),
    new MissingRefElement(),
  ],
  edges: [new RemoteWebRequest(), new RemoteSoapRequest(), new RemoteTransactionRequest(), new DefaultEdge()],
  note: new NoteElement(),
};

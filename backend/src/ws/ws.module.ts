import { Module, Global } from '@nestjs/common';
import { WsGateway } from './ws.gateway';

@Global()
@Module({
    providers: [WsGateway],
    exports: [WsGateway],
})
export class WsModule { }

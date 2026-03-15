import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5174',
];

@WebSocketGateway({
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
    namespace: 'events',
})
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(WsGateway.name);

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }

    @SubscribeMessage('join-job')
    handleJoinJob(
        @MessageBody() data: { jobId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const jobId = data.jobId;
        // Join both room formats for compatibility
        client.join(`job:${jobId}`);
        client.join(`session:${jobId}`);
        this.logger.log(`Client ${client.id} joined job/session: ${jobId}`);
        return { event: 'joined-job', data: { jobId } };
    }

    emitProgress(jobIdOrSessionId: string, progress: any) {
        // Support both job: and session: room formats for backward compatibility
        this.server.to(`job:${jobIdOrSessionId}`).emit('progress', progress);
        this.server.to(`session:${jobIdOrSessionId}`).emit('progress', progress);
    }

    emitToUser(userId: string, event: string, data: any) {
        this.server.to(`user:${userId}`).emit(event, data);
    }

    emitToSession(sessionId: string, event: string, data: any) {
        this.server.to(`session:${sessionId}`).emit(event, data);
    }
}

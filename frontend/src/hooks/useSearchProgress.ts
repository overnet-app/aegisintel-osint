import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface ProgressData {
    status?: string;
    progress?: number;
    step?: string;
    error?: string;
}

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

export function useSearchProgress(sessionId?: string) {
    const [progress, setProgress] = useState<ProgressData | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 10;

    useEffect(() => {
        if (!sessionId) return;

        const connectSocket = () => {
            if (socketRef.current?.connected) {
                return;
            }

            const socket = io(`${SOCKET_URL}/events`, {
                transports: ['websocket'],
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: maxReconnectAttempts,
            });

            socketRef.current = socket;

            socket.on('connect', () => {
                setIsConnected(true);
                reconnectAttemptsRef.current = 0;
                socket.emit('join-job', { jobId: sessionId });
            });

            socket.on('progress', (data) => {
                setProgress(data);
            });

            socket.on('disconnect', (reason) => {
                setIsConnected(false);
                
                // Only attempt manual reconnection if it wasn't intentional
                if (reason === 'io server disconnect' || reason === 'transport close') {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                    reconnectAttemptsRef.current++;
                    
                    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                        reconnectTimeoutRef.current = setTimeout(() => {
                            connectSocket();
                        }, delay);
                    }
                }
            });

            socket.on('connect_error', () => {
                setIsConnected(false);
            });
        };

        connectSocket();

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [sessionId]);

    return { progress, isConnected };
}

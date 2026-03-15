export interface User {
    id: string;
    email: string;
    role: 'ADMIN' | 'ANALYST' | 'VIEWER';
}

export interface SearchJob {
    id: string;
    query: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    progress: number;
}

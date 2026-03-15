import axios, { AxiosError } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';
const BASE_PATH = import.meta.env.DEV ? '/api' : API_URL;

const api = axios.create({
    baseURL: BASE_PATH,
});

let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value?: any) => void;
    reject: (error?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Add auth tokens if they exist
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle token refresh on 401 errors
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // If already refreshing, queue this request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        if (originalRequest.headers) {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                        }
                        return api(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) {
                processQueue(new Error('No refresh token'), null);
                localStorage.removeItem('access_token');
                window.location.href = '/login';
                return Promise.reject(error);
            }

            try {
                const response = await axios.post(`${BASE_PATH}/auth/refresh`, {
                    refresh_token: refreshToken,
                });

                const { access_token, refresh_token: newRefreshToken } = response.data;
                localStorage.setItem('access_token', access_token);
                if (newRefreshToken) {
                    localStorage.setItem('refresh_token', newRefreshToken);
                }

                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${access_token}`;
                }

                processQueue(null, access_token);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export const searchService = {
    async preliminarySearch(query: string) {
        const { data } = await api.post('/search/preliminary', { query });
        return data;
    },

    async startDeepSearch(sessionId: string, candiateId: string) {
        const { data } = await api.post(`/search/sessions/${sessionId}/deep`, { candiateId });
        return data;
    },

    async getDossier(id: string) {
        const { data } = await api.get(`/dossiers/${id}`);
        return data;
    },

    async getRecentDossiers() {
        const { data } = await api.get('/dossiers');
        return data;
    },

    async uploadImage(file: File, onProgress?: (progress: number) => void): Promise<{ sessionId: string; imageUrl: string; message: string }> {
        const formData = new FormData();
        formData.append('file', file);

        // Don't set Content-Type header - let axios set it automatically with boundary for multipart/form-data
        const { data } = await api.post('/search/upload', formData, {
            headers: {
                // Remove Content-Type to let browser set it with boundary
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted);
                }
            },
        });
        return data;
    },

    exportMd: (sessionId: string) => 
        api.get(`/search/${sessionId}/export/md`, { responseType: 'blob' }),
    
    exportPdf: (sessionId: string) => 
        api.get(`/search/${sessionId}/export/pdf`, { responseType: 'blob' }),
};

export const researchService = {
    start: (query: string, model?: string, maxIterations?: number) => 
        api.post('/research', { query, model, maxIterations }),
    
    getStatus: (id: string) => 
        api.get(`/research/${id}`),
    
    getSources: (id: string) => 
        api.get(`/research/${id}/sources`),
    
    getHistory: () => 
        api.get('/research/history'),
    
    delete: (id: string) => 
        api.delete(`/research/${id}`),
    
    exportMd: (id: string) => 
        api.get(`/research/${id}/export/md`, { responseType: 'blob' }),
    
    exportPdf: (id: string) => 
        api.get(`/research/${id}/export/pdf`, { responseType: 'blob' }),
};

export const modelsService = {
    getOpenRouterModels: () => 
        api.get('/models/openrouter'),
};

export const agentModelService = {
    getAgentModelConfigs: () => 
        api.get('/users/settings/agent-models'),
    
    updateAgentModelConfig: (agentName: string, config: { provider: string; tier?: string; model: string }) => 
        api.put('/users/settings/agent-models', { agentName, config }),
};

export const reverseLookupService = {
    lookupPhone: (phoneNumber: string, options?: any) =>
        api.post('/reverse-lookup/phone', { phoneNumber, options }),
    
    lookupEmail: (emailAddress: string, options?: any) =>
        api.post('/reverse-lookup/email', { emailAddress, options }),
    
    lookupImage: (imageUrl: string, options?: any) =>
        api.post('/reverse-lookup/image', { imageUrl, options }),
    
    lookupVIN: (vin: string, options?: any) =>
        api.post('/reverse-lookup/vin', { vin, options }),
    
    lookupAddress: (address: string, options?: any) =>
        api.post('/reverse-lookup/address', { address, options }),
    
    aggregate: (lookups: Array<{ type: string; query: string }>, options?: any) =>
        api.post('/reverse-lookup/aggregate', { lookups, options }),
    
    exportMd: (id: string) =>
        api.get(`/reverse-lookup/${id}/export/md`, { responseType: 'blob' }),
    
    exportPdf: (id: string) =>
        api.get(`/reverse-lookup/${id}/export/pdf`, { responseType: 'blob' }),
};

export default api;

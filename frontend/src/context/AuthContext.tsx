import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

// User type defined inline to avoid import issues
interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: 'ADMIN' | 'ANALYST' | 'VIEWER';
    isActive: boolean;
    preferredModel: string;
    enabledServices: {
        clarifai?: boolean;
    };
    createdAt: string;
    updatedAt: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isAuthenticated: boolean;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
    const [loading, setLoading] = useState(true);

    const logout = React.useCallback(() => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setToken(null);
        setUser(null);
    }, []);

    const login = React.useCallback((newToken: string, userData: User) => {
        localStorage.setItem('access_token', newToken);
        setToken(newToken);
        setUser(userData);
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            try {
                if (token) {
                    try {
                        const response = await api.get('/users/me');
                        setUser(response.data);
                    } catch (error: any) {
                        console.error('Failed to validate token', error);
                        // Only logout if it's a 401/403, not network errors
                        if (error?.response?.status === 401 || error?.response?.status === 403) {
                            logout();
                        } else {
                            // For network errors or missing endpoint, just clear token and continue
                            console.warn('Auth validation failed, clearing token');
                            localStorage.removeItem('access_token');
                            localStorage.removeItem('refresh_token');
                            setToken(null);
                            setUser(null);
                        }
                    }
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            } finally {
                setLoading(false);
            }
        };
        initAuth();
    }, [token, logout]);

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!user, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

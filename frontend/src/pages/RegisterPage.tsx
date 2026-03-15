import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, Mail, User, Loader2 } from 'lucide-react';
import api from '../services/api';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.post('/auth/register', { email, password, firstName, lastName });
            navigate('/login');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed. Agent ID might already be taken.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page fade-in">
            <div className="auth-card glass">
                <div className="auth-header">
                    <div className="auth-logo">
                        <Shield size={32} className="text-blue" />
                    </div>
                    <h1>AEGIS<span>INTEL</span></h1>
                    <p>Commission a new intelligence agent.</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && <div className="auth-error">{error}</div>}

                    <div className="name-row">
                        <div className="input-group">
                            <label>First Name</label>
                            <div className="input-wrapper">
                                <User size={18} />
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    placeholder="John"
                                    required
                                />
                            </div>
                        </div>
                        <div className="input-group">
                            <label>Last Name</label>
                            <div className="input-wrapper">
                                <User size={18} />
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    placeholder="Doe"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Intelligence ID (Email)</label>
                        <div className="input-wrapper">
                            <Mail size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@aegis.corp"
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Security Key (Password)</label>
                        <div className="input-wrapper">
                            <Lock size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="auth-submit" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'Commission Agent'}
                    </button>
                </form>

                <div className="auth-footer">
                    Already commissioned? <Link to="/login">Login</Link>
                </div>
            </div>
        </div>
    );
}

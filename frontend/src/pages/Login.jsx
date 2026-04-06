import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Lock, BarChart3 } from 'lucide-react';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const ok = await login(password);
    setLoading(false);
    if (ok) {
      navigate('/overview');
    } else {
      setError('Wrong password');
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <BarChart3 size={20} className="text-white" />
          </div>
          <span className="text-white font-semibold text-xl">Social Dashboard</span>
        </div>

        <div className="bg-dark-800 border border-dark-500 rounded-2xl p-8">
          <h1 className="text-white text-xl font-semibold mb-1">Welcome back</h1>
          <p className="text-gray-500 text-sm mb-6">Enter your dashboard password to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                placeholder="Dashboard password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-dark-700 border border-dark-500 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-accent transition-colors"
                required
                autoFocus
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors"
            >
              {loading ? 'Verifying...' : 'Enter Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { api } from '@/utils/api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'host' | 'assistant'>('host');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setCurrentUser, currentUser } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: Location })?.from?.pathname || '/';

  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.auth.login(username, password);
      if (response.success && response.data) {
        setCurrentUser(response.data);
        navigate(from, { replace: true });
      } else {
        setError(response.error || '登录失败');
      }
    } catch (err) {
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-dark-500 via-dark-400 to-dark-300" />
      <div className="absolute inset-0 bg-noise opacity-30" />
      
      {[...Array(30)].map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${100 + Math.random() * 20}%`,
            animationDelay: `${Math.random() * 15}s`,
            animationDuration: `${15 + Math.random() * 10}s`,
            background: `rgba(${99 + Math.random() * 100}, ${102 + Math.random() * 100}, ${241 + Math.random() * 50}, 0.6)`,
          }}
        />
      ))}

      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-pink/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-neon-purple mb-4 animate-float">
            <Sparkles size={32} className="text-white" />
          </div>
          <h1 className="font-display text-4xl font-bold bg-gradient-to-r from-white via-primary-300 to-neon-pink bg-clip-text text-transparent mb-2">
            盲盒拆盒系统
          </h1>
          <p className="text-gray-400">直播抽签管理平台</p>
        </div>

        <div className="gradient-border p-8">
          <div className="flex mb-6 bg-dark-300/50 rounded-xl p-1">
            <button
              onClick={() => setRole('host')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                role === 'host'
                  ? 'bg-gradient-to-r from-primary-500 to-neon-purple text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              主播登录
            </button>
            <button
              onClick={() => setRole('assistant')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                role === 'assistant'
                  ? 'bg-gradient-to-r from-primary-500 to-neon-purple text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              助播登录
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                用户名
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-neon pl-12"
                  placeholder={role === 'host' ? 'host' : 'assistant'}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-neon pl-12 pr-12"
                  placeholder={role === 'host' ? 'host123' : 'assist123'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-neon w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  登录中...
                </>
              ) : (
                '登录系统'
              )}
            </button>
          </form>

          <div className="mt-6 p-4 rounded-xl bg-dark-300/50 border border-white/5">
            <p className="text-xs text-gray-500 mb-2">演示账号</p>
            <div className="text-xs text-gray-400 space-y-1">
              <p>主播：host / host123</p>
              <p>助播：assistant / assist123</p>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-600 text-sm mt-6">
          © 2024 盲盒拆盒直播抽签系统
        </p>
      </div>
    </div>
  );
}

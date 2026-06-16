import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Dices,
  Trophy,
  Settings,
  Archive,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useStore } from '@/store/useStore';

interface LayoutProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function Layout({ children, requireAuth = true }: LayoutProps) {
  const { currentUser, logout, currentActivity } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  if (requireAuth && !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const navItems = [
    { path: '/', label: '活动管理', icon: LayoutDashboard },
    { path: '/console', label: '直播间控制台', icon: Dices, requiresActivity: true },
    { path: '/draw', label: '实时抽签页', icon: Sparkles, requiresActivity: true },
    { path: '/results', label: '结果公示', icon: Trophy },
    { path: '/settings', label: '系统设置', icon: Settings },
    { path: '/archive', label: '活动归档', icon: Archive },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-dark-500 via-dark-400 to-dark-300">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-noise" />
        {[...Array(20)].map((_, i) => (
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
      </div>

      {currentUser && (
        <aside className="w-64 flex-shrink-0 bg-dark-300/80 backdrop-blur-xl border-r border-white/5 relative z-10">
          <div className="p-6 border-b border-white/5">
            <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-primary-400 to-neon-pink bg-clip-text text-transparent">
              盲盒拆盒系统
            </h1>
            <p className="text-xs text-gray-500 mt-1">直播抽签管理平台</p>
          </div>

          {currentActivity && (
            <div className="px-4 py-3 border-b border-white/5">
              <div className="text-xs text-gray-500 mb-1">当前活动</div>
              <div className="text-sm font-medium text-white truncate">
                {currentActivity.name}
              </div>
            </div>
          )}

          <nav className="p-4 space-y-1">
            {navItems.map((item) => {
              if (item.requiresActivity && !currentActivity) return null;
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'bg-gradient-to-r from-primary-500/30 to-neon-purple/20 text-white border border-primary-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-sm">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-neon-purple flex items-center justify-center text-white font-bold">
                {currentUser?.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium text-white">
                  {currentUser?.username}
                </div>
                <div className="text-xs text-gray-500">
                  {currentUser?.role === 'host' ? '主播' : '助播'}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <LogOut size={16} />
              <span className="text-sm">退出登录</span>
            </button>
          </div>
        </aside>
      )}

      <main className={`flex-1 relative z-10 overflow-auto ${currentUser ? '' : 'w-full'}`}>
        {children}
      </main>
    </div>
  );
}

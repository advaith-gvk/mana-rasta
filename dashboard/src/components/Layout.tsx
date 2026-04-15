import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/dashboard',   label: 'Overview',     icon: '▦' },
  { to: '/reports',     label: 'Reports',      icon: '📋' },
  { to: '/fraud',       label: 'Fraud',        icon: '🛡' },
  { to: '/sla',         label: 'SLA Monitor',  icon: '⏱' },
  { to: '/officers',    label: 'Officers',     icon: '👷' },
  { to: '/analytics',   label: 'Analytics',    icon: '📈' },
  { to: '/leaderboard', label: 'Leaderboard',  icon: '🏆' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      <aside className={clsx(
        'flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-200',
        collapsed ? 'w-14' : 'w-56'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-gray-100 dark:border-gray-800">
          <span className="text-xl">🕳</span>
          {!collapsed && (
            <span className="font-semibold text-sm leading-tight">
              Mana<br />Rasta
            </span>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-2 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-gray-100 dark:border-gray-800 p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-xs font-medium text-orange-700 dark:text-orange-300">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{user?.name || 'Admin'}</p>
                <p className="text-xs text-gray-400 truncate capitalize">{user?.role}</p>
              </div>
            )}
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500 text-xs ml-auto" title="Logout">
              ⎋
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

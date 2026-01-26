import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Home, Users, Plus, History, Settings, LucideIcon } from 'lucide-react';

interface NavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon: Icon, label, isActive }) => (
  <Link 
    to={to} 
    className="flex-1 flex flex-col items-center justify-center gap-1 group"
    aria-label={label}
    aria-current={isActive ? 'page' : undefined}
  >
    <div className={`p-1.5 rounded-md border-2 transition-all ${isActive ? 'bg-neo-blue border-black shadow-neo-sm' : 'border-transparent group-hover:bg-gray-100'}`}>
      <Icon 
        size={24} 
        className={isActive ? 'text-black' : 'text-gray-500'} 
        strokeWidth={isActive ? 2.5 : 2} 
      />
    </div>
    <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-black' : 'text-gray-400'}`}>
      {label}
    </span>
  </Link>
);

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;

  // Don't show nav on login or full-screen modal routes like 'add' or 'settle'
  const excludedPaths = ['/', '/login', '/add', '/settle'];
  if (excludedPaths.includes(path) || path.startsWith('/settle')) return null;

  return (
    <nav 
      className="fixed bottom-0 left-0 w-full bg-white border-t-2 border-black z-50 h-[80px] pb-4 shadow-[0_-4px_0_0_rgba(0,0,0,0.05)]"
      aria-label="Main Navigation"
    >
      <div className="max-w-md mx-auto h-full flex items-center justify-around px-2 relative">
        <NavItem to="/dashboard" icon={Home} label="Home" isActive={path === '/dashboard'} />
        <NavItem to="/friends" icon={Users} label="Friends" isActive={path === '/friends'} />
        
        {/* Floating Add Button Wrapper */}
        <div className="relative -top-6">
            <Link 
              to="/add" 
              className="flex items-center justify-center w-16 h-16 bg-neo-green border-2 border-black shadow-neo hover:scale-105 active:shadow-neo-pressed active:translate-y-[4px] active:translate-x-[4px] transition-all"
              aria-label="Add Transaction"
            >
                <Plus size={32} className="text-black" strokeWidth={3} />
            </Link>
        </div>

        <NavItem to="/history" icon={History} label="History" isActive={path === '/history'} />
        <NavItem to="/profile" icon={Settings} label="Profile" isActive={path === '/profile'} />
      </div>
    </nav>
  );
};

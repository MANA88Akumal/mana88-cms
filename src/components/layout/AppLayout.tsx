// App Layout with Navigation Sidebar
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Briefcase, 
  CreditCard, 
  ClipboardCheck, 
  BarChart3, 
  FileInput,
  LogOut,
  Menu,
  X,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';

// Navigation items
const navItems = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/cases', label: 'Casos', icon: Briefcase },
  { path: '/payments', label: 'Pagos', icon: CreditCard },
  { path: '/approvals', label: 'Aprobaciones', icon: ClipboardCheck },
  { path: '/finance', label: 'Finanzas', icon: BarChart3 },
  { path: '/intake', label: 'Entrada Manual', icon: FileInput },
];

function NavItem({ 
  path, 
  label, 
  icon: Icon,
  onClick,
}: { 
  path: string; 
  label: string; 
  icon: typeof Home;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={path}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-emerald-100 text-emerald-800'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )
      }
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
    </NavLink>
  );
}

export function AppLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center px-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
        <img 
          src="https://manaakumal.com/wp-content/uploads/2025/06/logo-main-black.png" 
          alt="MANA88" 
          className="ml-4 h-8 w-auto"
        />
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-white border-r border-gray-200 z-50 transform transition-transform duration-200 ease-in-out',
          'lg:transform-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-200">
          <img 
            src="https://manaakumal.com/wp-content/uploads/2025/06/logo-main-black.png" 
            alt="MANA88" 
            className="h-8 w-auto"
          />
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavItem
              key={item.path}
              {...item}
              onClick={() => setSidebarOpen(false)}
            />
          ))}
        </nav>

        {/* User section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {profile?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  BarChart3, 
  Upload, 
  Search, 
  Brain, 
  Key, 
  Settings,
  FileText,
  LogOut
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Upload Documents', href: '/upload', icon: Upload },
  { name: 'Processing Results', href: '/results', icon: Search },
  { name: 'AI Engines', href: '/ai-engines', icon: Brain },
  { name: 'API Management', href: '/api-keys', icon: Key },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth() as { user: any; };

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64">
        <div className="flex flex-col h-0 flex-1 bg-white border-r border-slate-200">
          {/* Logo */}
          <div className="flex items-center h-16 flex-shrink-0 px-4 bg-slate-900">
            <FileText className="w-6 h-6 text-blue-400 mr-3" />
            <h1 className="text-white font-semibold text-lg">DocProcess</h1>
          </div>
          
          {/* Navigation */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            <nav className="flex-1 px-2 py-4 space-y-1">
              {navigation.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <a className={cn(
                      "group flex items-center px-2 py-2 text-sm font-medium rounded-md",
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-50"
                    )}>
                      <item.icon className={cn(
                        "mr-3 w-5 h-5",
                        isActive ? "text-blue-500" : "text-slate-400"
                      )} />
                      {item.name}
                    </a>
                  </Link>
                );
              })}
            </nav>
            
            {/* User Profile */}
            <div className="flex-shrink-0 flex border-t border-slate-200 p-4">
              <div className="flex items-center w-full">
                <div className="flex-shrink-0">
                  {user?.profileImageUrl ? (
                    <img 
                      className="h-8 w-8 rounded-full object-cover" 
                      src={user.profileImageUrl} 
                      alt={user.firstName || 'User'} 
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                      <span className="text-sm font-medium text-white">
                        {user?.firstName?.[0] || user?.email?.[0] || 'U'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-slate-700">
                    {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || 'User'}
                  </p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 p-1 rounded text-slate-400 hover:text-slate-500"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

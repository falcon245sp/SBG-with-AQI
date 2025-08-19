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
  LogOut,
  FolderOpen,
  UserCheck,
  Shield
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Upload Documents', href: '/upload', icon: Upload },
  { name: 'File Cabinet', href: '/file-cabinet', icon: FolderOpen },
  { name: 'Processing Results', href: '/results', icon: Search },
  { name: 'Prompt Config', href: '/prompt-config', icon: Brain },
  { name: 'API Management', href: '/api-keys', icon: Key },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth() as { user: any; };

  const currentRole = sessionStorage.getItem('userRole') || 'customer';

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  const switchRole = () => {
    setLocation('/role-selection');
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
                    <div className={cn(
                      "group flex items-center px-2 py-2 text-sm font-medium rounded-md cursor-pointer",
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-slate-600 hover:bg-slate-50"
                    )}>
                      <item.icon className={cn(
                        "mr-3 w-5 h-5",
                        isActive ? "text-blue-500" : "text-slate-400"
                      )} />
                      {item.name}
                    </div>
                  </Link>
                );
              })}
            </nav>
            
            {/* Role Switcher */}
            <div className="border-t border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600">Current Role</span>
                <div className="flex items-center">
                  {currentRole === 'admin' ? (
                    <Shield className="w-3 h-3 text-amber-500 mr-1" />
                  ) : (
                    <UserCheck className="w-3 h-3 text-blue-500 mr-1" />
                  )}
                  <span className="text-xs text-slate-500 capitalize">{currentRole}</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={switchRole}
                className="w-full text-xs"
              >
                Switch Role
              </Button>
            </div>

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

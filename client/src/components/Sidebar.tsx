import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Upload, 
  FileText,
  LogOut,
  BarChart3,
  FolderOpen,
  Users,
  Settings,
  Clock,
  BookOpen
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Upload Documents', href: '/upload', icon: Upload },
  { name: 'File Cabinet', href: '/file-cabinet', icon: FolderOpen },
  { name: 'Processing Results', href: '/results', icon: Clock },
  { name: 'Google Classroom', href: '/google-classroom', icon: Users },
];

const adminNavigation = [
  { name: 'Admin Panel', href: '/admin', icon: Settings }
];

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth() as { user: any; };

  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  // Check if user has admin access
  const isAdmin = user?.email === 'jfielder@srvusd.net';

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-56">
        <div className="flex flex-col h-0 flex-1 bg-white border-r border-gray-200">
          {/* Logo */}
          <div className="flex items-center h-16 flex-shrink-0 px-6 border-b border-gray-200">
            <FileText className="w-6 h-6 text-blue-600 mr-2" />
            <h1 className="text-gray-900 font-semibold text-lg">Standards Sherpa</h1>
          </div>
          
          {/* Navigation */}
          <div className="flex-1 flex flex-col">
            <nav className="flex-1 px-4 py-6 space-y-1">
              {/* Main Navigation */}
              {navigation.map((item) => {
                const isActive = location === item.href || (item.href === '/dashboard' && location === '/');
                return (
                  <Link key={item.name} href={item.href}>
                    <div className={cn(
                      "group flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer",
                      isActive
                        ? "bg-blue-50 text-blue-700 border-r-2 border-blue-600"
                        : "text-gray-600 hover:bg-gray-50"
                    )}>
                      <item.icon className={cn(
                        "mr-3 w-5 h-5",
                        isActive ? "text-blue-600" : "text-gray-400"
                      )} />
                      {item.name}
                    </div>
                  </Link>
                );
              })}
              
              {/* Admin Navigation - Only show for admin users */}
              {isAdmin && (
                <>
                  <div className="px-3 py-2">
                    <div className="h-px bg-gray-200"></div>
                  </div>
                  {adminNavigation.map((item) => {
                    const isActive = location === item.href;
                    return (
                      <Link key={item.name} href={item.href}>
                        <div className={cn(
                          "group flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer",
                          isActive
                            ? "bg-red-50 text-red-700 border-r-2 border-red-600"
                            : "text-gray-600 hover:bg-gray-50"
                        )}>
                          <item.icon className={cn(
                            "mr-3 w-5 h-5",
                            isActive ? "text-red-600" : "text-gray-400"
                          )} />
                          {item.name}
                        </div>
                      </Link>
                    );
                  })}
                </>
              )}
            </nav>

            {/* User Profile */}
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
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
                  <p className="text-sm font-medium text-gray-700">
                    {user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user?.email || 'User'}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 p-1 rounded text-gray-400 hover:text-gray-600"
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
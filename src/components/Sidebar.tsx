import React from 'react';
import { Home, Users, BarChart3, Settings, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PWAInstallButton } from './PWAInstallButton';

export type ActiveTab = 'home' | 'groups' | 'reports' | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenGroupModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { profile, settings, signOut, isDemoUser } = useAuth();

  const navItems: { id: ActiveTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'groups', label: 'Groups', icon: Users },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 shrink-0 h-screen sticky top-0 select-none">
      {/* KHATA Brand Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 flex items-center justify-center shadow-md shadow-slate-900/10 shrink-0">
            <img src="/icon.svg" alt="KHATA" className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
              KHATA
              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                PWA
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
              Group Expense & Settlement
            </p>
          </div>
        </div>

        {isDemoUser && (
          <div className="mt-3 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Local Evaluation Mode</span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                isActive
                  ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* PWA Install Button prompt */}
      <div className="px-4 pb-2">
        <PWAInstallButton variant="button" />
      </div>

      {/* Profile & Settings Footer */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setActiveTab('settings')}
            className="flex items-center gap-3 text-left overflow-hidden group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-500/30">
              {profile?.photo_url ? (
                <img src={profile.photo_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                (profile?.name || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 transition">
                {profile?.name || 'Account Owner'}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {settings?.company_name || 'Owner / Admin'}
              </p>
            </div>
          </button>

          <button
            onClick={() => signOut()}
            title="Sign Out"
            className="text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

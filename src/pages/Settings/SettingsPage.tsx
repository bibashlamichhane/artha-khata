import React, { useState } from 'react';
import {
  Moon,
  Sun,
  Coins,
  Building2,
  User,
  Trash2,
  Download,
  ShieldAlert,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import type { UserProfile, UserSettings } from '@/types/khata';

interface SettingsPageProps {
  onResetAllData: () => Promise<void>;
  onSyncNow: () => Promise<any>;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onResetAllData,
  onSyncNow,
  onToast,
}) => {
  const { profile, settings, updateProfile, updateSettings } = useAuth();

  // Profile fields
  const [name, setName] = useState(profile?.name || '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url || '');

  // Settings fields
  const [currency, setCurrency] = useState(settings?.currency || 'NPR');
  const [companyName, setCompanyName] = useState(settings?.company_name || 'KHATA Financials');
  const [theme, setTheme] = useState<'light' | 'dark'>(settings?.theme || 'light');

  // Saving states
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const currencies = [
    { code: 'NPR', label: 'NPR — Nepalese Rupee' },
    { code: 'USD', label: 'USD — US Dollar ($)' },
    { code: 'EUR', label: 'EUR — Euro (€)' },
    { code: 'INR', label: 'INR — Indian Rupee (₹)' },
    { code: 'GBP', label: 'GBP — British Pound (£)' },
    { code: 'AUD', label: 'AUD — Australian Dollar' },
    { code: 'CAD', label: 'CAD — Canadian Dollar' },
    { code: 'JPY', label: 'JPY — Japanese Yen (¥)' },
  ];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSavingProfile(true);
    try {
      await updateProfile({
        name: name.trim(),
        photo_url: photoUrl.trim() || null,
      });
      onToast('success', 'Profile updated successfully.');
    } catch (e: any) {
      onToast('error', 'Failed to update profile.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await updateSettings({
        currency,
        company_name: companyName.trim() || 'KHATA Financials',
        theme,
      });

      // Apply theme to document
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      onToast('success', 'Settings preferences updated.');
    } catch (e: any) {
      onToast('error', 'Failed to save settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleThemeToggle = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    updateSettings({ theme: newTheme });
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await onSyncNow();
      if (res?.success) {
        onToast('success', `Synced ${res.syncedCount} item(s) with Supabase.`);
      } else {
        onToast('info', 'Already up-to-date with cloud storage.');
      }
    } catch (e) {
      onToast('error', 'Sync encountered an error.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-8 max-w-4xl">
      {/* Top Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Application Settings
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure appearance, company branding on receipts, currency, and data sync.
        </p>
      </div>

      {/* 1. Appearance Theme */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
            {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Appearance &amp; Theme
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select your preferred visual mode.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <button
            type="button"
            onClick={() => handleThemeToggle('light')}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              theme === 'light'
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Light Mode</span>
          </button>

          <button
            type="button"
            onClick={() => handleThemeToggle('dark')}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              theme === 'dark'
                ? 'bg-slate-800 text-white border-slate-700 shadow-sm'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Dark Mode</span>
          </button>
        </div>
      </div>

      {/* 2. Currency & Company Branding */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Ledger &amp; Receipt Branding
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Appears on generated PNG bill receipts and official PDF statements.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-500" />
                <span>Primary Currency</span>
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Company / Entity Name</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. KHATA Financials"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 transition"
            >
              {isSavingSettings ? 'Saving...' : 'Update Branding'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Account Owner Profile */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
            <User className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Account Owner Profile
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Single-user owned expense management profile.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Full Name"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Avatar Image URL (Optional)
              </label>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 transition"
            >
              {isSavingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>

      {/* 4. Synchronization & Offline Cache */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Cloud Sync &amp; Offline Cache
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Data is persisted locally in IndexedDB and synchronized with Supabase.
              </p>
            </div>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
      </div>

      {/* 5. Progressive Web App Install */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Install KHATA App
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Install to your desktop, iPhone, iPad, or Android home screen.
            </p>
          </div>
        </div>

        <div className="sm:w-48">
          <PWAInstallButton variant="button" />
        </div>
      </div>

      {/* 6. Danger Zone: Reset App Data */}
      <div className="p-6 rounded-2xl bg-rose-50/40 dark:bg-rose-950/15 border border-rose-200 dark:border-rose-900/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
              Reset Application Data
            </h3>
            <p className="text-xs text-rose-700/80 dark:text-rose-400/80 mt-0.5 max-w-md">
              Permanently delete all groups, members, transactions, and splits from this device and Supabase.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsResetModalOpen(true)}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition shrink-0 cursor-pointer"
        >
          Reset My App Data
        </button>
      </div>

      {/* Security Confirm Reset Modal */}
      {isResetModalOpen && (
        <ConfirmDeleteModal
          isOpen={isResetModalOpen}
          title="Reset All Application Data"
          description="This action will permanently erase all your expense groups, members, transactions, splits, and local cache. Type 'RESET' to confirm."
          requiredConfirmation="RESET"
          confirmButtonText="Erase All My Data"
          onConfirm={async () => {
            await onResetAllData();
            setIsResetModalOpen(false);
            onToast('success', 'All application data has been wiped.');
          }}
          onCancel={() => setIsResetModalOpen(false)}
        />
      )}
    </div>
  );
};

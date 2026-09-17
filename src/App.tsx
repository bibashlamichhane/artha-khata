import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { useKhataData } from '@/hooks/useKhataData';
import { AuthPage } from '@/pages/Auth/AuthPage';
import { Sidebar, type ActiveTab } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { ToastContainer, type ToastMessage } from '@/components/Toast';
import { HomeDashboard } from '@/pages/Home/HomeDashboard';
import { GroupsPage } from '@/pages/Groups/GroupsPage';
import { GroupDetailPage } from '@/pages/Groups/GroupDetailPage';
import { ReportsPage } from '@/pages/Reports/ReportsPage';
import { SettingsPage } from '@/pages/Settings/SettingsPage';

function MainApp() {
  const { user, profile, settings, isLoading: isAuthLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const {
    groups,
    members,
    transactions,
    currency,
    syncStatus,
    pendingCount,
    isLoading: isDataLoading,
    overallSettlement,
    settlementsByGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    addMember,
    updateMember,
    deleteMember,
    addTransaction,
    deleteTransaction,
    resetAllUserData,
    syncNow,
  } = useKhataData();

  // Sync theme
  useEffect(() => {
    if (settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.theme]);

  // Loading state
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-2xl mb-4 animate-pulse">
          <img src="/icon.svg" alt="KHATA" className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">KHATA</h2>
        <p className="text-xs text-slate-400 mt-1">Loading secure ledger...</p>
      </div>
    );
  }

  // Not signed in -> Auth flow
  if (!user) {
    return <AuthPage />;
  }

  // Find active group if selected
  const activeGroup = selectedGroupId ? groups.find((g) => g.id === selectedGroupId) : null;
  const activeGroupMembers = activeGroup ? members.filter((m) => m.group_id === activeGroup.id) : [];
  const activeGroupTransactions = activeGroup
    ? transactions.filter((t) => t.group_id === activeGroup.id)
    : [];
  const activeGroupSettlement = activeGroup
    ? settlementsByGroup.get(activeGroup.id) || {
        group_id: activeGroup.id,
        total_spending: 0,
        balances: {},
        settlements: [],
        rotating_messages: ['All balances settled!'],
      }
    : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row transition-colors">
      {/* Desktop Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedGroupId(null);
        }}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <Navbar
          syncStatus={syncStatus}
          pendingCount={pendingCount}
          onSyncClick={async () => {
            const res = await syncNow();
            if (res?.success) {
              addToast('success', `Synced ${res.syncedCount} records.`);
            } else {
              addToast('info', 'Ledger is up to date.');
            }
          }}
          onProfileClick={() => {
            setActiveTab('settings');
            setSelectedGroupId(null);
          }}
        />

        {/* Dynamic Page Content */}
        <main className="flex-1 px-4 sm:px-6 md:px-8 py-6 max-w-7xl w-full mx-auto">
          {activeTab === 'home' && (
            <HomeDashboard
              userProfile={profile}
              settings={settings}
              groups={groups}
              members={members}
              transactions={transactions}
              overallSettlement={overallSettlement}
              currency={currency}
              onNavigateToGroups={() => {
                setActiveTab('groups');
                setSelectedGroupId(null);
              }}
              onSelectGroup={(gId) => {
                setActiveTab('groups');
                setSelectedGroupId(gId);
              }}
              onAddTransaction={addTransaction}
              onDeleteTransaction={deleteTransaction}
              onCreateGroup={createGroup}
              onToast={addToast}
            />
          )}

          {activeTab === 'groups' && (
            <>
              {activeGroup && activeGroupSettlement ? (
                <GroupDetailPage
                  group={activeGroup}
                  members={activeGroupMembers}
                  transactions={activeGroupTransactions}
                  settlement={activeGroupSettlement}
                  currency={currency}
                  settings={settings}
                  onBack={() => setSelectedGroupId(null)}
                  onAddTransaction={addTransaction}
                  onDeleteTransaction={deleteTransaction}
                  onAddMember={addMember}
                  onUpdateMember={updateMember}
                  onDeleteMember={deleteMember}
                  onToast={addToast}
                />
              ) : (
                <GroupsPage
                  groups={groups}
                  members={members}
                  transactions={transactions}
                  settlementsByGroup={settlementsByGroup}
                  currency={currency}
                  onSelectGroup={(id) => setSelectedGroupId(id)}
                  onCreateGroup={createGroup}
                  onUpdateGroup={updateGroup}
                  onDeleteGroup={deleteGroup}
                  onToast={addToast}
                />
              )}
            </>
          )}

          {activeTab === 'reports' && (
            <ReportsPage
              transactions={transactions}
              groups={groups}
              members={members}
              settings={settings}
              currency={currency}
              onToast={addToast}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              onResetAllData={resetAllUserData}
              onSyncNow={syncNow}
              onToast={addToast}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedGroupId(null);
        }}
      />

      {/* Global Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

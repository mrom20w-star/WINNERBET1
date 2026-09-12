import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { WebLayout } from './components/layout/WebLayout';
import { LoginView } from './components/auth/LoginView';
import { RegisterView } from './components/auth/RegisterView';
import { LobbyView } from './components/lobby/LobbyView';
import { CrashGame } from './components/games/CrashGame';
import { AppleOfFortune } from './components/games/AppleOfFortune';
import { DepositView } from './components/wallet/DepositView';
import { WithdrawView } from './components/wallet/WithdrawView';
import { AdminDashboard } from './components/admin/AdminDashboard';

const MainNavigator: React.FC = () => {
  const { screen } = useApp();

  switch (screen) {
    case 'login':
      return <LoginView />;
    case 'register':
      return <RegisterView />;
    case 'lobby':
      return <LobbyView />;
    case 'crash':
      return <CrashGame />;
    case 'apple_of_fortune':
      return <AppleOfFortune />;
    case 'deposit':
    case 'deposit_method':
      return <DepositView />;
    case 'withdraw':
      return <WithdrawView />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <CrashGame />;
  }
};

export default function App() {
  return (
    <AppProvider>
      <WebLayout>
        <MainNavigator />
      </WebLayout>
    </AppProvider>
  );
}

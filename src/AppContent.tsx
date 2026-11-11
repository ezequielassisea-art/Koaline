import React from 'react';
import { useApp } from './context/AppContext';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { Toast } from './components/common/Toast';
import { UserContextMenu } from './components/chat/UserContextMenu';
import { ProfileEditor } from './components/profile/ProfileEditor';
import { ProfileOnboarding } from './components/profile/ProfileOnboarding';
import { CreateChannelModal } from './components/channels/CreateChannelModal';
import { AuthOnboardingModal } from './components/auth/AuthOnboardingModal';
import { AdminPanel } from './components/admin/AdminPanel';
import { ConfirmModal } from './components/common/ConfirmModal';
import { UpdatePasswordPage } from './components/auth/UpdatePasswordPage';
import { IncomingCallCard } from './components/call/IncomingCallCard';
import { TooltipProvider } from './components/ui/tooltip';

const VoiceRoom = React.lazy(() => import('./components/call/VoiceRoom').then((module) => ({ default: module.VoiceRoom })));
const isHomePath = (pathname: string) => pathname === '/' || pathname === '/chat' || pathname === '/home' || pathname === '/profile';
const isPasswordUpdatePath = (pathname: string) => pathname === '/update-password';

export const AppContent: React.FC = () => {
  const {
    activeCall,
    pendingCallSwitch,
    confirmCallSwitch,
    cancelCallSwitch,
    communities,
    joinCommunityByInvite,
    createCommunity,
    addToast,
    isLoggedIn,
    isAuthLoading,
    authLoadError,
    retryAuthProfileLoad,
    currentUser,
    isDirectMessages,
    isContextPanelOpen,
    isProfileEditorOpen,
    isCreateChannelModalOpen,
    activeUserMenu,
    dms,
  } = useApp();

  const [isAdminPanelOpen, setIsAdminPanelOpen] = React.useState(false);
  const [isNotFound, setIsNotFound] = React.useState(() => !isHomePath(window.location.pathname) && !isPasswordUpdatePath(window.location.pathname));
  const wasReadyLoggedIn = React.useRef(false);
  const isCallFullscreen = activeCall && !activeCall.isMinimized;
  const openAdminPanel = React.useCallback(() => setIsAdminPanelOpen(true), []);

  React.useEffect(() => {
    const syncRoute = () => {
      let pathname = window.location.pathname;
      if (isHomePath(pathname) && pathname !== '/' && !isPasswordUpdatePath(pathname)) {
        window.history.replaceState({}, '', '/');
        pathname = '/';
      }
      setIsNotFound(pathname !== '/' && !isPasswordUpdatePath(pathname));
    };
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  React.useEffect(() => {
    if (isAuthLoading) return;
    if (isLoggedIn && !wasReadyLoggedIn.current) {
      if (!isPasswordUpdatePath(window.location.pathname)) {
        if (window.location.pathname !== '/') window.history.replaceState({}, '', '/');
        setIsNotFound(false);
      }
    }
    wasReadyLoggedIn.current = isLoggedIn;
  }, [isLoggedIn, isAuthLoading]);

  const handleCreateCommunityPrompt = async () => {
    const name = window.prompt('Qual o nome da sua nova comunidade?');
    if (name?.trim()) {
      await createCommunity({ name: name.trim(), visibility: 'public' });
    }
  };

  if (isAuthLoading) {
    return (
      <div className="app-shell flex h-screen w-screen items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center gap-3 text-sm text-text-muted" role="status" aria-live="polite">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <span>Carregando seu perfil…</span>
        </div>
        <Toast />
      </div>
    );
  }

  if (isPasswordUpdatePath(window.location.pathname)) return <UpdatePasswordPage />;

  if (authLoadError) {
    return (
      <div className="app-shell flex h-screen w-screen items-center justify-center overflow-hidden">
        <div className="max-w-md px-6 text-center" role="alert">
          <h1 className="mb-2 text-lg font-semibold text-text-main">Não foi possível carregar seu perfil</h1>
          <p className="mb-5 text-sm text-text-muted">{authLoadError}</p>
          <button type="button" onClick={retryAuthProfileLoad} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover">
            Tentar novamente
          </button>
        </div>
        <Toast />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="app-shell flex h-screen w-screen flex-col overflow-hidden">
        <AuthOnboardingModal />
        <Toast />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="app-shell flex flex-col h-screen w-screen overflow-hidden bg-bg-main">
        <IncomingCallCard />
        <DashboardLayout />
        {activeUserMenu && <UserContextMenu />}
        {isProfileEditorOpen && <ProfileEditor />}
        {isCreateChannelModalOpen && <CreateChannelModal />}
        {!isLoggedIn && <AuthOnboardingModal />}
        {isLoggedIn && !currentUser.onboarding_completed && <ProfileOnboarding />}
        {isAdminPanelOpen && <AdminPanel onClose={() => setIsAdminPanelOpen(false)} />}
        <ConfirmModal
          isOpen={pendingCallSwitch}
          title="Trocar de chamada?"
          description="Você já está em uma chamada de voz. Deseja sair da atual e entrar na nova?"
          confirmLabel="Sim, trocar"
          cancelLabel="Cancelar"
          onConfirm={confirmCallSwitch}
          onCancel={cancelCallSwitch}
        />
        <Toast />
      </div>
    </TooltipProvider>
  );
};
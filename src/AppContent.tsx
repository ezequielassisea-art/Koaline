import React from 'react';
import { useApp } from './context/AppContext';
import { TopBar } from './components/layout/TopBar';
import ServerRail from './components/layout/ServerRail';
import ChannelSidebar from './components/layout/ChannelSidebar';
import ChatArea from './components/layout/ChatArea';
import MemberList from './components/layout/MemberList';
import { DirectMessageView } from './components/chat/DirectMessageView';
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
        <div className="flex flex-col items-center gap-3 text-sm text-slate-400" role="status" aria-live="polite">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />
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
          <h1 className="mb-2 text-lg font-semibold text-white">Não foi possível carregar seu perfil</h1>
          <p className="mb-5 text-sm text-slate-400">{authLoadError}</p>
          <button type="button" onClick={retryAuthProfileLoad} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
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
    <div className="app-shell flex flex-col h-screen w-screen overflow-hidden bg-[#F3F4F6] text-gray-900">
      <IncomingCallCard />
      <TopBar className="flex-shrink-0" />
      <div className="flex min-h-0 flex-1 overflow-hidden p-4 md:p-6">
        {!isNotFound && (
          <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100">
            {/* Server Rail - 72px fixed */}
            <ServerRail />

            {/* Channel Sidebar - 240px fixed */}
            <ChannelSidebar />

            {/* Chat Area - flex-1 */}
            <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden relative min-w-0 rounded-r-2xl">
              {isDirectMessages ? (
                <DirectMessageView />
              ) : communities.length === 0 ? (
                <div className="m-auto w-full max-w-lg p-8 text-center">
                  <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-gray-200 bg-gray-100 text-2xl text-gray-600">
                    ◇
                  </div>
                  <h1 className="mb-2 text-2xl font-bold text-gray-900">Sua conta está pronta</h1>
                  <p className="mb-6 text-sm text-gray-500">
                    Crie sua comunidade ou entre em uma existente usando um código de convite para começar a conversar.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      className="rounded-lg bg-[#00BFFF] px-5 py-3 text-sm font-semibold text-white hover:bg-[#009FD6] transition-colors"
                      onClick={handleCreateCommunityPrompt}
                    >
                      Criar Comunidade
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        const code = window.prompt('Cole o código do convite:');
                        if (code && !joinCommunityByInvite(code)) {
                          addToast('Convite inválido', 'O código pode ter expirado, sido revogado ou atingido o limite de usos.', 'warning');
                        }
                      }}
                    >
                      Tenho um convite
                    </button>
                  </div>
                </div>
              ) : isCallFullscreen ? (
                <React.Suspense fallback={<div className="flex h-full items-center justify-center bg-gray-50 text-sm text-gray-500">Carregando sala de voz…</div>}>
                  <VoiceRoom />
                </React.Suspense>
              ) : (
                <ChatArea />
              )}
            </main>

            {/* Member List - 280px, only rendered when open */}
            {isContextPanelOpen && (
              <MemberList className="flex-shrink-0 w-[280px]" />
            )}
          </div>
        )}

        {isNotFound && (
          <main className="koaline-not-found flex-1 flex items-center justify-center rounded-2xl bg-white shadow-sm border border-gray-100">
            <div className="text-center p-8">
              <span className="text-6xl font-bold text-gray-200">404</span>
              <h1 className="mt-4 text-2xl font-bold text-gray-900">Esta página não foi encontrada</h1>
              <p className="mt-2 text-gray-500">Confira o endereço ou volte para suas conversas.</p>
              <button
                type="button"
                className="mt-6 rounded-lg bg-[#00BFFF] px-5 py-3 text-sm font-semibold text-white hover:bg-[#009FD6] transition-colors"
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
              >
                Voltar ao Koaline
              </button>
            </div>
          </main>
        )}
      </div>
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
  );
};
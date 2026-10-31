import React from 'react';
import { useApp } from './context/AppContext';
import { TopBar } from './components/layout/TopBar';
import { ChannelList } from './components/layout/ChannelList';
import { ChatView } from './components/chat/ChatView';
import { ContextPanel } from './components/layout/ContextPanel';
import { VoiceJoinModal } from './components/call/VoiceJoinModal';
import { ScreenSharePiP } from './components/call/ScreenSharePiP';
import { Toast } from './components/common/Toast';
import { UserContextMenu } from './components/chat/UserContextMenu';
import { ProfileEditor } from './components/profile/ProfileEditor';
import { ProfileOnboarding } from './components/profile/ProfileOnboarding';
import { ThemeCustomizer } from './components/theme/ThemeCustomizer';
import { CreateChannelModal } from './components/channels/CreateChannelModal';
import { AuthOnboardingModal } from './components/auth/AuthOnboardingModal';
import { AdminPanel } from './components/admin/AdminPanel';
import { ConfirmModal } from './components/common/ConfirmModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Channel } from './types';

const VoiceRoom = React.lazy(() => import('./components/call/VoiceRoom').then((module) => ({ default: module.VoiceRoom })));
const OrbitPage = React.lazy(() => import('./features/orbit/OrbitPage').then((module) => ({ default: module.OrbitPage })));
const isHomePath = (pathname: string) => pathname === '/' || pathname === '/chat' || pathname === '/home' || pathname === '/profile';

export const AppContent: React.FC = () => {
  const { activeCall, pendingCallSwitch, confirmCallSwitch, cancelCallSwitch, communities, joinCommunityByInvite, addToast, isLoggedIn, isAuthLoading, authLoadError, retryAuthProfileLoad, currentUser, isContextPanelOpen, isProfileEditorOpen, isThemeCustomizerOpen, isCreateChannelModalOpen, activeUserMenu, startCall } = useApp();
  const [isAdminPanelOpen, setIsAdminPanelOpen] = React.useState(false);
  const [selectedVoiceChannel, setSelectedVoiceChannel] = React.useState<Channel | null>(null);
  const [isOrbitPage, setIsOrbitPage] = React.useState(() => window.location.pathname === '/orbit');
  const [hasVisitedOrbit, setHasVisitedOrbit] = React.useState(() => window.location.pathname === '/orbit');
  const [isNotFound, setIsNotFound] = React.useState(() => !isHomePath(window.location.pathname) && window.location.pathname !== '/orbit');
  const wasReadyLoggedIn = React.useRef(false);
  const isCallFullscreen = activeCall && !activeCall.isMinimized;
  const openAdminPanel = React.useCallback(() => setIsAdminPanelOpen(true), []);
  const closeOrbit = React.useCallback(() => {
    if (window.location.pathname === '/orbit') window.history.pushState({}, '', '/');
    setIsOrbitPage(false);
    setIsNotFound(false);
  }, []);
  const openOrbit = React.useCallback(() => {
    if (window.location.pathname !== '/orbit') window.history.pushState({}, '', '/orbit');
    setIsOrbitPage(true);
    setHasVisitedOrbit(true);
    setIsNotFound(false);
  }, []);

  React.useEffect(() => {
    const syncRoute = () => {
      let pathname = window.location.pathname;
      if (isHomePath(pathname) && pathname !== '/') {
        window.history.replaceState({}, '', '/');
        pathname = '/';
      }
      const nextIsOrbit = pathname === '/orbit';
      setIsOrbitPage(nextIsOrbit);
      if (nextIsOrbit) setHasVisitedOrbit(true);
      setIsNotFound(pathname !== '/' && !nextIsOrbit);
    };
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  React.useEffect(() => {
    if (isAuthLoading) return;
    if (isLoggedIn && !wasReadyLoggedIn.current) {
      if (window.location.pathname !== '/') window.history.replaceState({}, '', '/');
      setIsOrbitPage(false);
      setIsNotFound(false);
    }
    wasReadyLoggedIn.current = isLoggedIn;
  }, [isLoggedIn, isAuthLoading]);

  if (isAuthLoading) return <div className="app-shell flex h-screen w-screen items-center justify-center overflow-hidden"><div className="flex flex-col items-center gap-3 text-sm text-slate-400" role="status" aria-live="polite"><div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" /><span>Carregando seu perfil…</span></div><Toast /></div>;

  if (authLoadError) return <div className="app-shell flex h-screen w-screen items-center justify-center overflow-hidden"><div className="max-w-md px-6 text-center" role="alert"><h1 className="mb-2 text-lg font-semibold text-white">Não foi possível carregar seu perfil</h1><p className="mb-5 text-sm text-slate-400">{authLoadError}</p><button type="button" onClick={retryAuthProfileLoad} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">Tentar novamente</button></div><Toast /></div>;

  if (!isLoggedIn) return <div className="app-shell flex h-screen w-screen flex-col overflow-hidden"><AuthOnboardingModal /><Toast /></div>;

  return (
    <div className="app-shell flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-200">
      <TopBar isOrbitPage={isOrbitPage} />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden" style={{ display: isOrbitPage || isNotFound ? 'none' : 'flex' }}>
          {communities.length > 0 && <ChannelList onOpenAdmin={openAdminPanel} onOpenVoiceChannel={setSelectedVoiceChannel} />}
          <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden relative">
            {communities.length === 0 ? <div className="m-auto w-full max-w-lg p-8 text-center"><div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-slate-700 bg-slate-900 text-2xl">◇</div><h1 className="mb-2 text-2xl font-bold">Sua conta está pronta</h1><p className="mb-6 text-sm text-slate-400">Explore o Orbit para encontrar uma comunidade. Você pode participar de uma existente e criar a sua quando quiser.</p><button type="button" className="rounded-lg bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-500" onClick={openOrbit}>Explorar Orbit</button><button type="button" className="mt-4 block w-full text-sm text-slate-400 hover:text-white" onClick={() => { const code = window.prompt('Cole o código do convite:'); if (code && !joinCommunityByInvite(code)) addToast('Convite inválido', 'O código pode ter expirado, sido revogado ou atingido o limite de usos.', 'warning'); }}>Tenho um convite</button></div> : isCallFullscreen ? <React.Suspense fallback={<div className="flex h-full items-center justify-center bg-slate-950 text-sm text-slate-400">Carregando sala de voz…</div>}><VoiceRoom /></React.Suspense> : <ChatView />}
            {activeCall?.isMinimized && activeCall.isScreenSharing && <ScreenSharePiP />}
          </main>
        </div>

        {(isOrbitPage || hasVisitedOrbit) && <div className="min-h-0 flex-1 overflow-hidden" style={{ display: isOrbitPage ? 'flex' : 'none' }}>
          <ErrorBoundary fullScreen={false} title="Algo deu errado no Orbit" message="O feed não conseguiu ser exibido. O restante do Koaline continua disponível.">
            <React.Suspense fallback={<main className="flex flex-1 items-center justify-center bg-slate-950 text-sm text-slate-400">Carregando Orbit…</main>}><OrbitPage onBack={closeOrbit} /></React.Suspense>
          </ErrorBoundary>
        </div>}

        {isNotFound && <main className="koaline-not-found"><div><span>404</span><h1>Esta página não foi encontrada</h1><p>Confira o endereço ou volte para suas conversas.</p><button type="button" onClick={() => { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); }}>Voltar ao Koaline</button></div></main>}
        {communities.length > 0 && isContextPanelOpen && <ContextPanel />}
      </div>
      {activeUserMenu && <UserContextMenu />}
      {isProfileEditorOpen && <ProfileEditor />}
      {isThemeCustomizerOpen && <ThemeCustomizer />}
      {isCreateChannelModalOpen && <CreateChannelModal />}
      {!isLoggedIn && <AuthOnboardingModal />}
      {isLoggedIn && !currentUser.onboarding_completed && <ProfileOnboarding />}
      {isAdminPanelOpen && <AdminPanel onClose={() => setIsAdminPanelOpen(false)} />}
      {selectedVoiceChannel && <VoiceJoinModal channel={selectedVoiceChannel} onClose={() => setSelectedVoiceChannel(null)} onJoin={(isDeafened) => { startCall(selectedVoiceChannel, 'voice', isDeafened); setSelectedVoiceChannel(null); }} />}
      <ConfirmModal isOpen={pendingCallSwitch} title="Trocar de chamada?" description="Você já está em uma chamada de voz. Deseja sair da atual e entrar na nova?" confirmLabel="Sim, trocar" cancelLabel="Cancelar" onConfirm={confirmCallSwitch} onCancel={cancelCallSwitch} />
      <Toast />
    </div>
  );
};


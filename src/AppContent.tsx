import React from 'react';
// import { useApp } from './context/AppContext';
// import { DashboardLayout } from './components/layout/DashboardLayout';
import { Toast } from './components/common/Toast';
// import { UserContextMenu } from './components/chat/UserContextMenu';
// import { ProfileEditor } from './components/profile/ProfileEditor';
// import { ProfileOnboarding } from './components/profile/ProfileOnboarding';
// import { CreateChannelModal } from './components/channels/CreateChannelModal';
// import { AuthOnboardingModal } from './components/auth/AuthOnboardingModal';
// import { AdminPanel } from './components/admin/AdminPanel';
// import { ConfirmModal } from './components/common/ConfirmModal';
// import { UpdatePasswordPage } from './components/auth/UpdatePasswordPage';
// import { IncomingCallCard } from './components/call/IncomingCallCard';
// import { TooltipProvider } from './components/ui/tooltip';
import { MaintenancePage } from './components/common/MaintenancePage';

// const VoiceRoom = React.lazy(() => import('./components/call/VoiceRoom').then((module) => ({ default: module.VoiceRoom })));
// const isHomePath = (pathname: string) => pathname === '/' || pathname === '/chat' || pathname === '/home' || pathname === '/profile';
// const isPasswordUpdatePath = (pathname: string) => pathname === '/update-password';

export const AppContent: React.FC = () => {
  // const {
  //   activeCall,
  //   pendingCallSwitch,
  //   confirmCallSwitch,
  //   cancelCallSwitch,
  //   communities,
  //   joinCommunityByInvite,
  //   createCommunity,
  //   addToast,
  //   isLoggedIn,
  //   isAuthLoading,
  //   authLoadError,
  //   retryAuthProfileLoad,
  //   currentUser,
  //   isDirectMessages,
  //   isContextPanelOpen,
  //   isProfileEditorOpen,
  //   isCreateChannelModalOpen,
  //   activeUserMenu,
  //   dms,
  // } = useApp();

  // const [isAdminPanelOpen, setIsAdminPanelOpen] = React.useState(false);
  // const [isNotFound, setIsNotFound] = React.useState(() => !isHomePath(window.location.pathname) && !isPasswordUpdatePath(window.location.pathname));
  // const wasReadyLoggedIn = React.useRef(false);
  // const isCallFullscreen = activeCall && !activeCall.isMinimized;
  // const openAdminPanel = React.useCallback(() => setIsAdminPanelOpen(true), []);

  // React.useEffect(() => {
  //   const syncRoute = () => {
  //     let pathname = window.location.pathname;
  //     if (isHomePath(pathname) && pathname !== '/' && !isPasswordUpdatePath(pathname)) {
  //       window.history.replaceState({}, '', '/');
  //       pathname = '/';
  //     }
  //     setIsNotFound(pathname !== '/' && !isPasswordUpdatePath(pathname));
  //   };
  //   window.addEventListener('popstate', syncRoute);
  //   return () => window.removeEventListener('popstate', syncRoute);
  // }, []);

  // React.useEffect(() => {
  //   if (isAuthLoading) return;
  //   if (isLoggedIn && !wasReadyLoggedIn.current) {
  //     if (!isPasswordUpdatePath(window.location.pathname)) {
  //       if (window.location.pathname !== '/') window.history.replaceState({}, '', '/');
  //       setIsNotFound(false);
  //     }
  //   }
  //   wasReadyLoggedIn.current = isLoggedIn;
  // }, [isLoggedIn, isAuthLoading]);

  // const handleCreateCommunityPrompt = async () => {
  //   const name = window.prompt('Qual o nome da sua nova comunidade?');
  //   if (name?.trim()) {
  //     await createCommunity({ name: name.trim(), visibility: 'public' });
  //   }
  // };

  // TEMPORÁRIO: Mostrar apenas a página de manutenção
  return <MaintenancePage />;
};
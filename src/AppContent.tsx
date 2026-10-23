import React from 'react';
import { useApp } from './context/AppContext';
import { TopBar } from './components/layout/TopBar';
import { ChannelList } from './components/layout/ChannelList';
import { ChatView } from './components/chat/ChatView';
import { ContextPanel } from './components/layout/ContextPanel';
import { VoiceRoom } from './components/call/VoiceRoom';
import { VoiceJoinModal } from './components/call/VoiceJoinModal';
import { ScreenSharePiP } from './components/call/ScreenSharePiP';
import { Toast } from './components/common/Toast';
import { UserOptionsMenu } from './components/chat/UserOptionsMenu';
import { ProfileEditor } from './components/profile/ProfileEditor';
import { ThemeCustomizer } from './components/theme/ThemeCustomizer';
import { CreateChannelModal } from './components/channels/CreateChannelModal';
import { AuthOnboardingModal } from './components/auth/AuthOnboardingModal';
import { AdminPanel } from './components/admin/AdminPanel';
import { Channel } from './types';

export const AppContent: React.FC = () => {
  const { activeCall, communities, createCommunity, joinCommunityByInvite, addToast, isLoggedIn, isProfileEditorOpen, isThemeCustomizerOpen, isCreateChannelModalOpen, activeUserMenu, startCall, setCurrentChannelId } = useApp();
  const [isAdminPanelOpen, setIsAdminPanelOpen] = React.useState(false);
  const [selectedVoiceChannel, setSelectedVoiceChannel] = React.useState<Channel | null>(null);
  const [communityName, setCommunityName] = React.useState('');
  const [communityIcon, setCommunityIcon] = React.useState('');
  const [visibility, setVisibility] = React.useState<'public' | 'private'>('public');
  const isCallFullscreen = activeCall && !activeCall.isMinimized;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950 text-slate-200">
      {/* Top Bar Fixa */}
      <TopBar />

      {/* Main: 3 Colunas */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Coluna 1: Canais/DMs */}
        {communities.length > 0 && <ChannelList onOpenAdmin={() => setIsAdminPanelOpen(true)} onOpenVoiceChannel={setSelectedVoiceChannel} />}

        {/* Coluna 2: Chat ou Sala de Voz */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
          {communities.length === 0 ? <div className="m-auto w-full max-w-md p-8 text-center"><div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-slate-700 bg-slate-900 text-2xl">◇</div><h1 className="mb-2 text-2xl font-bold">Criar comunidade</h1><p className="mb-6 text-sm text-slate-400">Comece um espaço para conversar e colaborar.</p><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createCommunity({ name: communityName, icon: communityIcon, visibility }); }}><input required value={communityName} onChange={(event) => setCommunityName(event.target.value)} placeholder="Nome da comunidade" className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm"/><label className="block text-left text-sm text-slate-300">Ícone (opcional)<input type="file" accept="image/*" className="mt-2 block w-full text-sm text-slate-400" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setCommunityIcon(String(reader.result)); reader.readAsDataURL(file); }}/>{communityIcon && <img src={communityIcon} alt="Prévia do ícone" className="mt-2 h-12 w-12 rounded-xl object-cover"/>}</label><select value={visibility} onChange={(event) => setVisibility(event.target.value as 'public'|'private')} className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm"><option value="public">Pública</option><option value="private">Privada — somente convite</option></select><button className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white">Criar comunidade</button></form><button className="mt-3 text-sm text-slate-400 hover:text-white" onClick={() => { const code = window.prompt('Cole o código do convite:'); if (code && !joinCommunityByInvite(code)) addToast('Convite inválido', 'O código pode ter expirado, sido revogado ou atingido o limite de usos.', 'warning'); }}>Entrar com código de convite</button></div> : isCallFullscreen ? <VoiceRoom /> : <ChatView />}
          {activeCall?.isMinimized && activeCall.isScreenSharing && <ScreenSharePiP />}
        </main>

        {/* Coluna 3: Perfil contextual */}
        {communities.length > 0 && <ContextPanel />}
      </div>

      {/* Modais e overlays */}
      {activeUserMenu && <UserOptionsMenu />}
      {isProfileEditorOpen && <ProfileEditor />}
      {isThemeCustomizerOpen && <ThemeCustomizer />}
      {isCreateChannelModalOpen && <CreateChannelModal />}
      {!isLoggedIn && <AuthOnboardingModal />}
      {isAdminPanelOpen && <AdminPanel onClose={() => setIsAdminPanelOpen(false)} />}
      {selectedVoiceChannel && <VoiceJoinModal channel={selectedVoiceChannel} onClose={() => setSelectedVoiceChannel(null)} onJoin={(isDeafened) => { setCurrentChannelId(selectedVoiceChannel.id); startCall(selectedVoiceChannel, 'voice', isDeafened); setSelectedVoiceChannel(null); }} />}

      {/* Notificações Toast */}
      <Toast />
    </div>
  );
};

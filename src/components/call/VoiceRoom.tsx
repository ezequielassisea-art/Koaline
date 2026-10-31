import React, { useState, useEffect, useRef, useId } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  Minimize2,
  PhoneOff,
  ChevronDown,
  Volume2,
  VolumeX,
  Maximize2,
  Music,
  Play,
  X,
} from 'lucide-react';
import { audioManager } from '../../services/AudioManager';
import { EmptyState } from '../common/EmptyState';
import { AudioTrack, LiveKitRoom, useIsSpeaking, useLocalParticipant, useParticipants, useRoomContext, useTracks, useConnectionState } from '@livekit/components-react';
import { ConnectionState, DisconnectReason, Participant, RoomEvent, TokenSource, Track } from 'livekit-client';
import { SoundDraft } from './SoundEditorModal';
import { getGroupSounds } from '../../services/GroupSoundStore';
import { supabase } from '../../services/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Avatar } from '../common/Avatar';
import { User } from '../../types';
import { canModerateCommunity } from '../admin/adminAccess';

const MICROPHONE_CAPTURE_OPTIONS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
const LIVEKIT_ROOM_OPTIONS = { audioCaptureDefaults: MICROPHONE_CAPTURE_OPTIONS };

const LIVEKIT_SERVER_URL = 'wss://callgroup-1qh235tw.livekit.cloud';
const tokenSource = TokenSource.sandboxTokenServer('callgroup-bnyk7k');
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const isInternalIdentity = (value: string) => isUuid(value) || /^user[_-]/i.test(value);
const firstVisibleLabel = (...values: Array<string | null | undefined>) => values
  .map((value) => value?.trim() || '')
  .find((value) => value && !isInternalIdentity(value)) || '';

type VoicePresenceMeta = {
  user_id?: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  status?: User['status'];
  muted?: boolean;
};

type VoicePresenceParticipant = VoicePresenceMeta & { user_id: string };
type VoiceProfile = { username?: string | null; full_name?: string | null; avatar_url?: string | null };

const LiveParticipantTile: React.FC<{ participant: Participant; user: { id: string; name: string; handle: string; avatar: string }; isMuted: boolean; isSharingScreen?: boolean; onOpen: () => void }> = ({ participant, user, isMuted, isSharingScreen, onOpen }) => {
  const isSpeaking = useIsSpeaking(participant);

  return (
    <div onClick={onOpen} className={`group relative flex w-full max-w-xs cursor-pointer flex-col items-center rounded-nest border bg-slate-900 p-5 shadow-xl transition-all hover:border-indigo-500/50 ${isSharingScreen ? 'border-sky-400 ring-2 ring-sky-500/40' : 'border-slate-800'}`}>
      <div className="relative mb-3">
        <Avatar src={user.avatar} name={user.name} className={`h-24 w-24 rounded-full transition-all duration-200 ${isSpeaking ? 'scale-105 ring-4 ring-indigo-500 shadow-glow-speaking' : isMuted ? 'opacity-60 ring-2 ring-slate-800' : 'ring-2 ring-slate-700'}`} />
        {isMuted && <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-rose-400 shadow-md"><MicOff className="h-3.5 w-3.5" /></span>}
        {isSpeaking && <span className="absolute -top-1 right-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm animate-pulse">Falando</span>}
      </div>
      <span className="max-w-[180px] truncate text-xs font-title font-bold text-white">{user.name}</span>
      <span className="mt-0.5 text-[10px] text-slate-400">@{user.handle}</span>
    </div>
  );
};

const StaticParticipantTile: React.FC<{ user: { id: string; name: string; handle: string; avatar: string }; isMuted: boolean; isSharingScreen?: boolean; onOpen: () => void }> = ({ user, isMuted, isSharingScreen, onOpen }) => {
  return (
    <div onClick={onOpen} className={`group relative flex w-full max-w-xs cursor-pointer flex-col items-center rounded-nest border bg-slate-900 p-5 shadow-xl transition-all hover:border-indigo-500/50 ${isSharingScreen ? 'border-sky-400 ring-2 ring-sky-500/40' : 'border-slate-800'}`}>
      <div className="relative mb-3">
        <Avatar src={user.avatar} name={user.name} className={`h-24 w-24 rounded-full transition-all duration-200 ${isMuted ? 'opacity-60 ring-2 ring-slate-800' : 'ring-2 ring-slate-700'}`} />
        {isMuted && <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-rose-400 shadow-md"><MicOff className="h-3.5 w-3.5" /></span>}
      </div>
      <span className="max-w-[180px] truncate text-xs font-title font-bold text-white">{user.name}</span>
      <span className="mt-0.5 text-[10px] text-slate-400">@{user.handle}</span>
    </div>
  );
};

const ParticipantTile: React.FC<{ participant?: Participant | null; user: { id: string; name: string; handle: string; avatar: string }; isMuted: boolean; isSharingScreen?: boolean; onOpen: () => void }> = ({ participant, user, isMuted, isSharingScreen, onOpen }) => {
  if (participant) {
    return <LiveParticipantTile participant={participant} user={user} isMuted={isMuted} isSharingScreen={isSharingScreen} onOpen={onOpen} />;
  }
  return <StaticParticipantTile user={user} isMuted={isMuted} isSharingScreen={isSharingScreen} onOpen={onOpen} />;
};

export const VoiceRoom: React.FC = () => {
  const { activeCall, currentUser, addToast, leaveCall } = useApp();
  const [tokenResult, setTokenResult] = useState<{ channelId: string; token?: string; error?: string } | null>(null);
  const fallbackIdentity = useId().replace(/:/g, '');
  const callChannelId = activeCall?.channelId;
  const addToastRef = useRef(addToast);
  const hasConnectedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => { hasConnectedRef.current = false; }, [callChannelId]);
  useEffect(() => { addToastRef.current = addToast; }, [addToast]);

  useEffect(() => {
    if (!callChannelId) return;
    let cancelled = false;
    const fetchToken = async () => {
      try {
        const credentials = await tokenSource.fetch({
          roomName: callChannelId,
          participantName: (!currentUser.name || isInternalIdentity(currentUser.name)) ? 'Membro Koaline' : currentUser.name,
          participantIdentity: currentUser.id || currentUser.handle || fallbackIdentity,
        });
        if (!cancelled) setTokenResult({ channelId: callChannelId, token: credentials.participantToken });
      } catch (error) {
        if (!cancelled) {
          addToastRef.current('Não foi possível obter acesso à chamada', error instanceof Error ? error.message : 'Verifique a configuração do LiveKit Cloud.', 'warning');
          setTokenResult({ channelId: callChannelId, error: error instanceof Error ? error.message : 'Verifique a configuração do LiveKit Cloud.' });
        }
      }
    };
    void fetchToken();
    return () => { cancelled = true; };
  }, [callChannelId, currentUser.handle, currentUser.id, currentUser.name, fallbackIdentity]);

  if (!activeCall) return null;
  const token = tokenResult?.channelId === activeCall.channelId ? tokenResult.token : null;
  const tokenError = tokenResult?.channelId === activeCall.channelId ? tokenResult.error : null;
  if (!token) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-950 text-sm text-slate-300">
        {tokenError ? (
          <div className="text-center">
            <p className="mb-3 text-rose-300">{tokenError}</p>
            <button onClick={() => leaveCall()} className="rounded-lg bg-slate-800 px-4 py-2 hover:bg-slate-700">
              Sair da chamada
            </button>
          </div>
        ) : (
          'Conectando à sala de voz…'
        )}
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={LIVEKIT_SERVER_URL}
      connect={true}
      audio={false}
      video={false}
      options={LIVEKIT_ROOM_OPTIONS}
      onMediaDeviceFailure={(_failure, kind) => {
        if (kind === 'audioinput') {
          addToast('Microfone não autorizado', 'Permita o acesso ao microfone nas configurações do navegador para falar na chamada.', 'warning');
        }
      }}
      onError={(error) => addToast('Falha na chamada', error.message || 'Não foi possível conectar ao LiveKit.', 'warning')}
      onConnected={() => {
        if (!hasConnectedRef.current) {
          hasConnectedRef.current = true;
          void audioManager.play('join_call');
        }
      }}
      onDisconnected={(reason) => {
        if (!isMountedRef.current || !hasConnectedRef.current) return;
        hasConnectedRef.current = false;
        if (reason && reason !== DisconnectReason.CLIENT_INITIATED) {
          leaveCall(callChannelId, true);
          addToast('Conexão encerrada', 'A conexão com a call foi perdida.', 'warning');
          return;
        }
        leaveCall(callChannelId);
      }}
    >
      <VoiceRoomConnected />
    </LiveKitRoom>
  );
};

const RemoteAudioTracks: React.FC<{ volumes: Record<string, number>; muted: Record<string, boolean> }> = ({ volumes, muted }) => {
  const tracks = useTracks([Track.Source.Microphone, Track.Source.Unknown]);
  return (
    <>
      {tracks.filter((ref) => !ref.participant.isLocal).map((ref) => {
        const id = ref.participant.identity;
        return <AudioTrack key={`${id}-${ref.publication.trackSid || ref.source}`} trackRef={ref} volume={muted[id] ? 0 : (volumes[id] ?? 1)} />;
      })}
    </>
  );
};

const VoiceRoomConnected: React.FC = () => {
  const {
    activeCall,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    toggleMinimizeCall,
    switchCallChannel,
    communities,
    currentCommunityId,
    openUserProfile,
    watchScreen,
    stopWatchingScreen,
    currentUser,
    syncVoiceParticipants,
    leaveCall,
    addToast
  } = useApp();

  const { localParticipant, isMicrophoneEnabled } = useLocalParticipant();
  const liveParticipants = useParticipants();
  const room = useRoomContext();
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [sharingUserId, setSharingUserId] = useState<string | null>(null);
  const [isWatchingRemoteScreen, setIsWatchingRemoteScreen] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);
  const remoteScreenTrackRef = useRef<MediaStreamTrack | null>(null);
  useEffect(() => {
    const clearRemoteScreen = (track: any, publication: any, participant: Participant) => {
      if (publication.source !== Track.Source.ScreenShare || track.kind !== Track.Kind.Video) return;
      if (remoteScreenTrackRef.current !== track.mediaStreamTrack) return;
      remoteScreenTrackRef.current = null;
      setRemoteScreenStream(null);
      setSharingUserId(null);
      setIsWatchingRemoteScreen(false);
    };
    const onTrackSubscribed = (track: any, publication: any, participant: Participant) => {
      if (publication.source !== Track.Source.ScreenShare || track.kind !== Track.Kind.Video || participant.isLocal) return;
      remoteScreenTrackRef.current = track.mediaStreamTrack;
      setRemoteScreenStream(new MediaStream([track.mediaStreamTrack]));
      setSharingUserId(participant.identity);
    };
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, clearRemoteScreen);
    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        const track = publication.track;
        if (track && publication.source === Track.Source.ScreenShare && track.kind === Track.Kind.Video) {
          remoteScreenTrackRef.current = track.mediaStreamTrack;
          setRemoteScreenStream(new MediaStream([track.mediaStreamTrack]));
          setSharingUserId(participant.identity);
        }
      });
    });
    return () => {
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, clearRemoteScreen);
      remoteScreenTrackRef.current = null;
      setRemoteScreenStream(null);
      setSharingUserId(null);
      setIsWatchingRemoteScreen(false);
    };
  }, [room]);
  useEffect(() => {
    if (previewVideoRef.current) previewVideoRef.current.srcObject = remoteScreenStream;
    if (modalVideoRef.current) modalVideoRef.current.srcObject = remoteScreenStream;
  }, [remoteScreenStream, isWatchingRemoteScreen]);
  const participantSignature = liveParticipants.map((participant) => `${participant.identity}:${participant.name}`).sort().join('|');
  const connectionState = useConnectionState(room);
  const [presenceParticipants, setPresenceParticipants] = useState<VoicePresenceParticipant[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, VoiceProfile>>({});
  const [broadcastMuteStates, setBroadcastMuteStates] = useState<Record<string, boolean>>({});
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const profileRequestsRef = useRef(new Set<string>());
  const profileCacheRef = useRef<Record<string, VoiceProfile>>({});

  useEffect(() => { profileCacheRef.current = profilesById; }, [profilesById]);

  // Busca de perfis na tabela profiles
  const fetchProfiles = async (ids: string[]) => {
    if (!supabase) return;
    const missing = [...new Set(ids)].filter((id) => id && !profileCacheRef.current[id] && !profileRequestsRef.current.has(id));
    if (!missing.length) return;
    missing.forEach((id) => profileRequestsRef.current.add(id));
    try {
      const { data, error } = await supabase.from('profiles').select('id,username,full_name,avatar_url').in('id', missing);
      if (error) throw error;
      const loaded = Object.fromEntries((data || []).map((profile) => [profile.id, {
        username: profile.username,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      }]));
      setProfilesById((previous) => ({ ...previous, ...loaded }));
      Object.keys(loaded).forEach((id) => profileRequestsRef.current.delete(id));
      missing.filter((id) => !loaded[id]).forEach((id) => profileRequestsRef.current.delete(id));
    } catch {
      missing.forEach((id) => profileRequestsRef.current.delete(id));
    }
  };

  // Supabase Presence e Broadcast
  useEffect(() => {
    if (!activeCall || !currentUser.id || room.name !== activeCall.channelId || !supabase) return;
    let active = true;
    const client = supabase;
    const channel = client.channel(`koaline:voice-room:${activeCall.channelId}`, {
      config: { presence: { key: currentUser.id } },
    });
    presenceChannelRef.current = channel;
    setPresenceParticipants([]);
    setBroadcastMuteStates({});
    profileRequestsRef.current.clear();

    const syncPresence = () => {
      const state = channel.presenceState<VoicePresenceMeta>();
      const entries = Object.entries(state).flatMap(([key, metas]) => {
        const meta = metas[metas.length - 1];
        const userId = meta?.user_id || key;
        return userId ? [{ ...meta, user_id: userId }] : [];
      });
      const unique = [...new Map(entries.map((entry) => [entry.user_id, entry])).values()];
      setPresenceParticipants(unique);
      void fetchProfiles(unique.map((entry) => entry.user_id));
    };

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
      .on('broadcast', { event: 'play_sound' }, ({ payload }) => {
        const audioUrl = typeof payload?.url === 'string' ? payload.url : (typeof payload?.audioUrl === 'string' ? payload.audioUrl : '');
        if (!audioUrl) return;
        try {
          const audio = new Audio(audioUrl);
          audio.play().catch(() => audioManager.playCustom(audioUrl));
        } catch {
          audioManager.playCustom(audioUrl);
        }
        const soundId = typeof payload?.soundId === 'string' ? payload.soundId : '';
        if (soundId) {
          soundAnimationNonce.current += 1;
          setSoundAnimation({ id: soundId, nonce: soundAnimationNonce.current });
        }
      })
      .on('broadcast', { event: 'microphone_state' }, ({ payload }) => {
        const userId = typeof payload?.userId === 'string' ? payload.userId : '';
        if (userId && typeof payload?.muted === 'boolean') {
          setBroadcastMuteStates((previous) => ({ ...previous, [userId]: payload.muted }));
        }
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED' || !active) return;
        
        // Ao entrar na call, busca o perfil na tabela profiles (select username, avatar_url)
        let resolvedUsername = (!currentUser.name || isInternalIdentity(currentUser.name)) ? 'Membro Koaline' : currentUser.name;
        let resolvedAvatar = currentUser.avatar || '';

        try {
          const { data: myProfile } = await client
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', currentUser.id)
            .maybeSingle();

          if (myProfile?.username && !isInternalIdentity(myProfile.username)) {
            resolvedUsername = myProfile.username;
          }
          if (myProfile?.avatar_url) {
            resolvedAvatar = myProfile.avatar_url;
          }
          setProfilesById((prev) => ({
            ...prev,
            [currentUser.id]: { username: resolvedUsername, avatar_url: resolvedAvatar }
          }));
        } catch {
          // Se falhar, usa "Membro Koaline"
          resolvedUsername = 'Membro Koaline';
        }

        await channel.track({
          user_id: currentUser.id,
          username: resolvedUsername,
          full_name: resolvedUsername,
          avatar_url: resolvedAvatar || undefined,
          status: currentUser.status === 'idle' || currentUser.status === 'dnd' ? currentUser.status : 'online',
          muted: !localParticipant.isMicrophoneEnabled,
        } satisfies VoicePresenceMeta);

        syncPresence();
      });

    return () => {
      active = false;
      if (presenceChannelRef.current === channel) presenceChannelRef.current = null;
      void client.removeChannel(channel);
    };
  }, [activeCall?.channelId, currentUser.id, room.name]);

  // Atualização em tempo real do estado de microfone via Presence & Broadcast
  useEffect(() => {
    const channel = presenceChannelRef.current;
    if (!channel || !currentUser.id) return;
    const muted = !isMicrophoneEnabled;
    const profile = profileCacheRef.current[currentUser.id];
    const username = firstVisibleLabel(profile?.username, profile?.full_name, currentUser.name, currentUser.handle) || 'Membro Koaline';
    const avatar = profile?.avatar_url || currentUser.avatar || '';

    void channel.track({
      user_id: currentUser.id,
      username,
      full_name: username,
      avatar_url: avatar || undefined,
      status: currentUser.status === 'idle' || currentUser.status === 'dnd' ? currentUser.status : 'online',
      muted,
    } satisfies VoicePresenceMeta);

    void channel.send({ type: 'broadcast', event: 'microphone_state', payload: { userId: currentUser.id, muted } });
  }, [isMicrophoneEnabled, currentUser.id]);

  const participantUser = (participant?: Participant, presence?: VoicePresenceParticipant, explicitId?: string): User => {
    const id = explicitId || presence?.user_id || participant?.identity || '';
    const profile = profilesById[id];

    const visibleName = firstVisibleLabel(
      profile?.username,
      profile?.full_name,
      id === currentUser.id ? currentUser.name : undefined
    ) || 'Membro Koaline';

    const visibleHandle = firstVisibleLabel(
      profile?.username,
      id === currentUser.id ? currentUser.handle : undefined
    ) || 'koaline';

    const avatar = profile?.avatar_url || (id === currentUser.id ? currentUser.avatar : '') || '';

    return {
      ...currentUser,
      id,
      name: visibleName,
      handle: visibleHandle,
      avatar,
      status: 'online',
      statusKnown: true,
    };
  };

  const liveById = new Map(liveParticipants.map((participant) => [participant.identity, participant]));

  // Reúne todos os participantes da Presence e do LiveKit em tempo real
  const allParticipantIds = new Set<string>();
  presenceParticipants.forEach((p) => { if (p.user_id) allParticipantIds.add(p.user_id); });
  liveParticipants.forEach((p) => { if (p.identity) allParticipantIds.add(p.identity); });
  if (currentUser.id) allParticipantIds.add(currentUser.id);

  const participantIds = Array.from(allParticipantIds).filter(Boolean).sort();
  const participantIdsKey = participantIds.join('|');
  useEffect(() => {
    if (!activeCall || !participantIds.length) return;
    void fetchProfiles(participantIds);
  }, [activeCall?.channelId, participantIdsKey]);

  const participants = participantIds.map((id) => {
    const presence = presenceParticipants.find((p) => p.user_id === id);
    const participant = liveById.get(id);
    const user = participantUser(participant, presence, id);
    const isMuted = broadcastMuteStates[id] ?? presence?.muted ?? (participant ? !participant.isMicrophoneEnabled : false);
    return {
      id,
      participant,
      user,
      isMuted,
    };
  });

  useEffect(() => {
    if (!activeCall || room.name !== activeCall.channelId) return;
    syncVoiceParticipants(activeCall.channelId, participants.map((row) => row.user));
  }, [activeCall?.channelId, participantSignature, presenceParticipants, profilesById, broadcastMuteStates, room.name]);

  const [controlsVisible, setControlsVisible] = useState(true);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
  const [soundboardOpen, setSoundboardOpen] = useState(false);
  const [mySounds, setMySounds] = useState<SoundDraft[]>([]);
  const [soundAnimation, setSoundAnimation] = useState<{ id: string; nonce: number } | null>(null);
  const soundAnimationNonce = useRef(0);
  const [contextUser, setContextUser] = useState<{ id: string; name: string; handle: string; avatar: string } | null>(null);
  const [remoteVolumes, setRemoteVolumes] = useState<Record<string, number>>({});
  const [locallyMuted, setLocallyMuted] = useState<Record<string, boolean>>({});
  const [kickTarget, setKickTarget] = useState<{ id: string; name: string } | null>(null);

  const currentCommunity = communities.find((item) => item.id === currentCommunityId) || communities[0];
  const callCommunity = communities.find((item) => item.channels.some((channel) => channel.id === activeCall?.channelId));
  const soundCommunityId = activeCall?.channelId.startsWith('dm-call-') ? '' : callCommunity?.id || currentCommunityId;
  const mayKick = !!currentCommunity && canModerateCommunity(currentCommunity.id, currentUser, currentCommunity.ownerId || currentCommunity.creatorId);

  const latestLeaveCallRef = useRef(leaveCall);
  const latestToastRef = useRef(addToast);
  useEffect(() => { latestLeaveCallRef.current = leaveCall; latestToastRef.current = addToast; }, [leaveCall, addToast]);

  useEffect(() => {
    if (!activeCall || liveParticipants.length !== 1 || liveParticipants[0]?.identity !== localParticipant.identity || connectionState !== ConnectionState.Connected) return;
    const channelId = activeCall.channelId;
    const idleTimer = window.setTimeout(() => {
      if (connectionState !== ConnectionState.Connected) return;
      void audioManager.play('leave_call');
      latestLeaveCallRef.current(channelId, true);
      void room.disconnect();
      latestToastRef.current('Call encerrada', 'Você foi desconectado da call por ficar sozinho por muito tempo.', 'warning');
    }, 300_000);
    return () => window.clearTimeout(idleTimer);
  }, [activeCall?.channelId, liveParticipants.length, connectionState, room, localParticipant.identity]);

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload)) as { type?: string };
        if (data.type === 'koaline:call-kick') {
          if (activeCall) leaveCall(activeCall.channelId, true);
          void room.disconnect();
          addToast('Removido da call', 'Você foi removido da call pelo administrador.', 'warning');
        }
      } catch { /* Ignora eventos de dados externos */ }
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, activeCall?.channelId]);

  useEffect(() => {
    const muteRemoteForMe = (event: Event) => {
      const userId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
      if (userId) setLocallyMuted((previous) => ({ ...previous, [userId]: true }));
    };
    window.addEventListener('koaline:mute-user-local', muteRemoteForMe);
    return () => window.removeEventListener('koaline:mute-user-local', muteRemoteForMe);
  }, []);

  useEffect(() => {
    if (!contextUser) return;
    try {
      const saved = localStorage.getItem(`koaline:volume_${contextUser.id}`);
      if (saved !== null) setRemoteVolumes((prev) => ({ ...prev, [contextUser.id]: Number(saved) }));
    } catch { /* Volume padrão */ }
  }, [contextUser?.id]);

  const saveRemoteVolume = (id: string, volume: number) => {
    setRemoteVolumes((prev) => ({ ...prev, [id]: volume }));
    try { localStorage.setItem(`koaline:volume_${id}`, String(volume)); } catch { /* Volume na sessão */ }
  };

  // Disparo do Soundboard para tocar no próprio navegador e broadcast para todos
  const playSoundInCall = async (sound: SoundDraft) => {
    soundAnimationNonce.current += 1;
    setSoundAnimation({ id: sound.id, nonce: soundAnimationNonce.current });

    // Toca no próprio navegador imediatamente
    try {
      const audio = new Audio(sound.url);
      audio.play().catch(() => audioManager.playCustom(sound.url));
    } catch {
      audioManager.playCustom(sound.url);
    }

    // Dispara Supabase Broadcast para todos na sala
    try {
      const channel = presenceChannelRef.current;
      if (!channel) throw new Error('A conexão de presença da sala ainda não está pronta.');
      const result = await channel.send({
        type: 'broadcast',
        event: 'play_sound',
        payload: { url: sound.url, audioUrl: sound.url, soundId: sound.id, emoji: sound.emoji },
      });
      if (result !== 'ok') throw new Error('O Supabase não confirmou o envio do som para a sala.');
    } catch (reason) {
      addToast('Não foi possível tocar na call', reason instanceof Error ? reason.message : 'Tente novamente.', 'warning');
    }
  };

  const kickParticipant = async () => {
    if (!kickTarget || !mayKick) return;
    try {
      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'koaline:call-kick' })), {
        reliable: true,
        destinationIdentities: [kickTarget.id]
      });
      addToast('Participante removido', `${kickTarget.name} foi expulso da call.`, 'success');
    } catch {
      addToast('Falha ao expulsar', 'Não foi possível enviar o comando ao participante.', 'warning');
    }
    setKickTarget(null);
    setContextUser(null);
  };

  const screenVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!soundCommunityId) { setMySounds([]); return; }
    let mounted = true;
    const loadSounds = () => {
      void getGroupSounds(soundCommunityId).then((saved) => {
        if (mounted) setMySounds(saved);
      }).catch(() => {
        if (mounted) setMySounds([]);
      });
    };
    const handleGroupSoundsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ communityId?: string; sounds?: SoundDraft[] }>).detail;
      if (detail?.communityId === soundCommunityId && Array.isArray(detail.sounds)) setMySounds(detail.sounds);
    };
    const handleStorage = () => loadSounds();
    loadSounds();
    window.addEventListener('koaline:community-sounds-updated', handleGroupSoundsUpdated);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('koaline:community-sounds-updated', handleGroupSoundsUpdated);
      window.removeEventListener('storage', handleStorage);
      mounted = false;
    };
  }, [soundCommunityId]);

  useEffect(() => {
    if (screenVideoRef.current) screenVideoRef.current.srcObject = activeCall?.screenStream || null;
  }, [activeCall?.screenStream, activeCall?.isWatchingScreen]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const handleMove = () => {
      setControlsVisible(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setControlsVisible(false);
      }, 3500);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchstart', handleMove);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchstart', handleMove);
    };
  }, []);

  if (!activeCall) return null;

  const currentComm = communities.find((c) => c.id === currentCommunityId) || communities[0];
  const voiceChannels = currentComm?.channels?.filter((c) => c.type === 'voice') || [];

  const pCount = participants.length;
  let gridColsClass = 'grid-cols-1 md:grid-cols-2';
  if (pCount === 1) gridColsClass = 'grid-cols-1 max-w-md';
  else if (pCount === 2) gridColsClass = 'grid-cols-1 md:grid-cols-2 max-w-2xl';
  else if (pCount >= 3 && pCount <= 4) gridColsClass = 'grid-cols-2 max-w-3xl';
  else if (pCount >= 5) gridColsClass = 'grid-cols-2 lg:grid-cols-3 max-w-5xl';

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between p-6 bg-slate-950 overflow-hidden select-none animate-in fade-in duration-300">
      <RemoteAudioTracks volumes={remoteVolumes} muted={locallyMuted} />
      {/* Top Bar: Channel Switcher */}
      <div className="relative z-20 flex items-center gap-3">
        <div className="relative">
          <button
            onClick={() => setShowChannelDropdown(!showChannelDropdown)}
            className="flex items-center gap-2 px-4 py-2 rounded-nest-pill bg-slate-900 border border-slate-700 shadow-xl hover:border-indigo-500/50 transition-all text-xs font-semibold text-white"
          >
            <Volume2 className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span>{activeCall.channelName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showChannelDropdown && (
            <div className="absolute top-full left-0 mt-2 w-56 p-2 rounded-nest-sm bg-slate-900 border border-slate-700 shadow-2xl z-30 animate-in fade-in zoom-in-95">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                Trocar de Sala
              </div>
              {voiceChannels.map((vc) => (
                <button
                  key={vc.id}
                  onClick={() => {
                    switchCallChannel(vc);
                    setShowChannelDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-nest-sm text-left text-xs ${
                    vc.id === activeCall.channelId
                      ? 'bg-indigo-600/20 text-indigo-300 font-bold'
                      : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  <span className="truncate">{vc.name}</span>
                  <span className="text-[10px] text-slate-400">
                    {vc.connectedUsers?.length || 0} online
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={toggleMinimizeCall}
          title="Minimizar chamada"
          className="p-2 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white shadow-md transition-colors"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>

      {activeCall.isScreenSharing && (
        <div className="absolute right-6 top-20 z-30 flex items-center gap-3 rounded-xl border border-sky-500/40 bg-slate-900 px-4 py-3 text-white shadow-2xl">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500"/>
          <div>
            <p className="text-xs font-semibold">Você está transmitindo</p>
            <p className="text-[10px] text-slate-400">Áudio da transmissão disponível apenas com LiveKit integrado</p>
          </div>
          <button onClick={toggleScreenShare} className="rounded-lg bg-rose-600 px-3 py-2 text-[11px] font-semibold hover:bg-rose-500">
            Parar Transmissão
          </button>
        </div>
      )}

      {activeCall.isScreenSharing && !activeCall.isWatchingScreen && (
        <button onClick={watchScreen} className="absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs text-white shadow-xl hover:border-sky-500">
          <span className="font-semibold">{currentUser.name || 'Usuário'} está transmitindo.</span> <span className="text-sky-300">Assistir</span>
        </button>
      )}

      {remoteScreenStream && sharingUserId && (
        <div className="absolute right-6 top-20 z-30 h-36 w-60 overflow-hidden rounded-xl border border-sky-400/70 bg-slate-950 shadow-2xl ring-1 ring-sky-400/20">
          <video ref={previewVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 backdrop-blur-[2px]">
            <button onClick={() => setIsWatchingRemoteScreen(true)} className="flex items-center gap-2 rounded-full border border-sky-300/40 bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-sky-950/40 transition hover:scale-105 hover:bg-sky-500">
              <Play className="h-4 w-4 fill-current" /> Assistir transmissão
            </button>
          </div>
          <span className="absolute left-2 top-2 rounded bg-slate-950/80 px-2 py-1 text-[10px] text-white">{participants.find((p) => p.id === sharingUserId)?.user.name || 'Membro Koaline'} transmitindo</span>
        </div>
      )}

      {isWatchingRemoteScreen && remoteScreenStream && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <button onClick={() => setIsWatchingRemoteScreen(false)} aria-label="Fechar transmissão" className="absolute right-5 top-5 z-10 rounded-full border border-white/20 bg-slate-900/90 p-3 text-white hover:bg-slate-700"><X className="h-5 w-5" /></button>
          <video ref={modalVideoRef} autoPlay muted playsInline className="max-h-full max-w-full rounded-xl object-contain" />
        </div>
      )}

      {/* Center Participants Grid */}
      {activeCall.isWatchingScreen && activeCall.screenStream ? (
        <div className="relative my-4 flex min-h-0 w-full max-w-5xl flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border border-sky-500/40 bg-black shadow-2xl">
          <video ref={screenVideoRef} autoPlay playsInline className="h-full max-h-full w-full object-contain" />
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button onClick={() => screenVideoRef.current?.requestFullscreen?.()} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800">
              <Maximize2 className="mr-1 inline h-3.5 w-3.5"/>Tela Cheia
            </button>
            <button onClick={stopWatchingScreen} className="rounded-lg bg-slate-900 px-3 py-2 text-xs text-white hover:bg-slate-800">
              Sair da transmissão
            </button>
          </div>
          <p className="absolute left-4 top-4 rounded-lg bg-slate-900 px-3 py-2 text-[10px] text-slate-300">Áudio da transmissão disponível apenas com LiveKit integrado</p>
        </div>
      ) : (
        <div className="flex-1 w-full flex items-center justify-center py-6 overflow-y-auto">
          {participants.length === 0 ? (
            <EmptyState type="voice-empty" />
          ) : (
            <div className={`grid ${gridColsClass} gap-6 w-full justify-items-center items-center`}>
              {participants.map((p) => (
                <ParticipantTile
                  key={p.id}
                  participant={p.participant}
                  user={p.user}
                  isMuted={p.isMuted || !!locallyMuted[p.user.id]}
                  isSharingScreen={p.id === sharingUserId}
                  onOpen={() => setContextUser(p.user)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeCall.isScreenSharing && (
        <div className="absolute bottom-24 left-6 z-20 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-[10px] text-slate-300">
          <span>Assistindo:</span>
          {(activeCall.screenViewers || []).length ? (
            (activeCall.screenViewers || []).map((viewer) => (
              <button key={viewer.id} onClick={() => openUserProfile(viewer)} title={viewer.name}>
                <img src={viewer.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(viewer.name)}`} alt={viewer.name} className="h-6 w-6 rounded-full object-cover"/>
              </button>
            ))
          ) : (
            <span className="text-slate-500">ninguém ainda</span>
          )}
        </div>
      )}

      {/* Floating Bottom Control Bar */}
      <div
        className={`relative z-20 flex items-center gap-3 px-5 py-3 rounded-nest-pill bg-slate-900 border border-slate-700 shadow-2xl transition-all duration-300 ${
          controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'
        }`}
      >
        <button
          onClick={async () => {
            try {
              await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled, MICROPHONE_CAPTURE_OPTIONS);
            } catch (error) {
              addToast('Microfone não autorizado', error instanceof Error ? error.message : 'Permita o acesso ao microfone para falar na chamada.', 'warning');
            }
          }}
          title={isMicrophoneEnabled ? 'Silenciar' : 'Ativar microfone'}
          className={`p-3 rounded-full transition-all active:scale-95 ${
            !isMicrophoneEnabled
              ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
              : 'bg-slate-800 hover:bg-slate-700 text-indigo-400'
          }`}
        >
          {!isMicrophoneEnabled ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleCamera}
          title={activeCall.isCameraOn ? 'Desligar câmera' : 'Ligar câmera'}
          className={`p-3 rounded-full transition-all active:scale-95 ${
            activeCall.isCameraOn
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          {activeCall.isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleDeafen}
          title={activeCall.isDeafened ? 'Ativar áudio da sala' : 'Mutar Sala'}
          aria-label={activeCall.isDeafened ? 'Ativar áudio da sala' : 'Mutar Sala'}
          aria-pressed={activeCall.isDeafened}
          className={`p-3 rounded-full transition-all active:scale-95 ${activeCall.isDeafened ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
        >
          {activeCall.isDeafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        <button
          onClick={toggleScreenShare}
          title={activeCall.isScreenSharing ? 'Parar tela' : 'Compartilhar tela'}
          className={`p-3 rounded-full transition-all active:scale-95 ${
            activeCall.isScreenSharing
              ? 'bg-sky-500 text-white shadow-md'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
        >
          <Monitor className="w-5 h-5" />
        </button>

        <button
          onClick={toggleMinimizeCall}
          title="Minimizar para Call Dock"
          className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
        >
          <Minimize2 className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setSoundboardOpen((open) => !open)}
          title="Meus Sons"
          aria-label="Abrir Soundboard"
          aria-expanded={soundboardOpen}
          className="p-3 rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <Music className="w-5 h-5" />
        </button>

        <button
          onClick={() => {
            if (activeCall) leaveCall(activeCall.channelId);
            void room.disconnect();
          }}
          title="Sair da sala"
          className="p-3 px-5 rounded-nest-pill bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs shadow-md transition-all active:scale-95 flex items-center gap-2"
        >
          <PhoneOff className="w-4 h-4" />
          <span>Sair</span>
        </button>
      </div>

      {soundboardOpen && (
        <div className="absolute bottom-24 left-1/2 z-40 w-72 -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white shadow-2xl" role="dialog" aria-label="Sons do grupo">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Sons do grupo</h2>
            <button type="button" onClick={() => setSoundboardOpen(false)} className="text-xs text-slate-400 hover:text-white">
              Fechar
            </button>
          </div>
          {mySounds.length ? (
            <div className="grid grid-cols-2 gap-2">
              {mySounds.map((sound) => (
                <div key={sound.id || sound.url} className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => void playSoundInCall(sound)}
                    className="flex w-full items-center justify-center gap-1.5 truncate rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white hover:border-cyan-500"
                    title={sound.name}
                  >
                    <span>{sound.emoji || '🔊'}</span>
                    <span className="truncate">{sound.name}</span>
                  </button>
                  {soundAnimation?.id === sound.id && (
                    <span key={soundAnimation.nonce} className="soundboard-float-emoji" aria-hidden="true">
                      {sound.emoji || '🔊'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-slate-400">
              {soundCommunityId ? 'Este grupo ainda não tem sons. Eles podem ser adicionados em Configurações do grupo › Áudios.' : 'Sons de grupo não estão disponíveis em chamadas diretas.'}
            </p>
          )}
        </div>
      )}

      {contextUser && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setContextUser(null); }}>
          <section className="w-full max-w-xs rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white shadow-2xl" role="dialog" aria-modal="true" aria-label={`Opções de ${contextUser.name}`}>
            <div className="mb-4 flex items-center gap-3">
              {contextUser.avatar ? (
                <img src={contextUser.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-700 font-bold">{contextUser.name.slice(0, 1)}</span>
              )}
              <div>
                <strong className="block text-sm">{contextUser.name}</strong>
                <span className="text-xs text-slate-400">@{contextUser.handle}</span>
              </div>
              <button type="button" onClick={() => setContextUser(null)} className="ml-auto text-slate-400">×</button>
            </div>
            <label className="mb-4 block text-xs text-slate-300">
              Volume individual: {Math.round((remoteVolumes[contextUser.id] ?? 1) * 100)}%
              <input type="range" min="0" max="100" value={Math.round((remoteVolumes[contextUser.id] ?? 1) * 100)} onChange={(event) => saveRemoteVolume(contextUser.id, Number(event.target.value) / 100)} className="mt-2 w-full accent-sky-500" />
            </label>
            <button type="button" onClick={() => setLocallyMuted((prev) => ({ ...prev, [contextUser.id]: !prev[contextUser.id] }))} className="mb-2 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-left text-xs hover:bg-slate-700">
              {locallyMuted[contextUser.id] ? 'Ativar áudio para mim' : 'Silenciar para mim'}
            </button>
            {mayKick && contextUser.id !== currentUser.id && (
              <button type="button" onClick={() => setKickTarget({ id: contextUser.id, name: contextUser.name })} className="w-full rounded-xl bg-rose-600 px-3 py-2 text-left text-xs font-semibold text-white hover:bg-rose-500">
                Expulsar da Call
              </button>
            )}
          </section>
        </div>
      )}

      {kickTarget && (
        <div className="absolute inset-0 z-[60] grid place-items-center bg-black/60 p-4">
          <section className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white shadow-2xl" role="alertdialog" aria-modal="true">
            <h2 className="mb-2 font-semibold">Expulsar participante?</h2>
            <p className="mb-4 text-sm text-slate-300">Tem certeza que deseja expulsar @{kickTarget.name}?</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setKickTarget(null)} className="rounded-xl border border-slate-600 px-3 py-2 text-sm">
                Cancelar
              </button>
              <button type="button" onClick={() => void kickParticipant()} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white">
                Expulsar
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

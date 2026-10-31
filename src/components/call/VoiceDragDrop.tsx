import React, { useState } from 'react';
import { User } from '../../types';


const USER_MIME = 'application/x-koaline-user-id';

export const DraggableUserCard: React.FC<{
  user: User;
  permission: boolean;
  onOpen: () => void;
}> = ({ user, permission, onOpen }) => {
  const [dragging, setDragging] = useState(false);
  const userId = (user.id || '').trim();
  const avatar = (user.avatar || '').trim();
  const fallbackLabel = (user.name || '').trim() || (user.handle || '').trim().replace(/^@/, '');
  const displayName = fallbackLabel || 'Participante';
  if (!userId || (!avatar && !fallbackLabel)) return null;
  return (
    <button
      type="button"
      draggable={permission}
      onClick={(event) => { event.stopPropagation(); onOpen(); }}
      onDragStart={(event) => {
        if (!permission) { event.preventDefault(); return; }
        event.dataTransfer.setData(USER_MIME, userId);
        event.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      aria-label={permission ? `Arraste ${displayName} para outra chamada` : `Perfil de ${displayName}`}
      title={permission ? `${displayName} — arraste para outra chamada` : displayName}
      className={`voice-user-drag-card ${permission ? 'is-draggable' : ''} ${dragging ? 'is-dragging' : ''}`}
    >
      {avatar ? <img src={avatar} alt="" className="h-5 w-5 rounded-full object-cover" /> : <span className="voice-user-initial">{fallbackLabel.charAt(0).toUpperCase()}</span>}
    </button>
  );
};

export const DropZoneCall: React.FC<{
  callId: string;
  permission: boolean;
  onMove: (userId: string, callId: string) => void;
  children: React.ReactNode;
}> = ({ callId, permission, onMove, children }) => {
  const [isOver, setIsOver] = useState(false);
  return (
    <div
      className={`drop-zone-call ${isOver && permission ? 'is-drop-target' : ''}`}
      onDragOver={(event) => { if (!permission) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setIsOver(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOver(false); }}
      onDrop={(event) => {
        event.preventDefault();
        setIsOver(false);
        if (!permission) return;
        const userId = event.dataTransfer.getData(USER_MIME);
        if (userId) onMove(userId, callId);
      }}
    >{children}</div>
  );
};


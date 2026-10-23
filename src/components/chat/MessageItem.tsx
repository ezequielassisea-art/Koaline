import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Message } from '../../types';
import {
  Smile,
  Reply,
  Edit2,
  Trash2,
  Pin,
  Check,
  X,
  FileText
} from 'lucide-react';

interface MessageItemProps {
  message: Message;
  onReply: (message: Message) => void;
}

const COMMON_EMOJIS = ['🔥', '⚡', '✨', '🚀', '👍', '❤️', '👀'];

export const MessageItem: React.FC<MessageItemProps> = ({ message, onReply }) => {
  const {
    currentUser,
    openUserProfile,
    openUserMenu,
    editMessage,
    deleteMessage,
    toggleReaction,
    togglePinMessage
  } = useApp();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isSelf = message.senderId === currentUser.id;

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      editMessage(message.id, editContent);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  if (message.isDeleted) {
    return (
      <div className="px-4 py-1.5 text-xs italic text-slate-500 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
        <span>Mensagem apagada</span>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex gap-3 px-4 py-2 hover:bg-slate-800/40 transition-colors rounded-nest-sm my-0.5 ${
        message.pinned ? 'bg-indigo-950/20 border-l-2 border-indigo-500' : ''
      }`}
    >
      {/* Sender Avatar */}
      <div className="flex-shrink-0 mt-0.5">
        <img
          src={message.sender.avatar}
          alt={message.sender.name}
          onClick={() => openUserProfile(message.sender)}
          className="w-9 h-9 rounded-full object-cover cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all ring-1 ring-border shadow-sm"
        />
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0">
        {/* Reply Quote Header */}
        {message.replyTo && (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 bg-slate-900/60 px-2 py-0.5 rounded-nest-pill w-fit border border-border">
            <Reply className="w-3 h-3 text-indigo-400 rotate-180" />
            <span className="font-semibold text-slate-200">
              {message.replyTo.senderName}
            </span>
            <span className="truncate max-w-xs">{message.replyTo.content}</span>
          </div>
        )}

        {/* Sender Name, Time, Badges */}
        <div className="flex items-center gap-2">
          <span
            onClick={(e) => openUserMenu(message.sender, e)}
            className="text-xs font-title font-bold text-slate-100 hover:text-indigo-400 hover:underline cursor-pointer transition-colors"
          >
            {message.sender.name}
          </span>

          <span className="text-[10px] text-slate-500">{message.timestamp}</span>

          {message.edited && (
            <span className="text-[10px] text-slate-500 italic">(editada)</span>
          )}

          {message.pinned && (
            <span className="text-[10px] text-indigo-400 flex items-center gap-0.5">
              <Pin className="w-2.5 h-2.5" /> Fixada
            </span>
          )}
        </div>

        {/* Content or Edit Input */}
        {isEditing ? (
          <div className="mt-1.5 space-y-2">
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              autoFocus
              className="w-full px-3 py-1.5 text-xs rounded-nest-sm bg-slate-900 border border-indigo-500 focus:outline-none text-slate-100"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-1 px-3 py-1 rounded-nest-pill bg-indigo-600 text-white text-[11px] font-medium hover:bg-indigo-500"
              >
                <Check className="w-3 h-3" /> Salvar
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1 px-3 py-1 rounded-nest-pill bg-slate-800 text-slate-400 text-[11px] font-medium hover:text-slate-200"
              >
                <X className="w-3 h-3" /> Cancelar
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-200 leading-relaxed mt-0.5 break-words">
            {message.content}
          </p>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded-nest-sm bg-slate-900 border border-border text-xs"
              >
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="font-medium text-slate-200">{att.name}</span>
                <span className="text-[10px] text-slate-500">{att.size || '1.2 MB'}</span>
              </div>
            ))}
          </div>
        )}

        {/* Inline Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="mt-2 p-2 rounded-nest-sm bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs animate-in fade-in">
            <span className="text-rose-400 font-medium">Deseja apagar esta mensagem?</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  deleteMessage(message.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-2.5 py-1 rounded-nest-pill bg-rose-600 text-white font-medium text-[11px] hover:bg-rose-500"
              >
                Apagar
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 rounded-nest-pill text-slate-400 hover:text-slate-200 text-[11px]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Reactions List */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {message.reactions.map((rx) => {
              const hasReacted = rx.users.includes(currentUser.id);
              return (
                <button
                  key={rx.emoji}
                  onClick={() => toggleReaction(message.id, rx.emoji)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-nest-pill text-[11px] font-medium border transition-all active:scale-95 ${
                    hasReacted
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 font-semibold'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span>{rx.emoji}</span>
                  <span>{rx.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Hover Actions Bar */}
      <div className="absolute right-4 -top-3 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 shadow-xl rounded-nest-pill p-1 flex items-center gap-1 z-10">
        {/* Quick Emojis */}
        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Adicionar reação"
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>

          {showEmojiPicker && (
            <div className="absolute right-0 bottom-full mb-1 flex items-center gap-1 p-1 rounded-nest-pill bg-slate-900 border border-slate-700 shadow-xl z-20">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    toggleReaction(message.id, emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1 hover:scale-125 transition-transform text-sm"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reply */}
        <button
          onClick={() => onReply(message)}
          title="Responder"
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
        >
          <Reply className="w-3.5 h-3.5" />
        </button>

        {/* Pin */}
        <button
          onClick={() => togglePinMessage(message.id)}
          title={message.pinned ? 'Desafixar mensagem' : 'Fixar mensagem'}
          className={`p-1.5 rounded-full hover:bg-slate-800 transition-colors ${
            message.pinned ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Pin className="w-3.5 h-3.5" />
        </button>

        {/* Edit */}
        {isSelf && (
          <button
            onClick={() => setIsEditing(true)}
            title="Editar mensagem"
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-sky-400 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Delete */}
        {isSelf && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            title="Apagar mensagem"
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

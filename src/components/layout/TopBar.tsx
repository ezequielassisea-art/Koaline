import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { KoalineWordmark } from '../brand/KoalaMascot';
import {
  Search,
  Bell,
  ChevronDown,
  Moon,
  Sun,
  User,
  Settings,
  LogOut,
  Sparkles,
  MessageSquare
} from 'lucide-react';

export const TopBar: React.FC = () => {
  const {
    currentUser,
    communities,
    currentCommunityId,
    setCurrentCommunityId,
    isDirectMessages,
    setIsDirectMessages,
    theme,
    updateTheme,
    openUserProfile,
    setIsThemeCustomizerOpen,
    setIsProfileEditorOpen,
    setIsLoggedIn,
    addToast
  } = useApp();

  const [isCommunityDropdownOpen, setIsCommunityDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const commDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const activeCommunity = communities.find((c) => c.id === currentCommunityId) || communities[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (commDropdownRef.current && !commDropdownRef.current.contains(e.target as Node)) {
        setIsCommunityDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDarkMode = () => {
    if (theme.preset === 'light') {
      updateTheme({ preset: 'dark' });
      addToast('Tema Escuro', 'Modo escuro ativado.');
    } else {
      updateTheme({ preset: 'light' });
      addToast('Tema Claro', 'Modo claro ativado.');
    }
  };

  return (
    <header className="h-16 px-4 md:px-6 bg-slate-900/90 backdrop-blur-md border-b border-border flex items-center justify-between sticky top-0 z-30 transition-colors">
      {/* LEFT: Wordmark + Community Selector Pill */}
      <div className="flex items-center gap-3 sm:gap-4">
        <KoalineWordmark size="md" />

        <div className="h-6 w-px bg-slate-800 hidden sm:block" />

        {/* Community Selector Pill */}
        <div className="relative" ref={commDropdownRef}>
          <button
            onClick={() => setIsCommunityDropdownOpen(!isCommunityDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-nest-pill bg-slate-800 hover:bg-slate-700/80 border border-border text-sm font-medium transition-all active:scale-95 max-w-[200px]"
          >
            {isDirectMessages ? <MessageSquare className="w-4 h-4 text-indigo-300" /> : activeCommunity?.icon?.startsWith('data:image/') ? <img src={activeCommunity.icon} alt="" className="w-5 h-5 rounded-md object-cover" /> : <span className="text-base">{activeCommunity?.icon || '◇'}</span>}
            <span className="truncate text-slate-100 font-semibold text-xs sm:text-sm">
              {isDirectMessages ? 'Mensagens Diretas' : activeCommunity?.name || 'Comunidades'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          </button>

          {isCommunityDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 p-2 rounded-nest-sm bg-slate-900 border border-slate-700 shadow-2xl z-40 animate-in fade-in zoom-in-95">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                Servidores & Espaços
              </div>

              {communities.map((comm) => (
                <button
                  key={comm.id}
                  onClick={() => {
                    setCurrentCommunityId(comm.id);
                    setIsDirectMessages(false);
                    setIsCommunityDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-nest-sm text-left text-xs font-medium transition-colors ${
                    !isDirectMessages && comm.id === currentCommunityId
                      ? 'bg-indigo-600/20 text-indigo-400 font-semibold'
                      : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  {comm.icon.startsWith('data:image/') ? <img src={comm.icon} alt="" className="w-7 h-7 rounded-md object-cover" /> : <span className="text-lg">{comm.icon}</span>}
                  <div className="truncate flex-1">
                    <div className="truncate">{comm.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{comm.membersCount} membros</div>
                  </div>
                </button>
              ))}

              <div className="my-1.5 border-t border-slate-800" />

              <button
                onClick={() => {
                  setIsDirectMessages(true);
                  setIsCommunityDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-nest-sm text-left text-xs font-medium transition-colors ${
                  isDirectMessages
                    ? 'bg-sky-500/20 text-sky-400 font-semibold'
                    : 'hover:bg-slate-800 text-slate-200'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-sky-400" />
                <div className="truncate flex-1">
                  <div>Mensagens Diretas</div>
                  <div className="text-[10px] text-slate-400">Conversas privadas</div>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CENTER: Global Search Bar */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-nest-pill bg-slate-950 border transition-all ${
            isSearchFocused
              ? 'border-indigo-500 ring-1 ring-indigo-500/40 bg-slate-900'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar canais, mensagens ou pessoas... (Ctrl + K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
            className="w-full bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
          />
          <kbd className="hidden lg:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* RIGHT: Notifications, Theme Toggle, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={toggleDarkMode}
          title="Alternar tema"
          className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          {theme.preset === 'light' ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400" />
          )}
        </button>

        <button
          onClick={() => addToast('Notificações', 'Você está em dia com todas as mensagens.')}
          title="Notificações"
          className="relative p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-slate-900" />
        </button>

        {/* User Pill */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 pl-2 rounded-nest-pill bg-slate-800 hover:bg-slate-700/80 border border-border transition-all"
          >
            <div className="relative">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover ring-1 ring-border"
              />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-slate-900 ${
                  currentUser.status === 'online'
                    ? 'bg-emerald-500'
                    : currentUser.status === 'idle'
                    ? 'bg-amber-500'
                    : currentUser.status === 'dnd'
                    ? 'bg-rose-500'
                    : 'bg-zinc-400'
                }`}
              />
            </div>
            <span className="text-xs font-semibold text-slate-200 hidden sm:inline max-w-[100px] truncate">
              {currentUser.name.split(' ')[0]}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 mr-1" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-64 p-2 rounded-nest-sm bg-slate-900 border border-slate-700 shadow-2xl z-40 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3 p-2.5 rounded-nest-sm bg-slate-950/60 mb-2">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="truncate">
                  <div className="text-xs font-bold text-white truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] text-slate-400">@{currentUser.handle}</div>
                  <div className="text-[10px] text-indigo-400 font-medium flex items-center gap-1 mt-0.5">
                    <span>{currentUser.customStatus?.emoji}</span>
                    <span className="truncate">{currentUser.customStatus?.text}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  openUserProfile(currentUser);
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-nest-sm text-left text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <User className="w-4 h-4 text-indigo-400" />
                <span>Ver Meu Perfil</span>
              </button>

              <button
                onClick={() => {
                  setIsProfileEditorOpen(true);
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-nest-sm text-left text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Editar Perfil & Status</span>
              </button>

              <button
                onClick={() => {
                  setIsThemeCustomizerOpen(true);
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-nest-sm text-left text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-sky-400" />
                <span>Personalizar Tema</span>
              </button>

              <div className="my-1 border-t border-slate-800" />

              <button
                onClick={() => {
                  setIsLoggedIn(false);
                  setIsUserMenuOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-nest-sm text-left text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

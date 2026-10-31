# Ativar o Orbit

1. No Supabase, abra o SQL Editor e execute `supabase/migrations/20261030120000_orbit.sql`.
2. Em Authentication > Providers, habilite Anonymous Sign-Ins. O Orbit usa uma sessão anônima persistente para identificar o navegador enquanto o Koaline ainda não autentica pelo Supabase.
3. Em Cloudinary, crie um upload preset `unsigned` e limite-o a imagens/vídeos e às transformações/tamanhos desejados.
4. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLOUDINARY_CLOUD_NAME` e `VITE_CLOUDINARY_UPLOAD_PRESET`.
5. Reinicie o servidor Vite. A mídia é enviada diretamente ao Cloudinary; no Supabase ficam somente `media_url` e `media_type`.

A migration cria `communities`, `community_members`, `posts`, `post_likes` e `orbit_profiles`, além de índices, políticas RLS e RPCs para criação/entrada atômicas em comunidades.

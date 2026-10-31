# Ativar o Orbit

1. No Supabase, abra o SQL Editor e execute `supabase/migrations/20261030120000_orbit.sql` e depois `supabase/migrations/20261031100000_orbit_interactions.sql`.
2. Em Authentication > Providers, habilite Anonymous Sign-Ins. O Orbit usa uma sessão anônima persistente para identificar o navegador enquanto o Koaline ainda não autentica pelo Supabase.
3. Opcional: em Cloudinary, crie um upload preset `unsigned` e limite-o a imagens/vídeos e às transformações/tamanhos desejados.
4. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Para usar Cloudinary, preencha também `VITE_CLOUDINARY_CLOUD_NAME` e `VITE_CLOUDINARY_UPLOAD_PRESET`.
5. Reinicie o servidor Vite. Com Cloudinary configurado, as mídias são enviadas para lá. Sem ele, a mídia é anexada como data URL base64 em `media_url` no Supabase, o que aumenta o tamanho do registro.

A primeira migration cria `communities`, `community_members`, `posts`, `post_likes` e `orbit_profiles`, além de índices, políticas RLS e RPCs para criação/entrada atômicas em comunidades. A segunda adiciona `post_comments`, `post_poll_options` e `post_poll_votes`, com políticas RLS e atualizações em tempo real para comentários e votos.

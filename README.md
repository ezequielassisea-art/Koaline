# Koaline

Interface em React 19, TypeScript, Vite e Tailwind CSS. A autenticação atual usa sessão local para demonstração; o projeto ainda não tem backend de contas ou OAuth.

## Rodar localmente

```bash
npm install
npm run dev
```

Para conferir a compilação, rode `npm run build`.

## Conectar autenticação e upload

- Substitua os handlers locais de `src/components/auth/AuthOnboardingModal.tsx` pelos endpoints do provedor de autenticação. As sugestões de usuário e a disponibilidade hoje consultam apenas identidades guardadas no navegador; senhas não são persistidas.
- Conecte os botões Google e Apple a OAuth no backend. Eles mostram um aviso enquanto esses provedores não estiverem configurados.
- O avatar e a capa são recortados e comprimidos no navegador em `src/components/common/ImageCropperModal.tsx`. Para produção, envie o resultado ao serviço de arquivos pelo fluxo de onboarding em `src/components/profile/ProfileOnboarding.tsx` e salve as URLs retornadas no perfil. Hoje os dados de perfil ficam em `localStorage`.

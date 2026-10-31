# Koaline production checklist

## Build and hosting

- Build command: `npm run build`
- Output directory: `dist`
- `vercel.json` rewrites application routes to `index.html` for SPA navigation and refreshes.
- Orbit and VoiceRoom are lazy-loaded. Orbit post media and avatars use lazy loading; videos use `preload="none"`.

## Environment variables

Copy `.env.example` to `.env.local` for local development and configure the same variables in the hosting provider:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (publishable key only; database access must remain protected by RLS)
- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_UPLOAD_PRESET` (unsigned preset; restrict allowed formats, size, and transformations in Cloudinary)
- `VITE_TENOR_API_KEY` (optional client key; restrict its quota and allowed referrers in Tenor)

Never put a Supabase `service_role` key, Cloudinary API secret, or other server secret in a `VITE_` variable. Vite exposes these values to browser clients.

## Supabase and Cloudinary

1. Run `supabase/migrations/20261030120000_orbit.sql` against the production database. It enables RLS on `orbit_profiles`, `communities`, `community_members`, `posts`, and `post_likes`, and installs table policies and RPC grants.
2. Enable anonymous sign-ins in Supabase Authentication because Orbit uses an anonymous Supabase identity.
3. Set the production site URL and allowed redirect URLs in Supabase Authentication to the final HTTPS domain. Keep localhost only for development.
4. Add the final HTTPS origin to the Cloudinary upload preset's allowed origins/CORS policy and constrain the unsigned preset.

The production domain and provider dashboards are not present in this repository, so their live Auth redirect and Cloudinary CORS settings must be confirmed after the domain is selected. RLS status here is verified from the checked-in migration, not by querying a deployed Supabase project.

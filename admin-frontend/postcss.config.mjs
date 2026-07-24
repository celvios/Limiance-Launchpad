// The admin console uses plain CSS. This local config prevents the monorepo
// root Tailwind/PostCSS plugin from being loaded by Vercel.
const config = { plugins: {} };

export default config;

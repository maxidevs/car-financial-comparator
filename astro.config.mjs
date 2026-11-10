import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';

const secret = () => envField.string({ context: 'server', access: 'secret', optional: true });

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: true },
  // Confía en las cabeceras X-Forwarded-* del proxy de Coolify solo para este
  // dominio. Sin esto Astro ve la petición como http://localhost y rechaza los
  // POST de formularios (login, subida de archivos) por "cross-site".
  security: { allowedDomains: [{ hostname: 'car.bymaxi.dev', protocol: 'https' }] },
  env: { schema: { AUTH_USER: secret(), AUTH_PASSWORD: secret() } },
});

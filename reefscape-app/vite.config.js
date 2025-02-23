import { defineConfig } from 'vite';
import dns from 'node:dns';

dns.setDefaultResultOrder('verbatim');

export default defineConfig({
  server: {
    host: true, // Listen on all network interfaces
    port: 3000,
    // Allow your specific Gitpod host and any subdomain of gitpod.io
    allowedHosts: [
      '3000-team2073eag-3dreplaysys-bag5rcxpg7d.ws-us117.gitpod.io',
      '*.gitpod.io'
    ],
  },
});

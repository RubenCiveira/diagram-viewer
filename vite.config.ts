import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Puertos propios: un service worker queda registrado por origen (http://localhost:PUERTO),
 * así que compartir el 5173 con otras apps PWA hace que sus service workers intercepten
 * las peticiones de este proyecto.
 */
const DEV_PORT = 5737;
const PREVIEW_PORT = 5738;

/** Renombra el HTML final para que se pueda copiar junto a los diagramas sin pisar nada. */
const renameOutput = (fileName: string): Plugin => ({
  name: 'rename-output',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const html = bundle['index.html'];
    if (html) html.fileName = fileName;
  },
});

export default defineConfig(({ command }) => ({
  base: './',
  // En desarrollo se sirven los diagramas de ejemplo como si estuvieran junto al HTML.
  publicDir: command === 'serve' ? 'example' : false,
  // El empaquetado en un único HTML sólo tiene sentido al compilar; en desarrollo, Vite + React estándar
  plugins: [react(), ...(command === 'build' ? [viteSingleFile(), renameOutput('diagram-viewer.html')] : [])],
  // strictPort: si el puerto está ocupado, falla en vez de saltar a otro (que podría tener service workers ajenos)
  server: { port: DEV_PORT, strictPort: true },
  preview: { port: PREVIEW_PORT, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
}));

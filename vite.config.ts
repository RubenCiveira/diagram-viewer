import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from './package.json' with { type: 'json' };

/**
 * Puertos propios: un service worker queda registrado por origen (http://localhost:PUERTO),
 * así que compartir el 5173 con otras apps PWA hace que sus service workers intercepten
 * las peticiones de este proyecto.
 */
const DEV_PORT = 5737;
const PREVIEW_PORT = 5738;

/**
 * Cada versión se publica en su propia carpeta, release/<versión de package.json>, para poder
 * compartir varias a la vez. Sólo se vacía la carpeta de la versión que se compila.
 */
const OUT_DIR = `release/${pkg.version}`;

/** Renombra el HTML final para que se pueda copiar junto a los diagramas sin pisar nada. */
const renameOutput = (fileName: string): Plugin => ({
  name: 'rename-output',
  enforce: 'post',
  generateBundle(_options, bundle) {
    const html = bundle['index.html'];
    if (html) html.fileName = fileName;
  },
});

/**
 * Sólo en el build: carga ./diagram-data.js (generado con `pnpm run pack-data <carpeta>`) antes
 * que la aplicación. Abierto con doble clic, el navegador no deja leer los .json de al lado,
 * pero sí este script; si no existe, el visor pide acceso a la carpeta como siempre.
 */
const embeddedDataScript = (): Plugin => ({
  name: 'embedded-data-script',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: () => [{ tag: 'script', attrs: { src: './diagram-data.js' }, injectTo: 'head-prepend' }],
  },
});

export default defineConfig(({ command }) => ({
  base: './',
  // En desarrollo se sirven los diagramas de ejemplo como si estuvieran junto al HTML.
  publicDir: command === 'serve' ? 'example' : false,
  // El empaquetado en un único HTML sólo tiene sentido al compilar; en desarrollo, Vite + React estándar
  plugins: [
    react(),
    ...(command === 'build' ? [viteSingleFile(), embeddedDataScript(), renameOutput('diagram-viewer.html')] : []),
  ],
  // strictPort: si el puerto está ocupado, falla en vez de saltar a otro (que podría tener service workers ajenos)
  server: { port: DEV_PORT, strictPort: true },
  preview: { port: PREVIEW_PORT, strictPort: true },
  build: {
    outDir: OUT_DIR,
    // Fuera de la raíz de Vite no se vacía por defecto: sólo esta carpeta de versión
    emptyOutDir: true,
    rollupOptions: {
      // jsPDF sólo las carga bajo demanda para html() y addSvgAsImage(), que no usamos:
      // fuera del paquete, el HTML único pesa ~400 KB menos.
      external: ['html2canvas', 'dompurify', 'canvg'],
    },
  },
}));

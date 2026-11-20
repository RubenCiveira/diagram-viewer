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

/** Configuración de despliegue que el build deja junto al HTML (ver src/storage/config.ts). */
const CONFIG_FILE = 'config.js';
const CONFIG_TEMPLATE = `/**
 * Configuración de diagram-viewer.html. Se puede editar sin recompilar.
 *
 * source:  "auto"  → por HTTP si hay índice en baseUrl; si no, diagram-data.js; si no, pide la carpeta.
 *          "local" → nunca HTTP: diagram-data.js si existe; si no, pide acceso a la carpeta.
 *          "http"  → siempre por HTTP desde baseUrl (si es otro dominio, debe permitir CORS).
 * baseUrl: raíz de los diagramas, relativa a la página ("./", "datos/") o absoluta ("https://…/").
 * index:   índice de diagramas, relativo a baseUrl (o a la carpeta elegida en local).
 */
window.DIAGRAM_VIEWER_CONFIG = {
  source: "auto",
  baseUrl: "./",
  index: "index.json"
};
`;

/**
 * Sólo en el build: genera ./config.js y lo carga, junto con ./diagram-data.js (generado con
 * `pnpm run pack-data <carpeta>`), antes que la aplicación. Abierto con doble clic, el navegador
 * no deja leer los .json de al lado, pero sí estos scripts; si faltan, se usan los valores por
 * defecto y el visor pide acceso a la carpeta como siempre.
 */
const externalScripts = (): Plugin => ({
  name: 'external-scripts',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: () => [
      { tag: 'script', attrs: { src: `./${CONFIG_FILE}` }, injectTo: 'head-prepend' },
      { tag: 'script', attrs: { src: './diagram-data.js' }, injectTo: 'head-prepend' },
    ],
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: CONFIG_FILE, source: CONFIG_TEMPLATE });
  },
});

export default defineConfig(({ command }) => ({
  base: './',
  // En desarrollo se sirven los diagramas de ejemplo como si estuvieran junto al HTML.
  publicDir: command === 'serve' ? 'example' : false,
  // El empaquetado en un único HTML sólo tiene sentido al compilar; en desarrollo, Vite + React estándar
  plugins: [
    react(),
    ...(command === 'build' ? [viteSingleFile(), externalScripts(), renameOutput('diagram-viewer.html')] : []),
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

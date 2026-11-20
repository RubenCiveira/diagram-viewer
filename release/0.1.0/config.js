/**
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

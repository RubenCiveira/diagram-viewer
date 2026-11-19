import type { ResolvedAction } from '../diagram';

/**
 * Evento que se lanza antes de ejecutar una acción. Burbujea y atraviesa el shadow DOM
 * (`composed`), así que lo puede escuchar la aplicación que contiene al visor, sea en una
 * página normal o con el visor como web component:
 *
 *   el.addEventListener('diagram-viewer:action', (e) => {
 *     e.preventDefault(); // opcional: la aplicación la ejecuta a su manera
 *     console.log(e.detail.href, e.detail.values);
 *   });
 *
 * Si nadie la cancela, la acción hace lo suyo:
 * - `url`: abre `href` en `target` (por defecto `_blank`);
 * - `hash`: asigna `href` a `location.hash`; la aplicación lo atiende con `hashchange`. Si el
 *   hash ya era ese, se repite el evento `hashchange` para que la acción se ejecute igual.
 */
export const ACTION_EVENT = 'diagram-viewer:action';

export type ActionEvent = CustomEvent<ResolvedAction>;

export function runAction(action: ResolvedAction, from: EventTarget = window): void {
  const event = new CustomEvent<ResolvedAction>(ACTION_EVENT, { detail: action, bubbles: true, composed: true, cancelable: true });
  if (!from.dispatchEvent(event)) return;

  if (action.kind === 'hash') {
    const hash = action.href.startsWith('#') ? action.href : `#${action.href}`;
    if (location.hash === hash) {
      const url = location.href;
      window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL: url, newURL: url }));
    } else {
      location.hash = hash;
    }
    return;
  }

  const target = action.target || '_blank';
  if (target === '_self') location.assign(action.href);
  else window.open(action.href, target, 'noopener,noreferrer');
}

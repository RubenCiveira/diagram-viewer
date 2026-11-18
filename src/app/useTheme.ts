import React from 'react';

type Theme = 'light' | 'dark';
const KEY = 'dv-theme';

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/** Tema claro/oscuro: sigue al sistema hasta que el usuario elige uno. */
export function useTheme() {
  const media = React.useMemo(() => matchMedia('(prefers-color-scheme: dark)'), []);
  const [choice, setChoice] = React.useState<Theme | null>(stored);
  const [system, setSystem] = React.useState<Theme>(media.matches ? 'dark' : 'light');
  /** Tema forzado temporalmente (p. ej. claro mientras se captura para imprimir) */
  const [override, setOverride] = React.useState<Theme | null>(null);

  React.useEffect(() => {
    const on = () => setSystem(media.matches ? 'dark' : 'light');
    media.addEventListener('change', on);
    return () => media.removeEventListener('change', on);
  }, [media]);

  const theme = override ?? choice ?? system;
  React.useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = React.useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setChoice(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* sin almacenamiento: sólo para esta sesión */
    }
  }, [theme]);

  return { theme, toggle, setOverride };
}

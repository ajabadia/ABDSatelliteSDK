import { adjustColor, getContrastColor } from './color-utils';

export interface ThemeConfig {
  primary: string;
  secondary?: string;
  accent?: string;
  primaryDark?: string;
  accentDark?: string;
  rounded?: boolean;
  radius?: string;
  autoDarkMode?: boolean;
}

/**
 * Genera dinámicamente un bloque de código CSS con variables globales para inyección SSR.
 * Asegura total compatibilidad y consistencia estética entre modo claro y oscuro.
 */
export function generateTenantCss(theme: ThemeConfig): string {
  if (!theme || !theme.primary) return '';

  const primary = theme.primary;
  const primaryFg = getContrastColor(primary);
  const secondary = theme.secondary || '#1e293b';
  const secondaryFg = getContrastColor(secondary);
  const accent = theme.accent || primary;
  const accentFg = getContrastColor(accent);

  // Optimización automática de color para modo oscuro si no se especifican overrides manuales
  const autoDark = theme.autoDarkMode !== false;
  const primaryDark = theme.primaryDark || (autoDark ? adjustColor(primary, 25) : '#38bdf8');
  const primaryDarkFg = getContrastColor(primaryDark);
  const accentDark = theme.accentDark || (autoDark ? adjustColor(accent, 15) : '#60a5fa');
  const accentDarkFg = getContrastColor(accentDark);

  const radius = theme.rounded === false ? '0rem' : theme.radius || '0.75rem';

  return `
    :root {
      --primary: ${primary};
      --primary-foreground: ${primaryFg};
      --secondary: ${secondary};
      --secondary-foreground: ${secondaryFg};
      --accent: ${accent};
      --accent-foreground: ${accentFg};
      --sidebar-primary: ${primary};
      --sidebar-primary-foreground: ${primaryFg};
      --ring: ${primary};
      --radius: ${radius};
      --tenant-primary: ${primary}; /* Retrocompatibilidad satélite */
    }
    .dark {
      --primary: ${primaryDark};
      --primary-foreground: ${primaryDarkFg};
      --accent: ${accentDark};
      --accent-foreground: ${accentDarkFg};
      --sidebar-primary: ${primaryDark};
      --sidebar-primary-foreground: ${primaryDarkFg};
      --ring: ${primaryDark};
      --tenant-primary: ${primaryDark};
    }
    /* Estilos forzados de clases base */
    .text-primary { color: var(--primary) !important; }
    .bg-primary { background-color: var(--primary) !important; }
    .border-primary { border-color: var(--primary) !important; }
  `;
}

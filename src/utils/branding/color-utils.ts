/**
 * Utility to lighten/darken a hex color for dark mode optimization
 * Implements shift-bits hex manipulation.
 */
export function adjustColor(hex: string, percent: number): string {
  if (!hex || !hex.startsWith('#')) return hex;
  try {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    const clamp = (val: number) => (val < 255 ? (val < 0 ? 0 : val) : 255);
    
    return "#" + (
      0x1000000 + 
      clamp(R) * 0x10000 + 
      clamp(G) * 0x100 + 
      clamp(B)
    ).toString(16).slice(1);
  } catch (e) {
    return hex;
  }
}

/**
 * Utility to determine contrast color based on YIQ luma algorithm (WCAG accessible)
 */
export function getContrastColor(hexcolor: string): '#000000' | '#ffffff' {
  if (!hexcolor || !hexcolor.startsWith('#')) return '#ffffff';
  try {
    const r = parseInt(hexcolor.substring(1, 3), 16);
    const g = parseInt(hexcolor.substring(3, 5), 16);
    const b = parseInt(hexcolor.substring(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
  } catch (e) {
    return '#ffffff';
  }
}

/**
 * Utility to convert Hex color to raw HSL components separated by space (e.g. "358 83% 60%")
 * Crucial for Tailwind CSS v4 opacity scopes.
 */
export function hexToHslComponents(hex: string): string {
  if (!hex || !hex.startsWith('#')) return '';
  try {
    const r = parseInt(hex.substring(1, 3), 16) / 255;
    const g = parseInt(hex.substring(3, 5), 16) / 255;
    const b = parseInt(hex.substring(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    const hDeg = Math.round(h * 360);
    const sPct = Math.round(s * 100);
    const lPct = Math.round(l * 100);

    return `${hDeg} ${sPct}% ${lPct}%`;
  } catch (e) {
    return '';
  }
}

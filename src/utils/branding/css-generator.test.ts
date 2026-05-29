import { describe, it, expect } from 'vitest';
import { generateTenantCss, type ThemeConfig } from './css-generator';

describe('generateTenantCss', () => {
  it('should return empty string when theme is empty or missing primary color', () => {
    expect(generateTenantCss({} as unknown as ThemeConfig)).toBe('');
    expect(generateTenantCss({ secondary: '#000000' } as unknown as ThemeConfig)).toBe('');
  });

  it('should generate valid CSS variables for primary and default secondary/accent values', () => {
    const theme: ThemeConfig = {
      primary: '#38bdf8', // Light blue
    };

    const css = generateTenantCss(theme);
    
    expect(css).toContain('--primary: #38bdf8');
    expect(css).toContain('--secondary: #1e293b'); // default secondary
    expect(css).toContain('--accent: #38bdf8'); // default accent (equals primary)
    expect(css).toContain('--radius: 0.75rem'); // default radius
  });

  it('should override secondary, accent, and radius values when specified', () => {
    const theme: ThemeConfig = {
      primary: '#38bdf8',
      secondary: '#0f172a',
      accent: '#f43f5e',
      radius: '1rem',
    };

    const css = generateTenantCss(theme);

    expect(css).toContain('--primary: #38bdf8');
    expect(css).toContain('--secondary: #0f172a');
    expect(css).toContain('--accent: #f43f5e');
    expect(css).toContain('--radius: 1rem');
  });

  it('should force "--radius: 0rem" when rounded is set to false', () => {
    const theme: ThemeConfig = {
      primary: '#38bdf8',
      rounded: false,
    };

    const css = generateTenantCss(theme);

    expect(css).toContain('--radius: 0rem');
  });

  it('should generate auto-calculated dark mode colors by default', () => {
    const theme: ThemeConfig = {
      primary: '#38bdf8', // Light blue
      autoDarkMode: true,
    };

    const css = generateTenantCss(theme);

    // .dark selector rules should be defined
    expect(css).toContain('.dark {');
    expect(css).toContain('--primary:');
    expect(css).toContain('--accent:');
  });

  it('should use explicit dark mode overrides if provided', () => {
    const theme: ThemeConfig = {
      primary: '#38bdf8',
      primaryDark: '#0284c7',
      accentDark: '#1d4ed8',
    };

    const css = generateTenantCss(theme);

    expect(css).toContain('--primary: #0284c7');
    expect(css).toContain('--accent: #1d4ed8');
  });
});

import { describe, it, expect, vi } from 'vitest';
import { generateTenantCss } from './css-generator';

describe('generateTenantCss (from @ajabadia/styles)', () => {
  it('should fall back to Tech-Noir Cyan defaults if empty input is provided', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const css = generateTenantCss({});

    expect(css).toContain('--primary: hsl(189 94% 43%) !important;');
    expect(css).toContain('--secondary: hsl(217 33% 17%) !important;');
    expect(css).toContain('--radius: 0.15rem !important;');
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('should generate HSL CSS variables for a valid theme', () => {
    const css = generateTenantCss({ primary: '#38bdf8' });

    expect(css).toContain('--primary: hsl(198 93% 60%) !important;');
    expect(css).toContain('--radius: 0.75rem !important;');
  });

  it('should force "--radius: 0px" when rounded is set to false', () => {
    const css = generateTenantCss({ primary: '#38bdf8', rounded: false });

    expect(css).toContain('--radius: 0px !important;');
  });

  it('should generate dark mode colors in .dark selector', () => {
    const css = generateTenantCss({ primary: '#38bdf8' });

    expect(css).toContain('.dark {');
    expect(css).toContain('--primary: hsl(190 100% 68%) !important;');
  });
});

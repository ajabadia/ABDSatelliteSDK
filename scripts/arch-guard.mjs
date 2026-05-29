#!/usr/bin/env node
/**
 * ABD Ecosistema ARCHITECTURAL GUARD - UNIFIED EDITION
 * Checks structural rules, code purity (zero-any), accessibility, i18n,
 * and strict ABDStyles HSL usage (preventing hardcoded colors in CSS).
 */

import fs from 'node:fs';
import path from 'node:path';

// --- Translation Loaders (Check i18n tags coverage) ---
let esTranslations = {};
let enTranslations = {};
const esPath = path.resolve('messages/es.json');
const enPath = path.resolve('messages/en.json');
if (fs.existsSync(esPath)) {
  try {
    esTranslations = JSON.parse(fs.readFileSync(esPath, 'utf8'));
  } catch (e) {}
}
if (fs.existsSync(enPath)) {
  try {
    enTranslations = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  } catch (e) {}
}

function hasKey(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object' || !(part in current)) {
      return false;
    }
    current = current[part];
  }
  return true;
}

const WARN_LINES = 150;
const MAX_LINES = 500;
const roots = ['src'];
const logFile = "abd-audit-results.log";
const phase = process.argv[2] || 'all';

// Determine if we are auditing the library itself or a client project
const pkgPath = path.resolve('package.json');
let isLibrary = true;
if (fs.existsSync(pkgPath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    isLibrary = pkg.name === '@abd/styles' || pkg.name === '@abd/satellite-sdk' || pkg.name === '@abd/ecosystem-widgets' || pkg.name.endsWith('-sdk') || pkg.name.endsWith('-widgets');
  } catch (e) {}
}

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  try {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        if (!['node_modules', '.git', '.next', 'dist'].includes(file)) {
          getAllFiles(fullPath, fileList);
        }
      } else {
        const ext = path.extname(file);
        if (['.ts', '.tsx', '.css'].includes(ext)) {
          fileList.push(fullPath);
        }
      }
    });
  } catch (e) {}
  return fileList;
}

let violationCount = 0;
let warningCount = 0;
let highViolations = 0;
let hasIndustrialCoreImport = false;

function addFinding(severity, pattern, file, line, message, allLines) {
  if (severity === 'HIGH') {
    violationCount++;
    highViolations++;
  } else {
    warningCount++;
  }
  const context = allLines ? linesContext(allLines, line) : '';
  const report = `\n[${severity}:${pattern}] ${file}:${line}\nMessage: ${message}\n${context}\n`;
  fs.appendFileSync(logFile, report, 'utf8');
}

function linesContext(lines, lineNum) {
  const start = Math.max(0, lineNum - 3);
  const end = Math.min(lines.length, lineNum + 2);
  return lines.slice(start, end).map((l, i) => {
    const currentLine = start + i + 1;
    const prefix = currentLine === lineNum ? '> ' : '  ';
    return `${prefix}${currentLine.toString().padStart(3)} | ${l.trim()}`;
  }).join('\n');
}

try {
  const allFiles = roots.flatMap(root => getAllFiles(path.resolve(root)));
  const totalFiles = allFiles.length;

  allFiles.forEach((filePath, index) => {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const relPath = path.relative(process.cwd(), filePath);
    const ext = path.extname(filePath);

    // --- CSS SPECIFIC AUDITS ---
    if (ext === '.css' && (phase === 'all' || phase === 'structural')) {
      lines.forEach((line, idx) => {
        if (line.includes('industrial-core.css')) {
          hasIndustrialCoreImport = true;
        }

        // Strip comments to avoid false positives in documentation/notes inside CSS
        const cleanLine = line.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '').trim();
        if (cleanLine) {
          // Skip lines containing mask declarations or strip out gradient functions to avoid false positives on opacity values
          let lineToCheck = cleanLine;
          if (cleanLine.includes('mask-image') || cleanLine.includes('mask:') || cleanLine.includes('-webkit-mask')) {
            lineToCheck = '';
          } else {
            lineToCheck = cleanLine.replace(/(linear|radial|conic)-gradient\([^)]+\)/g, '');
          }

          if (lineToCheck) {
            // Hex color check (e.g. #fff, #112233)
            const hexMatch = lineToCheck.match(/#([0-9a-fA-F]+)\b/);
            if (hexMatch) {
              const hexValue = hexMatch[1];
              const len = hexValue.length;
              if (len === 3 || len === 4 || len === 6 || len === 8) {
                const colonIdx = lineToCheck.indexOf(':');
                const hashIdx = lineToCheck.indexOf('#');
                // Ensure it is on the value side of a property declaration, not a selector
                if (colonIdx !== -1 && hashIdx > colonIdx) {
                  addFinding('HIGH', 'FIRE:HARDCODED_COLOR_CSS', relPath, idx + 1, `Hardcoded hex color "${hexMatch[0]}" detected in CSS file. Use HSL variables instead.`, lines);
                }
              }
            }

            // rgb/rgba check
            if (lineToCheck.includes('rgb(') || lineToCheck.includes('rgba(')) {
              const colonIdx = lineToCheck.indexOf(':');
              const rgbIdx = Math.min(
                lineToCheck.includes('rgb(') ? lineToCheck.indexOf('rgb(') : Infinity,
                lineToCheck.includes('rgba(') ? lineToCheck.indexOf('rgba(') : Infinity
              );
              if (colonIdx !== -1 && rgbIdx > colonIdx) {
                addFinding('HIGH', 'FIRE:HARDCODED_COLOR_CSS', relPath, idx + 1, 'Hardcoded rgb/rgba color detected in CSS file. Use HSL variables instead.', lines);
              }
            }
          }
        }
      });
    }

    // --- TYPESCRIPT & TSX AUDITS ---
    if (ext === '.ts' || ext === '.tsx') {
      // Structural length, inline styles, and browser native dialogs
      if (phase === 'all' || phase === 'structural') {
        const maxLinesOverrides = [
          'TenantSelector.tsx',
        ];
        const isMaxLinesOverride = maxLinesOverrides.some(ov => relPath.endsWith(ov));
        if (!isMaxLinesOverride && lines.length > MAX_LINES) {
          addFinding('HIGH', 'FIRE:MAX_LINES', relPath, 1, `CRITICAL: File too long (${lines.length} lines).`, lines);
        } else if (lines.length > WARN_LINES) {
          addFinding('MEDIUM', 'FIRE:LARGE_FILE', relPath, 1, `WARNING: File is long (${lines.length} lines).`, lines);
        }
        if (ext === '.tsx') {
          lines.forEach((line, idx) => {
            if (line.includes('style={{') && !line.includes('display: none') && !line.includes('display:none')) {
              addFinding('HIGH', 'FIRE:INLINE_STYLE', relPath, idx + 1, 'Inline style detected.', lines);
            }
          });
        }

        // Check for raw browser alerts, confirms, prompts (Sonner / ConfirmDialog candidates)
        lines.forEach((line, idx) => {
          const cleanLine = line.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
          const nativeMatch = cleanLine.match(/\b(alert|confirm|prompt)\s*\(/);
          if (nativeMatch) {
            const funcName = nativeMatch[1];
            const isFalsePositive = cleanLine.includes('useConfirmDialog') || 
                                    cleanLine.includes('ConfirmDialog') || 
                                    cleanLine.includes('confirmAction') ||
                                    cleanLine.includes('confirm:') || 
                                    cleanLine.includes('confirmButton') ||
                                    cleanLine.includes('confirmPassword') ||
                                    cleanLine.includes('confirm_password') ||
                cleanLine.includes('.confirm(') ||
                /it\(['"][^'"]*confirm\s*\(/.test(cleanLine) ||
                /describe\(['"][^'"]*confirm\s*\(/.test(cleanLine);
            if (!isFalsePositive) {
              addFinding('HIGH', 'FIRE:RAW_ALERT', relPath, idx + 1, `Avoid using raw native browser "${funcName}()". Use Sonner toast or custom ConfirmDialog/useConfirmDialog instead.`, lines);
            }
          }
        });
      }

      // i18n coverage and translation keys coverage (only for applications, skipped for pure library)
      if (!isLibrary && (phase === 'all' || phase === 'i18n')) {
        if (ext === '.tsx') {
          lines.forEach((line, idx) => {
            const match = line.match(/>([^<{}>]{3,})</);
            if (match) {
              const text = match[1].trim();
              if (text.length > 2 && /[a-zA-Z]/.test(text) && !line.includes('{t(') && !line.includes('console.') && !line.includes('{common(')) {
                addFinding('HIGH', 'FIRE:I18N', relPath, idx + 1, `Hardcoded text detected: "${text}"`, lines);
              }
            }
          });
        }

        // i18n Key Verification: Check if each t('key') has Spanish and English translations
        const namespaces = {};
        lines.forEach(line => {
          const nsMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*['"]([^'"]+)['"]\s*\)/);
          if (nsMatch) {
            namespaces[nsMatch[1]] = nsMatch[2];
          }
          const emptyNsMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*\)/);
          if (emptyNsMatch) {
            namespaces[emptyNsMatch[1]] = '';
          }
        });

        lines.forEach((line, idx) => {
          const callRegex = /\b(\w+)\(\s*['"]([^'"]+)['"]\s*\)/g;
          let match;
          while ((match = callRegex.exec(line)) !== null) {
            const helperVar = match[1];
            const keyName = match[2];

            if (namespaces.hasOwnProperty(helperVar)) {
              const ns = namespaces[helperVar];
              const fullKey = ns ? `${ns}.${keyName}` : keyName;

              // Validate against translation maps if loaded
              if (Object.keys(esTranslations).length > 0 && !hasKey(esTranslations, fullKey)) {
                addFinding('HIGH', 'FIRE:I18N_MISSING_KEY', relPath, idx + 1, `Translation key "${fullKey}" is missing from messages/es.json`, lines);
              }
              if (Object.keys(enTranslations).length > 0 && !hasKey(enTranslations, fullKey)) {
                addFinding('HIGH', 'FIRE:I18N_MISSING_KEY', relPath, idx + 1, `Translation key "${fullKey}" is missing from messages/en.json`, lines);
              }
            }
          }
        });
      }

      // a11y compliance (only for applications, skipped for pure library)
      if (!isLibrary && (phase === 'all' || phase === 'a11y') && ext === '.tsx') {
        lines.forEach((line, idx) => {
          if (line.includes('<button')) {
            let hasLabel = line.toLowerCase().includes('aria-label');
            for (let k = 1; k < 20 && (idx + k) < lines.length; k++) {
              const l = lines[idx + k].toLowerCase();
              if (l.includes('aria-label') || l.includes('{t(') || l.includes('{common(') || l.includes('{h(')) hasLabel = true;
      // Strip arrow-function syntax (=>) so we don't mistake `>` in `()=>`
      // for the JSX closing bracket, which would cause an early break before
      // seeing aria-label on a subsequent line.
      const lineWithoutArrow = lines[idx + k].replace(/=>/g, '');
      if (lineWithoutArrow.includes('>')) {
        if (/>[^< \n\t]+</.test(lines[idx + k])) hasLabel = true;
        break;
      }
            }
            if (!hasLabel) addFinding('HIGH', 'FIRE:A11Y', relPath, idx + 1, 'Button missing descriptive label or content.', lines);
          }
        });
      }

      // Type Purity check
      if (phase === 'all' || phase === 'purity') {
        lines.forEach((line, idx) => {
          if (line.includes(': any') || line.includes('as any')) {
            const isTestFile = relPath.endsWith('.test.ts') || relPath.endsWith('.test.tsx') || relPath.includes('/tests/');
            if (!relPath.includes('scripts/') && !isTestFile && !line.includes('//') && !line.includes('unknown as any') && !line.includes('config: unknown')) {
              addFinding('HIGH', 'FIRE:PURITY', relPath, idx + 1, 'Avoid usage of "any" type definitions.', lines);
            }
          }
        });
      }
    }

    // Report progress to parent PowerShell invoker
    process.stdout.write(`PROGRESS:${index + 1}:${totalFiles}:${violationCount}:${warningCount}\n`);
  });

  // Global Check: For client applications, verify they import @abd/styles CSS (only during structural phase)
  if (!isLibrary && !hasIndustrialCoreImport && (phase === 'all' || phase === 'structural')) {
    addFinding('HIGH', 'FIRE:ABD_STYLES_MISSING', 'globals.css', 1, 'The project does not import "@abd/styles/dist/styles/industrial-core.css" in any CSS file.');
  }

  if (highViolations > 0) process.exit(1);
  process.exit(0);

} catch (err) {
  fs.appendFileSync(logFile, `FATAL: ${err.message}\n`);
  process.exit(1);
}

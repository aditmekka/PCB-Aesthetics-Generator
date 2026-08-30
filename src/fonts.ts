export interface FontEntry {
  /** Unique CSS font-family name (no spaces) used in the canvas. */
  family: string;
  /** Human-readable label (usually the file name). */
  label: string;
  /** Base64-encoded font data for cross-session persistence. */
  base64: string;
}

const STORAGE_KEY = 'pcb-skg-custom-fonts';

function generateFamily(): string {
  return `custom-${Date.now()}`;
}

function decodeBase64(base64: string): ArrayBuffer {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function encodeBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Load a font file, register it with the browser, and return a persistable entry. */
export async function loadFontFromFile(file: File): Promise<FontEntry> {
  const buf = await file.arrayBuffer();
  const family = generateFamily();
  const label = file.name.replace(/\.(ttf|otf|woff2?)$/i, '') || file.name;
  const fontFace = new FontFace(family, buf);
  await fontFace.load();
  document.fonts.add(fontFace);
  return { family, label, base64: encodeBase64(buf) };
}

/** Re-register a font from stored base64 data (returns false if it fails). */
export async function loadFontFromBase64(base64: string, family: string): Promise<boolean> {
  try {
    const fontFace = new FontFace(family, decodeBase64(base64));
    await fontFace.load();
    document.fonts.add(fontFace);
    return true;
  } catch {
    return false;
  }
}

export function saveFonts(fonts: FontEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fonts));
  } catch {
    // Ignore quota / availability errors; fonts just won't persist.
  }
}

export function getStoredFonts(): FontEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FontEntry[]) : [];
  } catch {
    return [];
  }
}

/**
 * One-shot WebGL capability probe. Must run in the browser: creating a
 * context on the server is impossible.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') ?? canvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

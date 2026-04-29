// Clipboard helper with graceful fallback for non-secure contexts (older browsers,
// http://, sandboxed iframes) where navigator.clipboard is unavailable.

function fallbackCopy(text: string, done: () => void) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(el);
  el.select();
  try {
    document.execCommand('copy');
    done();
  } catch {
    /* swallow — caller will time out the "copied" UI state */
  }
  document.body.removeChild(el);
}

/**
 * Copy text to the clipboard.
 * @param text  The string to copy.
 * @param onDone  Called once the copy completes (used to flip UI state).
 */
export function copyToClipboard(text: string, onDone: () => void): void {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
      .then(onDone)
      .catch(() => fallbackCopy(text, onDone));
  } else {
    fallbackCopy(text, onDone);
  }
}

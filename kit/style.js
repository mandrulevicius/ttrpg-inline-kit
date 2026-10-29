// A widget's stylesheet, added once per page. Styles live in the modules (not .css files), so a widget needs no
// stylesheet link: inline <style> is what the chat's sandbox is known to allow.
export function addStyle(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = css;
  document.head.append(s);
}

// A speaker's or a device's colour, mixed toward the chat's text colour so it reads on a light or a dark chat alike
// (dark text pulls an ink darker; light text pulls it lighter).
export const inked = (v, share = '62%') => `color-mix(in srgb,${v} ${share},var(--text-primary,#222))`;

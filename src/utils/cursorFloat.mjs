const CARD_SELECTOR = 'main .soft-card, main .bg-white.rounded-2xl.border, main section.bg-white.border, main form.bg-white.border, [data-cursor-float]';

export function installCursorFloat(doc = document, win = window) {
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = win.matchMedia('(hover: hover) and (pointer: fine)');
  let active = null;
  let frame = 0;
  let point = null;

  function reset() {
    if (!active) return;
    active.removeAttribute('data-cursor-floating');
    for (const key of ['--float-shadow-x', '--float-shadow-y', '--light-x', '--light-y']) active.style.removeProperty(key);
    active = null;
  }

  function paint() {
    frame = 0;
    if (!point || motion.matches || !pointer.matches) { reset(); return; }
    const card = point.target?.closest?.(CARD_SELECTOR);
    if (!card || !card.isConnected) { reset(); return; }
    // Hold a form steady while someone types or uses the keyboard.
    if (doc.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]') && card.contains(doc.activeElement)) { reset(); return; }
    if (active !== card) reset();
    active = card;
    card.classList.add('cursor-float-surface');
    const rect = card.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (point.x - rect.left) / (rect.width || 1)));
    const py = Math.max(0, Math.min(1, (point.y - rect.top) / (rect.height || 1)));
    // Only paint changes: transforming scroll containers changes their overflow
    // and the containing block used by sticky headers and fixed dialogs.
    card.style.setProperty('--float-shadow-x', `${((px - 0.5) * 10).toFixed(2)}px`);
    card.style.setProperty('--float-shadow-y', `${(12 + py * 6).toFixed(2)}px`);
    card.style.setProperty('--light-x', `${(px * 100).toFixed(1)}%`);
    card.style.setProperty('--light-y', `${(py * 100).toFixed(1)}%`);
    card.setAttribute('data-cursor-floating', 'true');
  }

  function move(event) {
    if (event.pointerType === 'touch' || event.buttons > 0) { leave(); return; }
    point = { target: event.target, x: event.clientX, y: event.clientY };
    if (!frame) frame = win.requestAnimationFrame(paint);
  }
  function leave() {
    point = null;
    if (frame) win.cancelAnimationFrame(frame);
    frame = 0;
    reset();
  }
  doc.addEventListener('pointermove', move, { passive: true });
  doc.addEventListener('pointerleave', leave);
  doc.addEventListener('pointercancel', leave);
  doc.addEventListener('wheel', leave, { passive: true });
  doc.addEventListener('scroll', leave, { capture: true, passive: true });
  win.addEventListener('blur', leave);
  motion.addEventListener('change', leave);
  pointer.addEventListener('change', leave);
  return () => {
    leave();
    doc.removeEventListener('pointermove', move);
    doc.removeEventListener('pointerleave', leave);
    doc.removeEventListener('pointercancel', leave);
    doc.removeEventListener('wheel', leave);
    doc.removeEventListener('scroll', leave, true);
    win.removeEventListener('blur', leave);
    motion.removeEventListener('change', leave);
    pointer.removeEventListener('change', leave);
    doc.querySelectorAll('.cursor-float-surface').forEach(card => card.classList.remove('cursor-float-surface'));
  };
}

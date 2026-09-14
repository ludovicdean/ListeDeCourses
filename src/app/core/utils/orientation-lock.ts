const PORTRAIT_LOCK = 'portrait-primary';

function tryLockPortrait(): void {
  const orientation = screen.orientation;
  if (!orientation?.lock) {
    return;
  }

  void orientation.lock(PORTRAIT_LOCK).catch(() => {
    // Ignored: lock is often unavailable in the mobile browser tab.
  });
}

/** Locks the app to portrait on supported mobile devices (especially installed PWAs). */
export function lockPortraitOrientation(): void {
  if (typeof window === 'undefined') {
    return;
  }

  tryLockPortrait();
  window.addEventListener('orientationchange', tryLockPortrait);
}

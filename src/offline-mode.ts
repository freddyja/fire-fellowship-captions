const KEY = "ff-offline-local-meeting";
const EVENT = "ff-offline-meeting";

export function isOfflineMeeting(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setOfflineMeeting(value: boolean): void {
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    /* private mode / blocked storage */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}

export function subscribeOfflineMeeting(cb: (value: boolean) => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) cb(isOfflineMeeting());
  };
  const onLocal = (event: Event) => {
    cb(Boolean((event as CustomEvent<boolean>).detail));
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onLocal);
  };
}

export function paintOfflineToggle(btn: HTMLButtonElement): void {
  const on = isOfflineMeeting();
  btn.classList.toggle("active", on);
  btn.setAttribute("aria-pressed", String(on));
}

export function bindOfflineModeToggle(
  btn: HTMLButtonElement,
  extras?: { banner?: HTMLElement | null; onChange?: (on: boolean) => void },
): () => void {
  const paint = () => {
    const on = isOfflineMeeting();
    paintOfflineToggle(btn);
    if (extras?.banner) extras.banner.hidden = !on;
    extras?.onChange?.(on);
  };
  const onClick = () => {
    setOfflineMeeting(!isOfflineMeeting());
  };
  btn.addEventListener("click", onClick);
  const unsub = subscribeOfflineMeeting(paint);
  paint();
  return () => {
    btn.removeEventListener("click", onClick);
    unsub();
  };
}

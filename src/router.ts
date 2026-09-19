export type View = "home" | "phone" | "tv";

export type Route = {
  view: View;
  room: string;
};

export function readRoute(): Route {
  const params = new URLSearchParams(location.search);
  const view = params.get("view");
  const room = (params.get("room") || "").trim().toUpperCase();
  if ((view === "phone" || view === "tv") && room) {
    return { view, room };
  }
  return { view: "home", room };
}

export function goto(view: View, room = ""): void {
  const url = new URL(location.href);
  if (view === "home") {
    url.search = "";
  } else {
    url.search = new URLSearchParams({ view, room }).toString();
  }
  history.pushState({ view, room }, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function tvUrl(room: string): string {
  const url = new URL(location.href);
  url.search = new URLSearchParams({ view: "tv", room }).toString();
  return url.toString();
}

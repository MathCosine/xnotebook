import { useSyncExternalStore } from "react";

// Hash routes so the static build works on GitHub Pages without rewrites:
//   #/                 → home (last notebook, or welcome)
//   #/n/<id>           → notebook, all topics
//   #/n/<id>/<tab>     → tab is a topic id, "loose" or "exam"
export type Route = { name: "home" } | { name: "notebook"; id: string; tab: string };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts[0] === "n" && parts[1]) return { name: "notebook", id: parts[1], tab: parts[2] ?? "all" };
  return { name: "home" };
}

let current = parse(location.hash);
const listeners = new Set<() => void>();
window.addEventListener("hashchange", () => {
  current = parse(location.hash);
  listeners.forEach((l) => l());
});

export function useRoute(): Route {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

export function notebookHref(id: string, tab = "all") {
  return tab === "all" ? `#/n/${encodeURIComponent(id)}` : `#/n/${encodeURIComponent(id)}/${encodeURIComponent(tab)}`;
}

export function go(href: string, replace = false) {
  if (replace) {
    history.replaceState(null, "", href);
    current = parse(href);
    listeners.forEach((l) => l());
  } else {
    location.hash = href;
  }
}

import { useEffect, useState } from "react";
import { DeskArt, Logo, SvgDefs } from "./components/Art";
import { AuthScreen, RecoveryDialog } from "./components/AuthScreen";
import { NotebookView } from "./components/NotebookView";
import { SearchPalette } from "./components/SearchPalette";
import { Settings } from "./components/Settings";
import { Shelf } from "./components/Shelf";
import { Toasts } from "./components/Toasts";
import { Welcome } from "./components/Welcome";
import { go, notebookHref, useRoute } from "./lib/route";
import { boot, setPrefs, useApp } from "./lib/store";

export function App() {
  const app = useApp();
  const route = useRoute();
  const [settings, setSettings] = useState(false);
  const [search, setSearch] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);

  useEffect(() => {
    void boot();
  }, []);

  // Theme lives on <html> so the CSS variables switch everywhere.
  useEffect(() => {
    const root = document.documentElement;
    if (app.prefs.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = app.prefs.theme;
    const bg = getComputedStyle(root).getPropertyValue("--desk").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  }, [app.prefs.theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const notebooks = app.data.notebooks;
  const current = route.name === "notebook" ? notebooks.find((n) => n.id === route.id) : undefined;

  // Home → reopen the last notebook. A notebook that no longer exists → home.
  useEffect(() => {
    if (app.phase !== "ready") return;
    if (route.name === "home" && notebooks.length) {
      const last = notebooks.find((n) => n.id === app.prefs.lastNotebookId) ?? notebooks[notebooks.length - 1];
      go(notebookHref(last.id), true);
    } else if (route.name === "notebook" && !current && notebooks.length) {
      go("#/", true);
    }
  }, [app.phase, route, notebooks, current, app.prefs.lastNotebookId]);

  useEffect(() => {
    if (current && current.id !== app.prefs.lastNotebookId) setPrefs({ lastNotebookId: current.id });
    setDrawer(false);
  }, [current, route, app.prefs.lastNotebookId]);

  useEffect(() => {
    if (!flashId) return;
    const t = setTimeout(() => setFlashId(null), 1800);
    return () => clearTimeout(t);
  }, [flashId]);

  if (app.phase === "booting")
    return (
      <div className="boot">
        <SvgDefs />
        <Logo size={56} />
      </div>
    );

  if (app.phase === "signed-out")
    return (
      <>
        <SvgDefs />
        <AuthScreen />
        <Toasts />
      </>
    );

  return (
    <div className="app" data-drawer={drawer ? "open" : "closed"}>
      <SvgDefs />
      <Shelf activeId={current?.id ?? null} onSearch={() => setSearch(true)} onSettings={() => setSettings(true)} />
      <div className="drawer-scrim" onClick={() => setDrawer(false)} />
      <main className="main">
        {current ? (
          <NotebookView
            key={current.id}
            notebook={current}
            tab={route.name === "notebook" ? route.tab : "all"}
            flashId={flashId}
            onOpenSettings={() => setSettings(true)}
            onOpenDrawer={() => setDrawer(true)}
          />
        ) : notebooks.length === 0 ? (
          <Welcome onOpenDrawer={() => setDrawer(true)} />
        ) : (
          <div className="boot">
            <DeskArt />
          </div>
        )}
      </main>
      {settings && <Settings onClose={() => setSettings(false)} />}
      {search && <SearchPalette onClose={() => setSearch(false)} onPick={(n) => setFlashId(n.id)} />}
      {app.recovering && <RecoveryDialog />}
      <Toasts />
    </div>
  );
}

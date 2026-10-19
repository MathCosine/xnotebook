import { useEffect, useState } from "react";
import { claudeModels } from "../lib/ai";
import { APP_NAME } from "../lib/brand";
import { download } from "../lib/exporter";
import { cloudConfigured } from "../lib/supabase";
import {
  connectPuter,
  disconnectPuter,
  goToSignIn,
  importLocalIntoAccount,
  localOnlyData,
  setPrefs,
  setSmartFiling,
  signOut,
  useApp,
} from "../lib/store";
import { toast } from "../lib/toasts";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

export function Settings({ onClose }: { onClose: () => void }) {
  const { prefs, puter, scope, data } = useApp();
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localCount = scope.kind === "cloud" ? localOnlyData().notebooks.length : 0;

  useEffect(() => {
    if (puter.state === "signed-in") void claudeModels().then(setModels);
  }, [puter.state]);

  const haiku = models.filter((m) => m.includes("haiku"));
  const sonnet = models.filter((m) => m.includes("sonnet") || m.includes("opus"));

  return (
    <Dialog title="Settings" onClose={onClose}>
      <section className="setting">
        <h3>Look</h3>
        <div className="segmented" role="group" aria-label="Theme">
          {(
            [
              ["system", "Match device"],
              ["paper", "Paper"],
              ["chalk", "Chalkboard"],
            ] as const
          ).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={prefs.theme === value} onClick={() => setPrefs({ theme: value })}>
              {value === "paper" && <Icon name="sun" size={15} />}
              {value === "chalk" && <Icon name="moon" size={15} />}
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="setting">
        <h3>
          <Icon name="file" size={19} /> Smart filing
        </h3>
        <p>
          Claude files every bit, tidies the wording and typesets math in LaTeX. Haiku does it live while you type; every so often Sonnet reads back
          over new bits, fixes anything misfiled and pencils in a note if a fact looks off.
        </p>
        {puter.state === "signed-in" ? (
          <>
            <div className="setting-row">
              <span>
                Connected to Puter as <b>{puter.username}</b>
                <small>AI usage comes out of your Puter account's free monthly allowance.</small>
              </span>
              <button type="button" className="btn-quiet" onClick={() => void disconnectPuter()}>
                Disconnect
              </button>
            </div>
            <Toggle label="Smart filing" checked={prefs.smartFiling} onChange={setSmartFiling} hint="Off → the on-device sorter does the filing." />
            <Toggle label="Tidy wording & typeset math" checked={prefs.rewrite} onChange={(v) => setPrefs({ rewrite: v })} hint="What you typed is always kept — tap “tidied” on a bit to see it." />
            <Toggle label="Let Sonnet review on its own" checked={prefs.autoReview} onChange={(v) => setPrefs({ autoReview: v })} hint="After ~8 quiet minutes or a dozen new bits. You can always hit Review." />
            <div className="model-grid">
              <label className="field">
                Live filing
                <select className="input" value={prefs.aiFast} onChange={(e) => setPrefs({ aiFast: e.target.value })}>
                  <option value="auto">Newest Haiku</option>
                  {haiku.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Review pass
                <select className="input" value={prefs.aiSmart} onChange={(e) => setPrefs({ aiSmart: e.target.value })}>
                  <option value="auto">Newest Sonnet</option>
                  {sonnet.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        ) : (
          <>
            <div className="note-box">
              Runs through <b>Puter</b>: you sign in with a free Puter account and the AI usage comes out of its monthly allowance — no API key,
              nothing to pay. Without it, a small on-device sorter still files bits by matching words.
            </div>
            {error && <div className="form-error">{error}</div>}
            <div>
              <button
                type="button"
                className="btn btn-accent"
                disabled={busy || puter.state === "checking"}
                onClick={async () => {
                  setBusy(true);
                  setError(await connectPuter());
                  setBusy(false);
                }}
              >
                <Icon name="key" size={17} /> {busy ? "Waiting for Puter…" : "Connect Puter"}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="setting">
        <h3>
          <Icon name={scope.kind === "cloud" ? "cloud" : "device"} size={19} /> Sync
        </h3>
        {scope.kind === "cloud" ? (
          <>
            <div className="setting-row">
              <span>
                Signed in as <b>{scope.email}</b>
                <small>Notebooks sync to your Supabase project and work offline.</small>
              </span>
              <button type="button" className="btn-quiet" onClick={() => void signOut()}>
                <Icon name="logout" size={16} /> Sign out
              </button>
            </div>
            {localCount > 0 && (
              <div className="setting-row">
                <span>
                  {localCount} notebook{localCount === 1 ? " is" : "s are"} saved only on this device.
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    const n = importLocalIntoAccount();
                    toast({ message: `Moved ${n} notebook${n === 1 ? "" : "s"} into your account.` });
                  }}
                >
                  Move into account
                </button>
              </div>
            )}
          </>
        ) : cloudConfigured ? (
          <div className="setting-row">
            <span>
              Notes are saved in this browser only.
              <small>Sign in to keep them in sync across your phone and laptop.</small>
            </span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                onClose();
                goToSignIn();
              }}
            >
              Sign in
            </button>
          </div>
        ) : (
          <p>
            Notes are saved in this browser only. To sync between devices, connect a free Supabase project — the README walks through it in about
            ten minutes.
          </p>
        )}
      </section>

      <section className="setting">
        <h3>
          <Icon name="download" size={19} /> Backup
        </h3>
        <div className="setting-row">
          <span>
            Everything as one JSON file.
            <small>Each notebook can also be exported as Markdown from its ⋯ menu.</small>
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => download(`${APP_NAME}-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json")}
          >
            Download
          </button>
        </div>
      </section>

      <section className="setting">
        <h3>Shortcuts</h3>
        <div className="setting-row">
          <span>Jump to the jot box</span>
          <span>
            <kbd>/</kbd> or <kbd>n</kbd>
          </span>
        </div>
        <div className="setting-row">
          <span>Search everything</span>
          <kbd>⌘K</kbd>
        </div>
        <div className="setting-row">
          <span>Route a bit to a topic</span>
          <code>#topic the rest</code>
        </div>
      </section>
    </Dialog>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <div className="setting-row">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />
    </div>
  );
}

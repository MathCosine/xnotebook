import { useState } from "react";
import { sendPasswordReset, setNewPassword, signIn, signUp, keepOnThisDevice, dismissRecovery } from "../lib/store";
import { DeskArt, Logo } from "./Art";
import { Icon } from "./Icon";
import { Wordmark } from "./Shelf";

type Mode = "signin" | "signup" | "reset";

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setOk(null);
    if (mode === "signin") {
      setError(await signIn(email, password));
    } else if (mode === "signup") {
      const r = await signUp(email, password);
      if (r === "confirm") setOk("Check your inbox to confirm your email, then sign in.");
      else setError(r);
    } else {
      const r = await sendPasswordReset(email);
      if (r) setError(r);
      else setOk("If that email has an account, a reset link is on its way.");
    }
    setBusy(false);
  };

  const switchTo = (m: Mode) => {
    setMode(m);
    setError(null);
    setOk(null);
  };

  return (
    <div className="auth">
      <div className="auth-brand">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo size={40} />
          <Wordmark />
        </div>
        <h1>
          Spill it in class. Find it <em>filed</em> later.
        </h1>
        <p>A notebook you can throw half-sentences at. Every bit gets tidied up and filed under the right topic, so your notes are ready to study from.</p>
        <DeskArt />
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <h2>{mode === "signin" ? "Welcome back" : mode === "signup" ? "Make an account" : "Reset password"}</h2>
          <p className="sub">
            {mode === "reset" ? "We'll email you a link to set a new one." : "Your notebooks sync between your phone and laptop."}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="field">
              Email
              <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {mode !== "reset" && (
              <label className="field">
                Password
                <input
                  className="input"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  minLength={mode === "signup" ? 8 : undefined}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            {error && <div className="form-error" role="alert">{error}</div>}
            {ok && <div className="form-ok" role="status">{ok}</div>}
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "One sec…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </button>
          </form>
          <div className="auth-switch">
            {mode === "signin" ? (
              <>
                <button type="button" className="link" onClick={() => switchTo("signup")}>
                  New here? Make an account
                </button>
                <button type="button" className="link" onClick={() => switchTo("reset")}>
                  Forgot?
                </button>
              </>
            ) : (
              <button type="button" className="link" onClick={() => switchTo("signin")}>
                ← Back to sign in
              </button>
            )}
          </div>
          <div className="or">or</div>
          <button type="button" className="btn" style={{ width: "100%" }} onClick={keepOnThisDevice}>
            <Icon name="device" size={18} /> Keep notes on this device only
          </button>
        </div>
      </div>
    </div>
  );
}

/** Shown after following a password-reset link. */
export function RecoveryDialog() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
      <div className="sheet" style={{ width: "min(420px, 100%)" }}>
        <div className="sheet-head">
          <h2 id="recovery-title">Set a new password</h2>
          <button type="button" className="icon-btn" onClick={dismissRecovery} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <form
          className="sheet-body"
          style={{ display: "grid", gap: 14, paddingTop: 18 }}
          onSubmit={async (e) => {
            e.preventDefault();
            setError(await setNewPassword(password));
          }}
        >
          <label className="field">
            New password
            <input className="input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="btn btn-primary">
            Save password
          </button>
        </form>
      </div>
    </div>
  );
}

import { useState } from "react";
import { go, notebookHref } from "../lib/route";
import { createNotebook } from "../lib/store";
import { DeskArt, StepArt } from "./Art";
import { Icon } from "./Icon";

export function Welcome({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  const [name, setName] = useState("");
  return (
    <>
      <div className="topbar">
        <button type="button" className="icon-btn" onClick={onOpenDrawer} aria-label="Open notebooks">
          <Icon name="menu" />
        </button>
      </div>
      <div className="welcome">
        <div className="welcome-inner">
          <DeskArt />
          <h1>
            Spill it in class. Find it <em>filed</em> later.
          </h1>
          <p className="lede">Start a notebook for a class. Type whatever you hear, and it gets sorted into topics as you go.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const nb = createNotebook(name || "My first notebook");
              go(notebookHref(nb.id));
            }}
          >
            <input className="input" placeholder="e.g. Biology 101" value={name} onChange={(e) => setName(e.target.value)} aria-label="Notebook name" autoFocus />
            <button type="submit" className="btn btn-accent">
              Start notebook
            </button>
          </form>
          <div className="steps">
            <div className="step">
              <StepArt step={1} />
              <b>Jot it</b>
              <span>One line at a time, typos welcome.</span>
            </div>
            <div className="step">
              <StepArt step={2} />
              <b>It files itself</b>
              <span>Every bit lands under the right tab.</span>
            </div>
            <div className="step">
              <StepArt step={3} />
              <b>Study by topic</b>
              <span>Test hints are highlighted for you.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

import React from "react";
import { Mark, useEscape } from "./ui";

export interface ActivityEntry {
  time: string;
  text: string;
  type: "info" | "success" | "error";
}

interface ActivityDrawerProps {
  entries: ActivityEntry[];
  onClose: () => void;
  onClear: () => void;
}

export const ActivityDrawer: React.FC<ActivityDrawerProps> = ({ entries, onClose, onClear }) => {
  useEscape(onClose);
  return (
  <aside className="activity" aria-label="Activity log">
    <div className="sheet-head">
      <div>
        <h3 className="sub">Activity</h3>
        <div className="tiny faint">Wallet, contract and agent events from this session</div>
      </div>
      <div className="row">
        <button className="linkbtn" onClick={onClear} disabled={entries.length === 0}>
          Clear
        </button>
        <button className="close-x" onClick={onClose} aria-label="Close activity log" />
      </div>
    </div>
    {entries.length === 0 ? (
      <p className="sheet-body small muted">Nothing yet. Actions you take will be listed here, newest first.</p>
    ) : (
      <ol className="activity-list" aria-live="polite">
        {entries.map((e, i) => (
          <li key={`${e.time}-${i}`}>
            <Mark
              kind={e.type === "success" ? "fill" : e.type === "error" ? "x" : "empty"}
              tone={e.type === "success" ? "ok" : e.type === "error" ? "bad" : "faint"}
            />
            <span className="activity-time">{e.time}</span>
            <span style={{ overflowWrap: "anywhere" }}>{e.text}</span>
          </li>
        ))}
      </ol>
    )}
  </aside>
  );
};

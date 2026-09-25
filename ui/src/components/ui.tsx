import React from "react";

/**
 * The Pactra seal: two corner brackets, one per party, offset so their
 * bounds overlap. The escrow square sits only in the overlap.
 */
export const Brandmark: React.FC<{ size?: number; title?: string }> = ({ size = 28, title = "Pactra" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title}>
    <path
      d="M3.2 15V3.2H15"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="2.4"
      strokeLinecap="square"
      strokeLinejoin="miter"
    />
    <path
      d="M9 20.8h11.8V9"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="2.4"
      strokeLinecap="square"
      strokeLinejoin="miter"
    />
    <rect x="10" y="10" width="4" height="4" fill="var(--seal)" />
  </svg>
);

/** Large annotated version of the mark used to explain the model on the start page. */
export const SealDiagram: React.FC = () => (
  <svg viewBox="0 0 316 250" role="img" aria-label="Diagram: the creator's bound and the agent's bound overlap; escrowed funds exist only in the overlap.">
    <path d="M30 150V30h120" fill="none" stroke="var(--ink)" strokeWidth="6" strokeLinecap="square" />
    <path d="M90 210h120V90" fill="none" stroke="var(--ink)" strokeWidth="6" strokeLinecap="square" />
    <rect x="90" y="90" width="60" height="60" fill="none" stroke="var(--rule)" strokeWidth="1" strokeDasharray="3 3" />
    <rect x="104" y="104" width="32" height="32" fill="var(--seal)" />
    <g fontFamily="Outfit, system-ui, sans-serif" fontSize="12" fill="var(--ink-2)">
      <text x="30" y="20">Creator sets the budget</text>
      <text x="210" y="232" textAnchor="end">Agent gets bounded rights</text>
      <line x1="136" y1="120" x2="222" y2="120" stroke="var(--ink-3)" strokeWidth="1" />
      <text x="226" y="116" fill="var(--seal)" fontWeight="600">Escrow</text>
      <text x="226" y="131">in the overlap</text>
    </g>
  </svg>
);

export type Tone = "ok" | "warn" | "bad" | "seal" | "ink" | "plain";

export const Tag: React.FC<{ tone?: Tone; children: React.ReactNode; title?: string; id?: string }> = ({
  tone = "plain",
  children,
  title,
  id,
}) => (
  <span id={id} className={`tag${tone === "plain" ? "" : ` tag--${tone}`}`} title={title}>
    {children}
  </span>
);

/** Square status glyph. fill = done, half = in progress, empty = pending, x = failed. */
export const Mark: React.FC<{ kind?: "fill" | "half" | "empty" | "x"; tone?: "ok" | "warn" | "bad" | "seal" | "faint" }> = ({
  kind = "fill",
  tone,
}) => (
  <span
    aria-hidden="true"
    className={`mark${kind === "empty" ? "" : ` mark--${kind}`}${tone ? ` c-${tone}` : ""}`}
  />
);

export const shortHash = (value: string | null | undefined, head = 10, tail = 8): string => {
  if (!value) return "";
  return value.length > head + tail + 3 ? `${value.slice(0, head)}...${value.slice(-tail)}` : value;
};

export const Hash: React.FC<{ value?: string | null; empty?: string; head?: number; tail?: number }> = ({
  value,
  empty = "None",
  head,
  tail,
}) =>
  // An all-zero value is the ledger's placeholder for "not written yet", not a real hash.
  value && !/^(0x)?0+$/i.test(value) ? (
    <span className="hash" title={value}>
      {shortHash(value, head, tail)}
    </span>
  ) : (
    <span className="faint">{empty}</span>
  );

export const Skeleton: React.FC<{ lines?: number; widths?: string[] }> = ({ lines = 3, widths }) => (
  <div aria-busy="true" aria-label="Loading">
    {Array.from({ length: lines }).map((_, i) => (
      <span key={i} className="skel" style={{ width: widths?.[i] ?? `${[92, 76, 84, 60, 70][i % 5]}%` }} />
    ))}
  </div>
);

export const PageHead: React.FC<{
  num: string;
  section: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  aside?: React.ReactNode;
}> = ({ num, section, title, lede, aside }) => (
  <header className="page-head">
    <div>
      <div className="eyebrow">
        <span className="num">{num}</span>
        <span>{section}</span>
      </div>
      <h1 className="title">{title}</h1>
      {lede && <p className="lede">{lede}</p>}
    </div>
    {aside && <div>{aside}</div>}
  </header>
);

export const Dialog: React.FC<{
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  labelId: string;
}> = ({ title, onClose, children, footer, labelId }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  useEscape(onClose);

  // Move focus into the dialog on open and hand it back to whatever opened it on close.
  React.useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not(.close-x)");
    (first ?? ref.current)?.focus();
    return () => opener?.focus?.();
  }, []);

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={labelId} ref={ref} tabIndex={-1}>
        <div className="dialog-head">
          <div id={labelId}>{title}</div>
          <button className="close-x" onClick={onClose} aria-label="Close" />
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
};

export type LogFn = (text: string, type?: "info" | "success" | "error") => void;

/**
 * Runs one async action at a time. The ref blocks a second call synchronously,
 * so a fast double click cannot slip in before React re-renders the disabled state.
 */
export function useSingleFlight() {
  const inFlight = React.useRef(false);
  const [busy, setBusy] = React.useState(false);
  const [settled, setSettled] = React.useState(0);

  // Release only after the render that follows completion has committed, so a click
  // landing in between cannot run a handler that still sees pre-action state.
  React.useEffect(() => {
    inFlight.current = false;
  }, [settled]);

  const run = React.useCallback(async (fn: () => Promise<unknown> | unknown): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      setSettled((n) => n + 1);
    }
  }, []);
  return { busy, run };
}

/** Parses a whole-number DUST amount from an input; returns null for empty, fractional or negative values. */
export const parseAmount = (raw: string): number | null => {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export const FieldError: React.FC<{ id: string; children?: React.ReactNode }> = ({ id, children }) =>
  children ? (
    <p id={id} className="hint c-bad" role="alert">
      {children}
    </p>
  ) : null;

/** Calls onEscape when the Escape key is pressed while the component is mounted. */
export function useEscape(onEscape: () => void) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);
}

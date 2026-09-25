import React from "react";
import { WalletState } from "../services/wallet";
import { EscrowContractData } from "../services/escrowService";
import { Mark, SealDiagram, Tag, Hash } from "./ui";

interface StartPageProps {
  wallet: WalletState;
  escrowState: EscrowContractData;
  isLive: boolean;
  isIndexerLive: boolean;
  isIndexerChecked: boolean;
  onConnect: () => void;
}

const LIFECYCLE = [
  ["Created", "The creator writes the task and a hard budget ceiling."],
  ["Funded", "Tokens move into the contract. The agent never holds them."],
  ["Active", "The agent proves it is the authorised party and starts work."],
  ["Delivered", "The agent posts a hash of its result as evidence."],
  ["Settled", "The creator pays out from escrow, or takes a refund."],
];

const DIRECTORY: { id: string; num: string; name: string; desc: string }[] = [
  { id: "walkthrough", num: "02", name: "Walkthrough", desc: "Nine guided steps through a real compute purchase. No wallet needed." },
  { id: "escrow", num: "03", name: "Escrow", desc: "Deploy the contract and run each circuit as creator or agent." },
  { id: "agent", num: "04", name: "Agent authority", desc: "The policy an agent works under, its planner, and a purchase you can break on purpose." },
  { id: "services", num: "05", name: "Services", desc: "Providers an agent is allowed to buy from, with prices and how each is verified." },
  { id: "disputes", num: "06", name: "Disputes", desc: "Open a case and have a 2 of 3 arbitration board decide it." },
  { id: "privacy", num: "07", name: "Privacy model", desc: "Type private inputs and watch only their hashes reach the ledger." },
  { id: "system", num: "08", name: "System", desc: "Network health, usage counts, and tester feedback." },
];

export const StartPage: React.FC<StartPageProps> = ({
  wallet,
  escrowState,
  isLive,
  isIndexerLive,
  isIndexerChecked,
  onConnect,
}) => {
  const walletReady = wallet.status === "CONNECTED";
  const onPreprod = wallet.networkId === "preprod";

  return (
    <div className="page">
      <section className="hero">
        <div>
          <div className="eyebrow">
            <span className="num">01</span>
            <span>Agent commerce on Midnight</span>
          </div>
          <h1 className="display">Give agents a budget. Keep your keys.</h1>
          <p className="lede">
            Pactra lets an AI agent buy compute, storage and API calls on your behalf. You set a ceiling and the services
            it may use. The money waits in a zero-knowledge escrow and is released only when the work checks out.
          </p>
          <div className="hero-actions">
            <a className="btn btn--seal" href="#/walkthrough">
              Take the walkthrough
            </a>
            <a className="btn" href="#/escrow">
              Open the escrow console
            </a>
          </div>
          <p className="small faint" style={{ marginTop: 14 }}>
            The walkthrough takes about three minutes and runs without a wallet.
          </p>
        </div>
        <figure className="mark-diagram">
          <SealDiagram />
          <figcaption>
            The Pactra mark is the model. Each party has a bound. Funds can only sit where both bounds overlap.
          </figcaption>
        </figure>
      </section>

      <section className="section-block">
        <div className="section-row">
          <h2 className="section">Your setup</h2>
          <span className="small muted">
            {isLive ? "Everything you do is signed and sent to Preprod." : "Until all four are ready, actions run in simulation."}
          </span>
        </div>
        <ol className="setup-list">
          <li>
            <span className="setup-n">1</span>
            <div>
              <div className="row">
                <Mark kind={walletReady ? "fill" : "empty"} tone={walletReady ? "ok" : "faint"} />
                <strong style={{ fontWeight: 600 }}>Lace wallet</strong>
              </div>
              <div className="small muted">
                {walletReady ? (
                  <>
                    Connected as <Hash value={wallet.coinPublicKey} head={8} tail={6} />
                  </>
                ) : (
                  <>
                    Install the{" "}
                    <a href="https://www.lace.io/" target="_blank" rel="noreferrer">
                      Lace
                    </a>{" "}
                    extension, switch it to Midnight Preprod, then connect.
                  </>
                )}
              </div>
            </div>
            {walletReady ? (
              <Tag tone="ok">Connected</Tag>
            ) : (
              <button
                className="btn btn--sm btn--primary"
                onClick={onConnect}
                disabled={wallet.status === "CONNECTING" || wallet.status === "DETECTING"}
              >
                {wallet.status === "CONNECTING"
                  ? "Approve in Lace..."
                  : wallet.status === "DETECTING"
                  ? "Looking for Lace..."
                  : wallet.error
                  ? "Try again"
                  : "Connect"}
              </button>
            )}
          </li>
          <li>
            <span className="setup-n">2</span>
            <div>
              <div className="row">
                <Mark kind={onPreprod ? "fill" : "empty"} tone={onPreprod ? "ok" : "warn"} />
                <strong style={{ fontWeight: 600 }}>Network</strong>
              </div>
              <div className="small muted">
                {onPreprod ? "Targeting Midnight Preprod." : `Targeting ${wallet.networkId}. Choose Preprod in the top bar for live use.`}
              </div>
            </div>
            <Tag tone={onPreprod ? "ok" : "warn"}>{wallet.networkId}</Tag>
          </li>
          <li>
            <span className="setup-n">3</span>
            <div>
              <div className="row">
                <Mark kind={escrowState.contractAddress ? "fill" : "empty"} tone={escrowState.contractAddress ? "ok" : "faint"} />
                <strong style={{ fontWeight: 600 }}>Escrow contract</strong>
              </div>
              <div className="small muted">
                {escrowState.contractAddress ? (
                  <>
                    Attached to <Hash value={escrowState.contractAddress} />
                  </>
                ) : (
                  "Deploy your own TaskEscrow or attach to an existing address."
                )}
              </div>
            </div>
            {escrowState.contractAddress ? (
              <Tag tone="ok">Attached</Tag>
            ) : (
              <a className="btn btn--sm" href="#/escrow">
                Set up
              </a>
            )}
          </li>
          <li>
            <span className="setup-n">4</span>
            <div>
              <div className="row">
                <Mark
                  kind={!isIndexerChecked ? "half" : isIndexerLive ? "fill" : "x"}
                  tone={!isIndexerChecked ? "faint" : isIndexerLive ? "ok" : "bad"}
                />
                <strong style={{ fontWeight: 600 }}>Preprod indexer</strong>
              </div>
              <div className="small muted">
                {!isIndexerChecked
                  ? "Checking the public indexer..."
                  : isIndexerLive
                  ? "Reachable and reporting the current epoch."
                  : "Not reachable right now. Pactra keeps retrying every 25 seconds."}
              </div>
            </div>
            <Tag tone={!isIndexerChecked ? "plain" : isIndexerLive ? "ok" : "bad"}>
              {!isIndexerChecked ? "Checking" : isIndexerLive ? "Online" : "Offline"}
            </Tag>
          </li>
        </ol>
      </section>

      <section className="section-block">
        <div className="section-row">
          <h2 className="section">How a pact runs</h2>
          <span className="small muted">Every step is a circuit on the TaskEscrow contract.</span>
        </div>
        <div className="rail rail--static" style={{ ["--steps" as string]: 5 }}>
          {LIFECYCLE.map(([name, desc], i) => (
            <div className="rail-step" key={name}>
              <span className="rail-num">{String(i + 1).padStart(2, "0")}</span>
              <div className="rail-name">{name}</div>
              <div className="rail-desc">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-row">
          <h2 className="section">What the network sees</h2>
          <a className="small" href="#/privacy">
            Try it in the privacy model
          </a>
        </div>
        <div className="ruled-2">
          <div className="sheet-body disclose disclose--shielded">
            <h4>
              <Mark /> Stays with you
            </h4>
            <ul>
              <li>Your prompt and what the task is for</li>
              <li>The exact budget rules and service allowlist</li>
              <li>How the agent plans the work</li>
              <li>Wallet keys and witness secrets</li>
            </ul>
          </div>
          <div className="sheet-body disclose disclose--public">
            <h4>
              <Mark kind="empty" /> Goes on the ledger
            </h4>
            <ul>
              <li>32 byte commitments to the task, agent and conditions</li>
              <li>The escrowed amount and the budget ceiling</li>
              <li>Which state the task is in</li>
              <li>A hash of the delivered result</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section-block">
        <h2 className="section" style={{ marginBottom: 16 }}>
          Where to go next
        </h2>
        <ul className="directory">
          {DIRECTORY.map((d) => (
            <li key={d.id}>
              <a href={`#/${d.id}`}>
                <span className="d-num">{d.num}</span>
                <span className="d-name">{d.name}</span>
                <span className="d-desc">{d.desc}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

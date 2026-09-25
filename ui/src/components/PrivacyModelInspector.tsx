import React, { useState, useMemo } from "react";
import { sha256Hex } from "../../../contract/src/index.js";
import { Mark, PageHead } from "./ui";

export const PrivacyModelInspector: React.FC = () => {
  const [privatePrompt, setPrivatePrompt] = useState<string>("Deploy fine-tuned sentiment classifier with proprietary weights");
  const [privateMaxBudget, setPrivateMaxBudget] = useState<number>(10);
  const [privateSecretSalt, setPrivateSecretSalt] = useState<string>("0xentropy_user_secret_seed_4a91f");
  const [privateProviderId, setPrivateProviderId] = useState<string>("0xprovider_alpha_enclave_99a4c102");

  // Commitments recompute on every keystroke so the one-way relationship is visible.
  const computedPolicyCommitment = useMemo(
    () => "0x" + sha256Hex(`policy:${privatePrompt}:${privateMaxBudget}:${privateSecretSalt}:${privateProviderId}`),
    [privatePrompt, privateMaxBudget, privateSecretSalt, privateProviderId]
  );

  const computedConditionCommitment = useMemo(
    () => "0x" + sha256Hex(`condition:${privatePrompt}:provider=${privateProviderId}:maxCost=${privateMaxBudget}`),
    [privatePrompt, privateProviderId, privateMaxBudget]
  );

  const computedAgentCommitment = useMemo(
    () => "0x" + sha256Hex(`agent:executor:pactra_agent_worker_${privateSecretSalt.slice(0, 10)}`),
    [privateSecretSalt]
  );

  return (
    <div className="page">
      <PageHead
        num="07"
        section="Privacy model"
        title="Type a secret. Watch only its hash leave."
        lede="Edit the private inputs on the left. The right side is everything validators, indexers and other users can read. Change a single character and every commitment changes, but none of them can be turned back into your input."
      />

      <div className="ruled-2">
        <div className="sheet-body">
          <h3 className="sub row" style={{ marginBottom: 4 }}>
            <Mark /> Private inputs
          </h3>
          <p className="small faint" style={{ marginBottom: 16 }}>
            Held in this tab's memory only.
          </p>
          <div className="field">
            <label className="label" htmlFor="pp">
              Task prompt
            </label>
            <textarea id="pp" className="textarea" rows={3} value={privatePrompt} onChange={(e) => setPrivatePrompt(e.target.value)} />
          </div>
          <div className="cols-2" style={{ gap: 12, marginTop: 16 }}>
            <div>
              <label className="label" htmlFor="pb">
                Budget (DUST)
              </label>
              <input id="pb" type="number" className="input" value={privateMaxBudget} min={1} onChange={(e) => setPrivateMaxBudget(Number(e.target.value))} />
            </div>
            <div>
              <label className="label" htmlFor="ps">
                Secret salt
              </label>
              <input id="ps" type="text" className="input mono" value={privateSecretSalt} onChange={(e) => setPrivateSecretSalt(e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 16 }}>
            <label className="label" htmlFor="pv">
              Provider identity
            </label>
            <input id="pv" type="text" className="input mono" value={privateProviderId} onChange={(e) => setPrivateProviderId(e.target.value)} />
          </div>
        </div>

        <div className="sheet-body" aria-live="polite">
          <h3 className="sub row" style={{ marginBottom: 4 }}>
            <Mark kind="empty" /> Public ledger
          </h3>
          <p className="small faint" style={{ marginBottom: 16 }}>
            What Midnight stores. 32 bytes each.
          </p>
          <div className="stack">
            <div>
              <div className="label">policyCommitment</div>
              <div className="hash-block">{computedPolicyCommitment}</div>
            </div>
            <div>
              <div className="label">conditionCommitmentHash</div>
              <div className="hash-block">{computedConditionCommitment}</div>
            </div>
            <div>
              <div className="label">agentCommitment</div>
              <div className="hash-block">{computedAgentCommitment}</div>
            </div>
            <dl className="kv">
              <dt>Escrow state</dt>
              <dd>ACTIVE</dd>
              <dt>Locked balance</dt>
              <dd>{privateMaxBudget} DUST</dd>
            </dl>
          </div>
        </div>
      </div>

      <section className="section-block">
        <h2 className="section" style={{ marginBottom: 16 }}>
          The full boundary
        </h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Where it lives</th>
                <th>Who can read it</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Task prompt and objective", "Creator and agent memory", "Only them"],
                ["Budget rules and provider allowlist", "Behind the policy commitment", "Only the creator and agent"],
                ["Agent plan and intermediate steps", "Agent runtime", "Only the agent"],
                ["API keys, datasets, instructions", "Encrypted channel to the provider", "Agent and provider"],
                ["Creator secret and proof witnesses", "Local witness state", "Only you"],
                ["Task, agent and condition commitments", "Midnight ledger", "Everyone"],
                ["Escrow balance and task state", "Midnight ledger", "Everyone"],
                ["Provider commitment", "Midnight ledger", "Everyone"],
                ["Result and evidence hashes", "Midnight ledger", "Everyone"],
              ].map(([what, where, who]) => (
                <tr key={what}>
                  <td style={{ fontWeight: 500 }}>{what}</td>
                  <td className="small muted">{where}</td>
                  <td className="small">
                    <span className="row" style={{ gap: 8 }}>
                      <Mark kind={who === "Everyone" ? "empty" : "fill"} />
                      {who}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-block">
        <h2 className="section" style={{ marginBottom: 8 }}>
          Where the guarantees come from
        </h2>
        <p className="muted" style={{ maxWidth: "68ch", marginBottom: 16 }}>
          Some of this privacy is enforced by Midnight's zero-knowledge circuits. Some of it depends on the application
          keeping data off-chain. Both are listed so you know which is which.
        </p>
        <div className="ruled-2">
          <div className="sheet-body disclose disclose--shielded">
            <h4>Enforced by Midnight</h4>
            <ul>
              <li>Shielded coin balances and balance proofs</li>
              <li>State changes that validators check without seeing the inputs</li>
              <li>Identity commitments that stop wallets being linked</li>
            </ul>
          </div>
          <div className="sheet-body disclose disclose--public">
            <h4>Kept private by the application</h4>
            <ul>
              <li>Prompts and API tokens held in browser memory</li>
              <li>Encrypted connections between the agent and providers</li>
              <li>Execution logs shown to arbitrators only during a dispute</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

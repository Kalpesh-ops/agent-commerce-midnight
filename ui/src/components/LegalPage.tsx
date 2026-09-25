import React from "react";
import { PageHead } from "./ui";

const EFFECTIVE = "25 September 2026";
const REPO = "https://github.com/Kalpesh-ops/agent-commerce-midnight";

const Terms: React.FC = () => (
  <div className="prose">
    <p>
      These terms cover your use of the Pactra web console (this site) and the TaskEscrow contract it talks to. By using the
      console you agree to them. If you do not agree, do not use it.
    </p>

    <h2>1. What Pactra is</h2>
    <p>
      Pactra is open source software for testing bounded payments between people and AI agents on the Midnight network. It
      is published by its maintainers as a public testnet preview. It is not a bank, broker, custodian or money transmitter,
      and it never holds your keys or your funds.
    </p>

    <h2>2. Testnet only</h2>
    <p>
      The console targets the Midnight Preprod testnet. DUST and tNIGHT on Preprod have no monetary value. Do not send
      anything of value to a contract deployed from this console, and do not connect a wallet that holds real assets. Mainnet
      settings in the code are unconfigured and unsupported.
    </p>

    <h2>3. Your wallet and keys</h2>
    <ul>
      <li>You sign every on-chain transaction yourself in the Lace wallet. Pactra cannot sign for you.</li>
      <li>Pactra will never ask for a seed phrase or private key. Anyone who does is not us.</li>
      <li>You are responsible for your wallet, your device, and what you approve.</li>
    </ul>

    <h2>4. Simulation and demo data</h2>
    <p>
      Many screens run a local simulation of the protocol. They are labelled "Simulation". Service providers, arbitrators,
      prices and evidence shown there are test fixtures, not real businesses or real offers.
    </p>

    <h2>5. On-chain actions are final</h2>
    <p>
      Transactions confirmed on Midnight cannot be reversed by Pactra. Commitments, escrow amounts and task states you
      publish are public and permanent on that network.
    </p>

    <h2>6. Acceptable use</h2>
    <ul>
      <li>Do not use the console to break the law, attack the Midnight network, or interfere with other testers.</li>
      <li>Do not submit personal data about other people in feedback or task fields.</li>
      <li>Security findings are welcome. Please report them privately through the repository before disclosing.</li>
    </ul>

    <h2>7. No warranty</h2>
    <p>
      The software is provided "as is", without warranty of any kind. It has not completed an independent security audit.
      It may contain bugs that lose test funds, fail to connect, or show wrong state.
    </p>

    <h2>8. Limitation of liability</h2>
    <p>
      To the extent the law allows, the maintainers are not liable for any loss arising from your use of the console or the
      contract, including lost tokens, lost data or downtime.
    </p>

    <h2>9. Source code licence</h2>
    <p>
      The code is published at <a href={REPO}>the Pactra repository</a> under the licence stated there. These terms cover
      use of the hosted console, not your rights under that licence.
    </p>

    <h2>10. Changes and contact</h2>
    <p>
      We may update these terms. The effective date at the top of this page changes when we do. Questions go to the
      repository's issue tracker.
    </p>
  </div>
);

const Privacy: React.FC = () => (
  <div className="prose">
    <p>
      Pactra has no accounts and runs no backend of its own. This page lists everything the console stores and every
      service it contacts, so you can check it against the code.
    </p>

    <h2>1. Stored in your browser</h2>
    <p>These stay on your device in local storage until you clear site data. Pactra does not upload them.</p>
    <ul>
      <li>
        <strong>Wallet session</strong>: network, your shielded coin and encryption public keys, and timestamps. Kept for 30
        days so the console can reconnect after a reload.
      </li>
      <li>
        <strong>Device profile</strong>: a random device id, device type, operating system, browser, screen resolution and
        time zone. Used only to recognise this browser as a trusted device for that session.
      </li>
      <li>
        <strong>Contract address</strong> of the TaskEscrow you deployed or attached.
      </li>
      <li>
        <strong>Usage counts</strong>: local telemetry such as how many walkthroughs or verifications ran. Secrets are
        stripped before anything is recorded.
      </li>
      <li>
        <strong>Feedback</strong> you write in the feedback form. It leaves your browser only if you copy or export it
        yourself.
      </li>
      <li>
        <strong>Session flags</strong> such as whether you closed the testnet notice (session storage, cleared when the tab
        closes).
      </li>
    </ul>

    <h2>2. Services the console contacts</h2>
    <ul>
      <li>
        <strong>Midnight Preprod indexer</strong> (indexer.preprod.midnight.network) to read network and contract state.
      </li>
      <li>
        <strong>Midnight Preprod proof server</strong> (prover.preprod.midnight.network) when you submit a real transaction.
        The transaction's inputs are sent there so a zero-knowledge proof can be built.
      </li>
      <li>
        <strong>Lace wallet</strong>, the browser extension you choose to connect.
      </li>
      <li>
        <strong>Google Fonts</strong> to load the Outfit and JetBrains Mono typefaces. Google receives your IP address and
        browser details with that request.
      </li>
      <li>
        <strong>Vercel</strong>, which hosts the site and keeps standard request logs.
      </li>
    </ul>
    <p>Each of these runs under its own privacy policy.</p>

    <h2>3. What becomes public</h2>
    <p>
      Anything you confirm on-chain is visible to everyone: commitments, escrowed amounts, task state and result hashes.
      Plain-text prompts, policies and secrets are designed to stay off the ledger, but you should still avoid putting
      personal data into any field.
    </p>

    <h2>4. No tracking</h2>
    <p>The console uses no advertising, analytics service, cookies for tracking, or fingerprinting beyond the device profile described above.</p>

    <h2>5. Your control</h2>
    <p>
      Disconnect the wallet from the top bar at any time. Clearing this site's data in your browser deletes everything in
      section 1. Because Pactra holds no copy, there is nothing further for us to delete.
    </p>

    <h2>6. Changes and contact</h2>
    <p>
      If what the console stores or contacts changes, this page changes with it and the effective date updates. Questions go
      to <a href={REPO}>the repository's issue tracker</a>.
    </p>
  </div>
);

export const LegalPage: React.FC<{ kind: "terms" | "privacy-policy" }> = ({ kind }) => (
  <div className="page">
    <PageHead
      num="§"
      section={`Legal · Effective ${EFFECTIVE}`}
      title={kind === "terms" ? "Terms of Service" : "Privacy Policy"}
      lede={
        kind === "terms"
          ? "The rules for using this testnet console, in plain language."
          : "What the console keeps, where it sends requests, and what ends up public."
      }
    />
    {kind === "terms" ? <Terms /> : <Privacy />}
  </div>
);

import React, { useRef, useState } from "react";
import { pactraUiService, PactraProtocolState } from "../services/pactraUiService";
import { AgentCapability, ServiceDefinition } from "../../../contract/src/index.js";
import { Hash, LogFn, PageHead, Tag } from "./ui";

interface MarketplaceViewProps {
  onLog: LogFn;
  onServiceProcured?: (procurementId: string) => void;
}

const CATEGORIES: Array<"ALL" | AgentCapability> = ["ALL", "COMPUTE", "STORAGE", "API_CALL", "DEPLOYMENT", "DATA_PROCESSING"];

const CATEGORY_LABEL: Record<string, string> = {
  ALL: "All",
  COMPUTE: "Compute",
  STORAGE: "Storage",
  API_CALL: "API calls",
  DEPLOYMENT: "Deployment",
  DATA_PROCESSING: "Data processing",
};

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({ onLog, onServiceProcured }) => {
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | AgentCapability>("ALL");
  const [procuringServiceId, setProcuringServiceId] = useState<string | null>(null);
  const procuringRef = useRef(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; text: string } | null>(null);
  const pactraState: PactraProtocolState = pactraUiService.getState();

  const services =
    selectedCategory === "ALL"
      ? pactraState.registryServices
      : pactraState.registryServices.filter((s) => s.category === selectedCategory);

  const countFor = (cat: "ALL" | AgentCapability) =>
    cat === "ALL" ? pactraState.registryServices.length : pactraState.registryServices.filter((s) => s.category === cat).length;

  // One purchase at a time: parallel requests would each pass the budget check before either reserves funds.
  const handleProcure = async (service: ServiceDefinition) => {
    if (procuringRef.current) return;
    procuringRef.current = true;
    setProcuringServiceId(service.serviceId);
    setLastResult(null);
    try {
      onLog(`Checking policy for "${service.name}" (${service.unitPrice} DUST)...`, "info");
      const record = await pactraUiService.procureMarketplaceService(service.serviceId);
      onLog(`Approved. Purchase ${record.procurementId}, ${service.unitPrice} DUST reserved.`, "success");
      setLastResult({ ok: true, text: `${service.name} approved as ${record.procurementId}. ${service.unitPrice} DUST reserved.` });
      if (onServiceProcured) {
        onServiceProcured(record.procurementId);
      }
    } catch (err: any) {
      onLog(`Purchase blocked: ${err.message}`, "error");
      setLastResult({ ok: false, text: `${service.name} was blocked by the policy: ${err.message}` });
    } finally {
      procuringRef.current = false;
      setProcuringServiceId(null);
    }
  };

  return (
    <div className="page">
      <PageHead
        num="05"
        section="Services"
        title="The providers an agent may buy from."
        lede="Each purchase goes through the same policy check. If a price or category falls outside the policy, the request is refused before any funds move."
        aside={<Tag tone="warn">Test providers</Tag>}
      />

      <div className="filters" role="toolbar" aria-label="Filter by category">
        {CATEGORIES.map((cat) => (
          <button key={cat} aria-pressed={selectedCategory === cat} onClick={() => setSelectedCategory(cat)}>
            {CATEGORY_LABEL[cat]} <span className="faint">{countFor(cat)}</span>
          </button>
        ))}
      </div>

      {lastResult && (
        <div className={`notice ${lastResult.ok ? "notice--ok" : "notice--bad"}`} style={{ marginBottom: 16 }} role="status">
          {lastResult.text}
        </div>
      )}

      {services.length === 0 ? (
        <div className="notice">No providers in this category yet.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Service</th>
                <th className="hide-sm">Category</th>
                <th className="hide-sm">Verification</th>
                <th className="num">Price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {services.map((service) => {
                const isBusy = procuringServiceId === service.serviceId;
                return (
                  <tr key={service.serviceId}>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>{service.name}</span>
                        {service.isTestSandboxProvider ? <Tag tone="warn">Sandbox</Tag> : <Tag tone="ok">Verified</Tag>}
                      </div>
                      <div className="small muted" style={{ marginTop: 2, maxWidth: "52ch" }}>
                        {service.description || "Registered provider with verified execution."}
                      </div>
                      <div className="tiny faint" style={{ marginTop: 4 }}>
                        Provider <Hash value={service.providerCommitment} head={12} tail={6} />
                      </div>
                    </td>
                    <td className="hide-sm small">{CATEGORY_LABEL[service.category] ?? service.category}</td>
                    <td className="hide-sm small muted">{String(service.verificationMethod).toLowerCase().replace(/_/g, " ")}</td>
                    <td className="num">
                      <div style={{ fontWeight: 600 }}>{service.unitPrice.toString()} DUST</div>
                      <div className="tiny faint">{service.pricingModel?.toLowerCase().replace(/_/g, " ")}</div>
                    </td>
                    <td className="num">
                      <button
                        className="btn btn--sm btn--primary"
                        disabled={procuringServiceId !== null || service.status !== "ACTIVE"}
                        title={service.status !== "ACTIVE" ? "This provider is not taking orders right now." : undefined}
                        onClick={() => handleProcure(service)}
                      >
                        {isBusy ? "Checking..." : "Buy"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

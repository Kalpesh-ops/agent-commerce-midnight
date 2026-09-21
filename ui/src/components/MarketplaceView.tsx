import React, { useState } from "react";
import {
  pactraUiService,
  PactraProtocolState,
} from "../services/pactraUiService";
import { AgentCapability, ServiceDefinition } from "../../../contract/src/index.js";

interface MarketplaceViewProps {
  onLog: (text: string, type?: "info" | "success" | "error") => void;
  onServiceProcured?: (procurementId: string) => void;
}

const CATEGORIES: Array<"ALL" | AgentCapability> = [
  "ALL",
  "COMPUTE",
  "STORAGE",
  "API_CALL",
  "DEPLOYMENT",
  "DATA_PROCESSING",
];

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  onLog,
  onServiceProcured,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | AgentCapability>("ALL");
  const [procuringServiceId, setProcuringServiceId] = useState<string | null>(null);
  const pactraState: PactraProtocolState = pactraUiService.getState();

  const services =
    selectedCategory === "ALL"
      ? pactraState.registryServices
      : pactraState.registryServices.filter((s) => s.category === selectedCategory);

  const handleProcure = async (service: ServiceDefinition) => {
    setProcuringServiceId(service.serviceId);
    try {
      onLog(
        `Initiating policy check & micro-procurement for "${service.name}" (${service.unitPrice} DUST)...`,
        "info"
      );
      const record = await pactraUiService.procureMarketplaceService(service.serviceId);
      onLog(
        `Policy authorized procurement! ID: ${record.procurementId}. Reserved: ${service.unitPrice} DUST.`,
        "success"
      );
      if (onServiceProcured) {
        onServiceProcured(record.procurementId);
      }
    } catch (err: any) {
      onLog(`Procurement blocked: ${err.message}`, "error");
    } finally {
      setProcuringServiceId(null);
    }
  };

  const getCategoryColor = (cat: AgentCapability) => {
    switch (cat) {
      case "COMPUTE":
        return "var(--cyan)";
      case "STORAGE":
        return "var(--purple)";
      case "API_CALL":
        return "var(--amber)";
      case "DEPLOYMENT":
        return "var(--emerald)";
      case "DATA_PROCESSING":
        return "#f43f5e";
      default:
        return "var(--text-muted)";
    }
  };

  return (
    <div className="panel-card" style={{ marginTop: "24px" }}>
      <div className="panel-header">
        <div>
          <h3>🏪 Generalized Multi-Service Marketplace</h3>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Discover and procure authorized confidential services across Compute, Storage, APIs, Deployment, and Data Processing.
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`btn-secondary ${selectedCategory === cat ? "active" : ""}`}
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 700,
              background: selectedCategory === cat ? "rgba(112, 69, 255, 0.25)" : "rgba(255, 255, 255, 0.03)",
              borderColor: selectedCategory === cat ? "var(--purple)" : "rgba(255, 255, 255, 0.1)",
              color: selectedCategory === cat ? "var(--cyan)" : "var(--text-muted)",
            }}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Services Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "14px",
        }}
      >
        {services.map((service) => {
          const isBusy = procuringServiceId === service.serviceId;
          const catColor = getCategoryColor(service.category);

          return (
            <div
              key={service.serviceId}
              style={{
                background: "rgba(10, 10, 25, 0.6)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "var(--radius-md)",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <span
                    style={{
                      background: `rgba(255, 255, 255, 0.05)`,
                      border: `1px solid ${catColor}`,
                      color: catColor,
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: 800,
                      letterSpacing: "0.5px",
                    }}
                  >
                    {service.category}
                  </span>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: service.isTestSandboxProvider ? "rgba(255, 170, 0, 0.15)" : "rgba(0, 230, 153, 0.15)",
                        color: service.isTestSandboxProvider ? "var(--amber)" : "var(--emerald)",
                        fontWeight: 700,
                      }}
                    >
                      {service.isTestSandboxProvider ? "🧪 Test Sandbox" : "🛡️ Production Verified"}
                    </span>
                  </div>
                </div>

                <h4 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "6px", color: "var(--text-main)" }}>
                  {service.name}
                </h4>

                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px", lineHeight: "1.4" }}>
                  {service.description || "Authorized provider offering verified decentralized execution."}
                </p>

                <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "4px", marginBottom: "14px" }}>
                  <div>
                    <strong>Pricing:</strong> {service.unitPrice.toString()} DUST ({service.pricingModel})
                  </div>
                  <div>
                    <strong>Verification:</strong> {service.verificationMethod}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}>
                    <strong>Provider PK:</strong> {service.providerCommitment.slice(0, 16)}...
                  </div>
                </div>
              </div>

              <button
                className="btn-action primary"
                style={{ width: "100%", fontSize: "12px", padding: "8px" }}
                disabled={isBusy || service.status !== "ACTIVE"}
                onClick={() => handleProcure(service)}
              >
                {isBusy ? "Checking Policy..." : `Procure (${service.unitPrice} DUST)`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Pactra — Service Registry Model
 *
 * Defines the registry of authorized external service providers.
 * Autonomous agents can only procure resources from active services
 * registered and approved under task policies.
 */

import { AgentCapability, PolicyViolationError } from "./policy.js";

export type VerificationMethod =
  | "EXECUTION_EVIDENCE"
  | "SIGNATURE_ATTESTATION"
  | "HASH_CHAIN"
  | "EXTERNAL_VERIFIER";

export type ServiceStatus = "ACTIVE" | "REVOKED" | "SUSPENDED";

export interface ServiceDefinition {
  readonly serviceId: string;
  readonly name: string;
  readonly providerCommitment: string;
  readonly category: AgentCapability;
  readonly unitPrice: bigint;
  readonly maxPrice: bigint;
  readonly verificationMethod: VerificationMethod;
  readonly status: ServiceStatus;
  readonly metadataUri?: string;
}

export class ServiceRegistry {
  private services = new Map<string, ServiceDefinition>();

  constructor(initialServices: ServiceDefinition[] = []) {
    for (const service of initialServices) {
      this.registerService(service);
    }
  }

  public registerService(service: ServiceDefinition): void {
    if (service.unitPrice <= 0n) {
      throw new PolicyViolationError("INVALID_SERVICE_PRICE", "Unit price must be greater than zero.");
    }
    if (service.maxPrice < service.unitPrice) {
      throw new PolicyViolationError("INVALID_MAX_PRICE", "Maximum price cannot be lower than unit price.");
    }
    this.services.set(service.serviceId, { ...service });
  }

  public revokeService(serviceId: string): void {
    const existing = this.services.get(serviceId);
    if (!existing) {
      throw new PolicyViolationError("SERVICE_NOT_FOUND", `Service "${serviceId}" does not exist in registry.`);
    }
    this.services.set(serviceId, { ...existing, status: "REVOKED" });
  }

  public getService(serviceId: string): ServiceDefinition | null {
    return this.services.get(serviceId) ?? null;
  }

  public listActiveServices(category?: AgentCapability): ServiceDefinition[] {
    const all = Array.from(this.services.values()).filter((s) => s.status === "ACTIVE");
    if (category) {
      return all.filter((s) => s.category === category);
    }
    return all;
  }

  public validateServiceQuote(serviceId: string, quoteAmount: bigint): { valid: boolean; reason?: string } {
    const service = this.services.get(serviceId);
    if (!service) {
      return { valid: false, reason: `Service "${serviceId}" is not in the registry.` };
    }
    if (service.status !== "ACTIVE") {
      return { valid: false, reason: `Service "${serviceId}" is currently ${service.status}.` };
    }
    if (quoteAmount > service.maxPrice) {
      return {
        valid: false,
        reason: `Quote amount (${quoteAmount}) exceeds service maximum allowed price (${service.maxPrice}).`,
      };
    }
    return { valid: true };
  }
}

/**
 * Creates a pre-populated default ServiceRegistry with concrete Level 2 services.
 */
export function createDefaultServiceRegistry(): ServiceRegistry {
  return new ServiceRegistry([
    {
      serviceId: "srv_compute_alpha",
      name: "Confidential Enclave Compute Alpha",
      providerCommitment: "0xprovider_alpha_enclave_99a4c102",
      category: "COMPUTE",
      unitPrice: 2n,
      maxPrice: 2n,
      verificationMethod: "EXECUTION_EVIDENCE",
      status: "ACTIVE",
    },
    {
      serviceId: "srv_compute_beta",
      name: "Secure Container Worker Beta",
      providerCommitment: "0xprovider_beta_worker_77c2e501",
      category: "COMPUTE",
      unitPrice: 1n,
      maxPrice: 3n,
      verificationMethod: "EXECUTION_EVIDENCE",
      status: "ACTIVE",
    },
    {
      serviceId: "srv_storage_gamma",
      name: "Encrypted Distributed Storage Gamma",
      providerCommitment: "0xprovider_gamma_store_44f1b883",
      category: "STORAGE",
      unitPrice: 1n,
      maxPrice: 2n,
      verificationMethod: "HASH_CHAIN",
      status: "ACTIVE",
    },
  ]);
}

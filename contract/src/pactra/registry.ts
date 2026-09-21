/**
 * Pactra — Generalized Multi-Service Marketplace Registry
 *
 * Defines the registry of authorized external service providers across
 * COMPUTE, STORAGE, API_CALL, DEPLOYMENT, and DATA_PROCESSING.
 *
 * Each service includes capability classification, pricing models,
 * verification methods, SLA requirements, and active/revoked lifecycle status.
 */

import { AgentCapability, PolicyViolationError } from "./policy.js";

export type VerificationMethod =
  | "EXECUTION_EVIDENCE"
  | "SIGNATURE_ATTESTATION"
  | "HASH_CHAIN"
  | "EXTERNAL_VERIFIER"
  | "MULTI_SIGNATURE_ATTESTATION";

export type ServiceStatus = "ACTIVE" | "REVOKED" | "SUSPENDED" | "MAINTENANCE";

export type PricingModel = "FIXED" | "HOURLY" | "USAGE_TIERED" | "PER_CALL";

export interface EvidenceRequirement {
  readonly requiresInputHash: boolean;
  readonly requiresOutputCommitment: boolean;
  readonly requiresProviderSignature: boolean;
  readonly maxDurationSeconds: number;
}

export interface ServiceDefinition {
  readonly serviceId: string;
  readonly name: string;
  readonly providerCommitment: string;
  readonly category: AgentCapability;
  readonly pricingModel: PricingModel;
  readonly unitPrice: bigint;
  readonly maxPrice: bigint;
  readonly verificationMethod: VerificationMethod;
  readonly evidenceRequirement: EvidenceRequirement;
  readonly isTestSandboxProvider: boolean;
  readonly status: ServiceStatus;
  readonly description?: string;
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

  public updateServicePrice(serviceId: string, newUnitPrice: bigint, newMaxPrice?: bigint): void {
    const existing = this.services.get(serviceId);
    if (!existing) {
      throw new PolicyViolationError("SERVICE_NOT_FOUND", `Service "${serviceId}" does not exist in registry.`);
    }
    const maxPrice = newMaxPrice ?? existing.maxPrice;
    if (newUnitPrice <= 0n) {
      throw new PolicyViolationError("INVALID_SERVICE_PRICE", "Unit price must be greater than zero.");
    }
    if (maxPrice < newUnitPrice) {
      throw new PolicyViolationError("INVALID_MAX_PRICE", "Maximum price cannot be lower than unit price.");
    }
    this.services.set(serviceId, {
      ...existing,
      unitPrice: newUnitPrice,
      maxPrice,
    });
  }

  public revokeService(serviceId: string): void {
    const existing = this.services.get(serviceId);
    if (!existing) {
      throw new PolicyViolationError("SERVICE_NOT_FOUND", `Service "${serviceId}" does not exist in registry.`);
    }
    this.services.set(serviceId, { ...existing, status: "REVOKED" });
  }

  public setServiceStatus(serviceId: string, status: ServiceStatus): void {
    const existing = this.services.get(serviceId);
    if (!existing) {
      throw new PolicyViolationError("SERVICE_NOT_FOUND", `Service "${serviceId}" does not exist in registry.`);
    }
    this.services.set(serviceId, { ...existing, status });
  }

  public getService(serviceId: string): ServiceDefinition | null {
    return this.services.get(serviceId) ?? null;
  }

  public listAllServices(): ServiceDefinition[] {
    return Array.from(this.services.values());
  }

  public listActiveServices(category?: AgentCapability): ServiceDefinition[] {
    const all = Array.from(this.services.values()).filter((s) => s.status === "ACTIVE");
    if (category) {
      return all.filter((s) => s.category === category);
    }
    return all;
  }

  public findServicesByProvider(providerCommitment: string): ServiceDefinition[] {
    return Array.from(this.services.values()).filter(
      (s) => s.providerCommitment.toLowerCase() === providerCommitment.toLowerCase()
    );
  }

  public validateServiceQuote(
    serviceId: string,
    quoteAmount: bigint
  ): { valid: boolean; reason?: string; service?: ServiceDefinition } {
    const service = this.services.get(serviceId);
    if (!service) {
      return { valid: false, reason: `Service "${serviceId}" is not in the registry.` };
    }
    if (service.status !== "ACTIVE") {
      return { valid: false, reason: `Service "${serviceId}" is currently ${service.status}.`, service };
    }
    if (quoteAmount > service.maxPrice) {
      return {
        valid: false,
        reason: `Quote amount (${quoteAmount}) exceeds service maximum allowed price (${service.maxPrice}).`,
        service,
      };
    }
    return { valid: true, service };
  }
}

/**
 * Creates a pre-populated default ServiceRegistry with Level 3 multi-service marketplace offerings.
 * Clearly separates verified test sandbox providers from production infrastructure.
 */
export function createDefaultServiceRegistry(): ServiceRegistry {
  return new ServiceRegistry([
    {
      serviceId: "srv_compute_alpha",
      name: "Confidential Enclave Compute Alpha",
      providerCommitment: "0xprovider_alpha_enclave_99a4c102",
      category: "COMPUTE",
      pricingModel: "FIXED",
      unitPrice: 2n,
      maxPrice: 2n,
      verificationMethod: "EXECUTION_EVIDENCE",
      evidenceRequirement: {
        requiresInputHash: true,
        requiresOutputCommitment: true,
        requiresProviderSignature: true,
        maxDurationSeconds: 60,
      },
      isTestSandboxProvider: false,
      status: "ACTIVE",
      description: "Hardware-isolated SGX/SEV confidential compute worker node.",
    },
    {
      serviceId: "srv_compute_beta",
      name: "Secure Container Worker Beta",
      providerCommitment: "0xprovider_beta_worker_77c2e501",
      category: "COMPUTE",
      pricingModel: "HOURLY",
      unitPrice: 1n,
      maxPrice: 3n,
      verificationMethod: "EXECUTION_EVIDENCE",
      evidenceRequirement: {
        requiresInputHash: true,
        requiresOutputCommitment: true,
        requiresProviderSignature: true,
        maxDurationSeconds: 120,
      },
      isTestSandboxProvider: true,
      status: "ACTIVE",
      description: "Ephemeral sandboxed container execution environment.",
    },
    {
      serviceId: "srv_storage_gamma",
      name: "Encrypted Distributed Storage Gamma",
      providerCommitment: "0xprovider_gamma_store_44f1b883",
      category: "STORAGE",
      pricingModel: "FIXED",
      unitPrice: 1n,
      maxPrice: 2n,
      verificationMethod: "HASH_CHAIN",
      evidenceRequirement: {
        requiresInputHash: true,
        requiresOutputCommitment: true,
        requiresProviderSignature: true,
        maxDurationSeconds: 30,
      },
      isTestSandboxProvider: false,
      status: "ACTIVE",
      description: "Client-side encrypted IPFS pinned volume with availability proofs.",
    },
    {
      serviceId: "srv_api_gateway",
      name: "Verifiable Oracle API Gateway",
      providerCommitment: "0xprovider_api_gateway_33d8a901",
      category: "API_CALL",
      pricingModel: "PER_CALL",
      unitPrice: 1n,
      maxPrice: 2n,
      verificationMethod: "SIGNATURE_ATTESTATION",
      evidenceRequirement: {
        requiresInputHash: true,
        requiresOutputCommitment: true,
        requiresProviderSignature: true,
        maxDurationSeconds: 15,
      },
      isTestSandboxProvider: false,
      status: "ACTIVE",
      description: "Cryptographically signed JSON-RPC telemetry & data query relay.",
    },
    {
      serviceId: "srv_deploy_delta",
      name: "Sandboxed MicroVM Deployer",
      providerCommitment: "0xprovider_deploy_delta_55b2c404",
      category: "DEPLOYMENT",
      pricingModel: "FIXED",
      unitPrice: 2n,
      maxPrice: 3n,
      verificationMethod: "MULTI_SIGNATURE_ATTESTATION",
      evidenceRequirement: {
        requiresInputHash: true,
        requiresOutputCommitment: true,
        requiresProviderSignature: true,
        maxDurationSeconds: 90,
      },
      isTestSandboxProvider: false,
      status: "ACTIVE",
      description: "Zero-knowledge verified container bootstrapping and continuous health monitors.",
    },
    {
      serviceId: "srv_dataproc_epsilon",
      name: "Zero-Knowledge Data Indexer & Transformer",
      providerCommitment: "0xprovider_dataproc_eps_11e7a202",
      category: "DATA_PROCESSING",
      pricingModel: "USAGE_TIERED",
      unitPrice: 1n,
      maxPrice: 2n,
      verificationMethod: "EXECUTION_EVIDENCE",
      evidenceRequirement: {
        requiresInputHash: true,
        requiresOutputCommitment: true,
        requiresProviderSignature: true,
        maxDurationSeconds: 45,
      },
      isTestSandboxProvider: false,
      status: "ACTIVE",
      description: "Confidential data cleaning, embedding vectorization, and Merkle tree generation.",
    },
  ]);
}

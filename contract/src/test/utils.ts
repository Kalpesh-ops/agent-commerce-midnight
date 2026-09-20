import crypto from "node:crypto";

export const randomBytes = (length: number): Uint8Array => {
  return new Uint8Array(crypto.randomBytes(length));
};

export const toHex = (bytes: Uint8Array): string => {
  return Buffer.from(bytes).toString("hex");
};

export const fromHex = (hex: string): Uint8Array => {
  return new Uint8Array(Buffer.from(hex, "hex"));
};

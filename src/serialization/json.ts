import type { MechanismDocument } from "../domain/mechanism";

export const serializeMechanism = (document: MechanismDocument): string =>
  JSON.stringify(document, null, 2);

export const parseMechanism = (raw: string): MechanismDocument => {
  const parsed = JSON.parse(raw) as Partial<MechanismDocument>;

  if (parsed.schemaVersion !== 1) {
    throw new Error("Unsupported schema version.");
  }

  if (!Array.isArray(parsed.parts) || !Array.isArray(parsed.connections) || !Array.isArray(parsed.drivers)) {
    throw new Error("Malformed mechanism document.");
  }

  return parsed as MechanismDocument;
};


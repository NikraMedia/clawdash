/**
 * Shared model option parsing for dynamic model lists from the gateway.
 */

export interface ModelOption {
  id: string;
  label: string;
}

export const FALLBACK_MODELS: ModelOption[] = [
  { id: "sonnet-4.6", label: "Sonnet 4.6" },
  { id: "opus-4.6", label: "Opus 4.6" },
  { id: "haiku-4.5", label: "Haiku 4.5" },
  { id: "gpt-5.2", label: "GPT-5.2" },
  { id: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
];

/**
 * Parse a gateway models response into a normalized array.
 * Handles: { models: [...] }, plain arrays, string arrays, and object arrays.
 * Falls back to FALLBACK_MODELS if parsing fails or returns empty.
 */
export function parseModelsResponse(data: unknown): ModelOption[] {
  try {
    const arr = Array.isArray(data)
      ? data
      : data && typeof data === "object" && "models" in data && Array.isArray((data as Record<string, unknown>).models)
        ? (data as Record<string, unknown>).models as unknown[]
        : null;

    if (!arr || arr.length === 0) return FALLBACK_MODELS;

    const seen = new Set<string>();
    const models: ModelOption[] = [];
    for (const item of arr) {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const id = typeof obj.id === "string" ? obj.id : typeof obj.name === "string" ? obj.name : null;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const label =
          typeof obj.label === "string"
            ? obj.label
            : typeof obj.displayName === "string"
              ? obj.displayName
              : typeof obj.name === "string"
                ? obj.name
                : id;
        models.push({ id, label });
      } else if (typeof item === "string") {
        if (seen.has(item)) continue;
        seen.add(item);
        models.push({ id: item, label: item });
      }
    }

    return models.length > 0 ? models : FALLBACK_MODELS;
  } catch {
    return FALLBACK_MODELS;
  }
}

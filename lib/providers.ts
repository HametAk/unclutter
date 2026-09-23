export const providers = ["vercel", "typesafe", "ollama"] as const;
export type Provider = (typeof providers)[number];

export function resolveProvider(value: unknown): Provider {
  return value === "typesafe" || value === "ollama" ? value : "vercel";
}

export function providerLabel(provider: Provider): string {
  if (provider === "typesafe") return "TypeSafe AI";
  if (provider === "ollama") return "Ollama";
  return "Vercel AI Gateway";
}

export function providerKeyLabel(provider: Provider): string {
  if (provider === "typesafe") return "TypeSafe / Jev";
  if (provider === "ollama") return "Ollama model";
  return "Vercel AI Gateway";
}

export function smokeCredentials(env: Record<string, string | undefined>): {
  provider: Provider;
  key: string;
  ollamaBase?: string;
} {
  const gateway = env.AI_GATEWAY_API_KEY?.trim();
  const jev = env.JEV_KEY?.trim();
  const typesafe = env.TYPESAFE_API_KEY?.trim();
  const ollama = env.OLLAMA_MODEL?.trim();
  if ((gateway || jev || typesafe) && ollama)
    throw new Error(
      "Set only one provider: OLLAMA_MODEL, JEV_KEY / TYPESAFE_API_KEY, or AI_GATEWAY_API_KEY.",
    );
  if (gateway && (jev || typesafe))
    throw new Error(
      "Set only one provider's credentials: JEV_KEY / TYPESAFE_API_KEY or AI_GATEWAY_API_KEY, not both.",
    );
  if (jev && typesafe && jev !== typesafe)
    throw new Error("JEV_KEY and TYPESAFE_API_KEY differ. Set only one TypeSafe key.");
  if (ollama) return { provider: "ollama", key: ollama, ollamaBase: env.OLLAMA_HOST?.trim() };
  const direct = jev || typesafe;
  if (direct) return { provider: "typesafe", key: direct };
  if (gateway) return { provider: "vercel", key: gateway };
  throw new Error(
    "Set JEV_KEY or TYPESAFE_API_KEY for TypeSafe AI, AI_GATEWAY_API_KEY for Vercel, or OLLAMA_MODEL for local SemIf. Never pass keys as command-line arguments.",
  );
}

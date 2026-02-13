import type { NexusApiAdapter } from "@/lib/api/adapter";
import { FixtureNexusApiAdapter } from "@/lib/api/adapters/fixture";
import { HttpNexusApiAdapter } from "@/lib/api/adapters/http";

export type NexusApiMode = "fixture" | "http";

export interface NexusApiRuntimeConfig {
  mode: NexusApiMode;
  baseUrl: string;
}

function parseMode(input: string | undefined): NexusApiMode {
  return input === "http" ? "http" : "fixture";
}

export function resolveNexusApiRuntimeConfig(): NexusApiRuntimeConfig {
  const mode = parseMode(
    process.env.NEXUS_WEB_API_MODE ?? process.env.NEXT_PUBLIC_NEXUS_WEB_API_MODE,
  );
  const baseUrl =
    process.env.NEXUS_WEB_API_BASE_URL ?? process.env.NEXT_PUBLIC_NEXUS_WEB_API_BASE_URL ?? "";

  return {
    mode,
    baseUrl,
  };
}

export function createNexusApiAdapter(config?: NexusApiRuntimeConfig): NexusApiAdapter {
  const runtimeConfig = config ?? resolveNexusApiRuntimeConfig();
  if (runtimeConfig.mode === "http") {
    return new HttpNexusApiAdapter(runtimeConfig.baseUrl);
  }

  return new FixtureNexusApiAdapter();
}

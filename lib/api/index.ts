import type { NexusApiAdapter } from "@/lib/api/adapter";
import { FixtureNexusApiAdapter } from "@/lib/api/adapters/fixture";
import { HttpNexusApiAdapter } from "@/lib/api/adapters/http";

export type NexusApiMode = "fixture" | "http";

export interface NexusApiRuntimeConfig {
  mode: NexusApiMode;
  baseUrl: string;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

function parseMode(input: string | undefined): NexusApiMode | undefined {
  if (input === "http" || input === "fixture") {
    return input;
  }

  return undefined;
}

export function rewriteLoopbackBaseUrlForHost(baseUrl: string, host: string): string {
  if (!baseUrl || !host || LOOPBACK_HOSTS.has(host)) {
    return baseUrl;
  }

  try {
    const parsed = new URL(baseUrl);
    if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
      return baseUrl;
    }

    parsed.hostname = host;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return baseUrl;
  }
}

export function resolveNexusApiRuntimeConfig(): NexusApiRuntimeConfig {
  const explicitModeValue =
    process.env.NEXUS_WEB_API_MODE ?? process.env.NEXT_PUBLIC_NEXUS_WEB_API_MODE;
  const explicitMode = parseMode(explicitModeValue);
  const baseUrl =
    process.env.NEXUS_WEB_API_BASE_URL ?? process.env.NEXT_PUBLIC_NEXUS_WEB_API_BASE_URL ?? "";

  const mode: NexusApiMode =
    explicitModeValue !== undefined
      ? explicitMode ?? "fixture"
      : baseUrl
        ? "http"
        : "fixture";

  return {
    mode,
    baseUrl,
  };
}

export function resolveNexusApiClientRuntimeConfig(
  serverConfig: NexusApiRuntimeConfig,
): NexusApiRuntimeConfig {
  if (typeof window === "undefined") {
    return serverConfig;
  }

  const clientConfig = resolveNexusApiRuntimeConfig();
  const effectiveConfig =
    clientConfig.mode === "fixture" && serverConfig.mode === "http" ? serverConfig : clientConfig;

  return {
    ...effectiveConfig,
    baseUrl: rewriteLoopbackBaseUrlForHost(effectiveConfig.baseUrl, window.location.hostname),
  };
}

export function createNexusApiAdapter(config?: NexusApiRuntimeConfig): NexusApiAdapter {
  const runtimeConfig = config ?? resolveNexusApiRuntimeConfig();
  if (runtimeConfig.mode === "http") {
    return new HttpNexusApiAdapter(runtimeConfig.baseUrl);
  }

  return new FixtureNexusApiAdapter();
}

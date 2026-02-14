import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveNexusApiRuntimeConfig, rewriteLoopbackBaseUrlForHost } from "@/lib/api/index";

describe("Nexus API runtime config", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  beforeEach(() => {
    delete process.env.NEXUS_WEB_API_MODE;
    delete process.env.NEXT_PUBLIC_NEXUS_WEB_API_MODE;
    delete process.env.NEXUS_WEB_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_NEXUS_WEB_API_BASE_URL;
  });

  it("uses http mode when mode is unset and base url exists", () => {
    delete process.env.NEXUS_WEB_API_MODE;
    delete process.env.NEXT_PUBLIC_NEXUS_WEB_API_MODE;
    process.env.NEXUS_WEB_API_BASE_URL = "http://127.0.0.1:3000";

    const config = resolveNexusApiRuntimeConfig();

    expect(config).toEqual({
      mode: "http",
      baseUrl: "http://127.0.0.1:3000",
    });
  });

  it("honors explicit fixture mode even with base url", () => {
    process.env.NEXUS_WEB_API_MODE = "fixture";
    process.env.NEXUS_WEB_API_BASE_URL = "http://127.0.0.1:3000";

    const config = resolveNexusApiRuntimeConfig();

    expect(config).toEqual({
      mode: "fixture",
      baseUrl: "http://127.0.0.1:3000",
    });
  });

  it("uses fixture mode for invalid explicit mode value", () => {
    process.env.NEXUS_WEB_API_MODE = "weird";
    process.env.NEXUS_WEB_API_BASE_URL = "http://127.0.0.1:3000";

    const config = resolveNexusApiRuntimeConfig();

    expect(config).toEqual({
      mode: "fixture",
      baseUrl: "http://127.0.0.1:3000",
    });
  });

  it("uses explicit http mode when base url is missing", () => {
    process.env.NEXUS_WEB_API_MODE = "http";
    process.env.NEXUS_WEB_API_BASE_URL = "";

    const config = resolveNexusApiRuntimeConfig();

    expect(config).toEqual({
      mode: "http",
      baseUrl: "",
    });
  });

  it("rewrites loopback API host for non-loopback browser hostnames", () => {
    const rewritten = rewriteLoopbackBaseUrlForHost("http://127.0.0.1:3000", "host.containers.internal");

    expect(rewritten).toBe("http://host.containers.internal:3000");
  });

  it("does not rewrite non-loopback API hostnames", () => {
    const rewritten = rewriteLoopbackBaseUrlForHost("http://api.internal:3000", "host.containers.internal");

    expect(rewritten).toBe("http://api.internal:3000");
  });
});

import { describe, expect, it } from "vitest";

import { inferShikiLanguage, parseUnifiedDiffByFile } from "@/lib/diff/parse";

const MULTI_FILE_DIFF = `diff --git a/tools/bpf/resolve_btfids/Makefile b/tools/bpf/resolve_btfids/Makefile
index 1111111..2222222 100644
--- a/tools/bpf/resolve_btfids/Makefile
+++ b/tools/bpf/resolve_btfids/Makefile
@@ -1,3 +1,4 @@
 CC := clang
+CFLAGS += -fno-omit-frame-pointer
 all:
 	$(CC) main.c
diff --git a/kernel/bpf/verifier.c b/kernel/bpf/verifier.c
index aaaaaaa..bbbbbbb 100644
--- a/kernel/bpf/verifier.c
+++ b/kernel/bpf/verifier.c
@@ -10,3 +10,4 @@ static int sample(void)
 	return 0;
-}
+	return 1;
+}
`;

describe("parseUnifiedDiffByFile", () => {
  it("parses unified diffs into per-file sections", () => {
    const files = parseUnifiedDiffByFile(MULTI_FILE_DIFF);
    expect(files).toHaveLength(2);

    expect(files[0]).toMatchObject({
      oldPath: "tools/bpf/resolve_btfids/Makefile",
      newPath: "tools/bpf/resolve_btfids/Makefile",
      displayPath: "tools/bpf/resolve_btfids/Makefile",
    });
    expect(files[1]).toMatchObject({
      oldPath: "kernel/bpf/verifier.c",
      newPath: "kernel/bpf/verifier.c",
      displayPath: "kernel/bpf/verifier.c",
    });
    expect(files[0].highlightableLines.length).toBeGreaterThan(0);
    expect(files[1].lineEntries.some((line) => line.kind === "hunkHeader")).toBe(true);
  });

  it("returns a fallback single section when no diff boundary markers exist", () => {
    const files = parseUnifiedDiffByFile("just plain text\nwithout diff markers");
    expect(files).toHaveLength(1);
    expect(files[0]?.displayPath).toBe("section-1.diff");
    expect(files[0]?.lineEntries).toHaveLength(2);
  });
});

describe("inferShikiLanguage", () => {
  it("maps Makefiles and common extensions deterministically", () => {
    expect(inferShikiLanguage("tools/bpf/resolve_btfids/Makefile")).toBe("make");
    expect(inferShikiLanguage("kernel/bpf/verifier.c")).toBe("c");
    expect(inferShikiLanguage("src/file.rs")).toBe("rust");
    expect(inferShikiLanguage("src/file.tsx")).toBe("tsx");
  });

  it("falls back to text for unknown file types", () => {
    expect(inferShikiLanguage("README.unknownext")).toBe("text");
  });
});

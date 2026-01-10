"use client";

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { PatchViewer, splitBodyByRegions } from "@/components/patch-viewer";
import type { EmailHierarchy } from "@/lib/types";

interface EmailMessageProps {
  email: EmailHierarchy;
  isExpanded: boolean;
  onToggle: () => void;
}

function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString([], {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Renders the email body content, handling patch regions if present.
 */
function EmailBodyContent({ email }: { email: EmailHierarchy }) {
  const { body, patchMetadata } = email;

  // Split body into text and patch sections
  const sections = useMemo(() => {
    if (!body) return [];
    if (!patchMetadata?.hasPatch || !patchMetadata.regions.length) {
      return [{ type: "text" as const, content: body }];
    }
    return splitBodyByRegions(body, patchMetadata.regions);
  }, [body, patchMetadata]);

  if (!body) {
    return (
      <p className="text-sm text-muted-foreground italic">
        [Email body not available]
      </p>
    );
  }

  // If no patch metadata, render the body as-is
  if (!patchMetadata?.hasPatch) {
    return (
      <pre className="text-sm font-mono whitespace-pre-wrap break-words text-foreground/90 leading-relaxed max-w-none">
        {body}
      </pre>
    );
  }

  // Render sections with patch viewer for patch regions
  return (
    <div className="space-y-2">
      {sections.map((section, index) => {
        if (section.type === "text") {
          return (
            <pre
              key={`text-${index}`}
              className="text-sm font-mono whitespace-pre-wrap break-words text-foreground/90 leading-relaxed max-w-none"
            >
              {section.content}
            </pre>
          );
        }

        // Render patch region
        if (section.region) {
          return (
            <PatchViewer
              key={`patch-${index}`}
              body={body}
              patchMetadata={{
                ...patchMetadata,
                regions: [section.region],
              }}
            />
          );
        }

        return null;
      })}
    </div>
  );
}

export function EmailMessage({ email, isExpanded, onToggle }: EmailMessageProps) {
  const indentPx = Math.min(email.depth * 16, 64);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        className="border-l-2 border-border hover:border-primary/50 transition-colors"
        style={{ marginLeft: `${indentPx}px` }}
      >
        <div className="pl-3 py-2">
          {/* Email Header - Clickable to toggle */}
          <CollapsibleTrigger asChild>
            <button className="w-full text-left cursor-pointer rounded-md px-2 py-1.5 -mx-2 -my-1 bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <ChevronRight
                    className={`h-4 w-4 mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200 ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {email.authorName || email.authorEmail}
                      </span>
                      {email.authorName && (
                        <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                          &lt;{email.authorEmail}&gt;
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground truncate">
                      {email.subject}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatFullDate(email.date)}
                </span>
              </div>
            </button>
          </CollapsibleTrigger>

          {/* Collapsible Content */}
          <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up overflow-hidden">
            <div className="pt-3">
              <EmailBodyContent email={email} />
            </div>
          </CollapsibleContent>
        </div>
        <Separator />
      </div>
    </Collapsible>
  );
}

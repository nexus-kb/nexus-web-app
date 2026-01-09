"use client";

import { Separator } from "@/components/ui/separator";
import type { EmailHierarchy } from "@/lib/types";

interface EmailMessageProps {
  email: EmailHierarchy;
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

export function EmailMessage({ email }: EmailMessageProps) {
  const indentPx = Math.min(email.depth * 16, 64);

  return (
    <div
      className="border-l-2 border-border hover:border-primary/50 transition-colors"
      style={{ marginLeft: `${indentPx}px` }}
    >
      <div className="pl-3 py-2">
        {/* Email Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate">
              {email.author_name || email.author_email}
            </span>
            {email.author_name && (
              <span className="text-xs text-muted-foreground truncate">
                &lt;{email.author_email}&gt;
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatFullDate(email.date)}
          </span>
        </div>

        {/* Subject (only show if different from thread subject or first email) */}
        {email.depth > 0 && (
          <div className="text-xs text-muted-foreground mb-2">
            Re: {email.subject.replace(/^Re:\s*/i, "")}
          </div>
        )}

        {/* Email Body */}
        {email.body ? (
          <pre className="text-sm font-mono whitespace-pre-wrap break-words text-foreground/90 leading-relaxed max-w-none">
            {email.body}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            [Email body not available]
          </p>
        )}
      </div>
      <Separator />
    </div>
  );
}

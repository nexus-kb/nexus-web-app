"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/theme-toggle";
import type { MailingList } from "@/lib/types";

interface HeaderProps {
  mailingLists: MailingList[];
  selectedSlug: string | null;
  onSelectList: (slug: string) => void;
  isLoading?: boolean;
}

export function Header({
  mailingLists,
  selectedSlug,
  onSelectList,
  isLoading,
}: HeaderProps) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-4 border-b border-border bg-card px-4">
      <div className="flex items-center gap-2">
        <svg
          className="h-5 w-5 text-primary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <span className="font-semibold text-sm tracking-tight">Nexus</span>
      </div>

      <ThemeToggle />

      <div className="h-4 w-px bg-border" />

      <Select
        value={selectedSlug ?? ""}
        onValueChange={onSelectList}
        disabled={isLoading}
      >
        <SelectTrigger className="h-7 w-[280px] text-xs">
          <SelectValue placeholder="Select a mailing list..." />
        </SelectTrigger>
        <SelectContent>
          {mailingLists.map((list) => (
            <SelectItem key={list.slug} value={list.slug} className="text-xs">
              {list.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
        <span>Linux Kernel Mailing List Archive</span>
      </div>
    </header>
  );
}

"use client";

import type { FormEventHandler, ReactNode } from "react";
import { Button } from "../primitives/button";
import { Input } from "../primitives/input";

interface SearchToolbarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  actions?: ReactNode;
  placeholder?: string;
}

export function SearchToolbar({
  value,
  onChange,
  onSubmit,
  actions,
  placeholder = "Search",
}: SearchToolbarProps) {
  return (
    <form className="ds-search-toolbar" onSubmit={onSubmit}>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label="Search query"
      />
      <Button type="submit" variant="outline">
        Search
      </Button>
      {actions}
    </form>
  );
}

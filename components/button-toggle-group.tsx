"use client";

import { Button } from "@nexus/design-system";

interface ButtonToggleOption<T extends string> {
  value: T;
  label: string;
}

interface ButtonToggleGroupProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<ButtonToggleOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  buttonClassName?: string;
}

function joinClasses(...values: Array<string | undefined>): string {
  return values.filter((value) => Boolean(value && value.trim().length > 0)).join(" ");
}

export function ButtonToggleGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  buttonClassName,
}: ButtonToggleGroupProps<T>) {
  return (
    <div
      className={joinClasses("button-toggle-group", className)}
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Button
            key={option.value}
            variant="ghost"
            size="sm"
            className={joinClasses(
              "button-toggle-group-button",
              buttonClassName,
              selected ? "is-active" : undefined,
            )}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

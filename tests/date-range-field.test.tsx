import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let latestConfig: {
  onChange?: (selectedDates: Date[], dateStr: string, instance: {
    open: () => void;
    setDate: (dates: string[], triggerChange?: boolean, format?: string) => void;
  }) => void;
  onClose?: (selectedDates: Date[], dateStr: string, instance: {
    open: () => void;
    setDate: (dates: string[], triggerChange?: boolean, format?: string) => void;
  }) => void;
} | null = null;

const flatpickrInstance = {
  destroy: vi.fn(),
  open: vi.fn(),
  setDate: vi.fn(),
};

vi.mock("flatpickr", () => ({
  default: vi.fn((_element: HTMLInputElement, config: typeof latestConfig) => {
    latestConfig = config;
    return flatpickrInstance;
  }),
}));

import { DateRangeField } from "@/components/date-range-field";

describe("DateRangeField", () => {
  beforeEach(() => {
    latestConfig = null;
    flatpickrInstance.destroy.mockReset();
    flatpickrInstance.open.mockReset();
    flatpickrInstance.setDate.mockReset();
  });

  it("does not commit after selecting only the first date", () => {
    const onChange = vi.fn();

    render(<DateRangeField from="" to="" onChange={onChange} />);

    latestConfig?.onChange?.([new Date(2026, 2, 5)], "", flatpickrInstance);

    expect(onChange).not.toHaveBeenCalled();
    expect(flatpickrInstance.open).toHaveBeenCalledTimes(1);
  });

  it("commits once a full date range is selected", () => {
    const onChange = vi.fn();

    render(<DateRangeField from="" to="" onChange={onChange} />);

    latestConfig?.onChange?.([new Date(2026, 2, 5), new Date(2026, 2, 8)], "", flatpickrInstance);

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-03-05",
      to: "2026-03-08",
    });
  });

  it("commits a completed range from onClose when the picker closes after selection", () => {
    const onChange = vi.fn();

    render(<DateRangeField from="2026-03-05" to="2026-03-08" onChange={onChange} />);

    latestConfig?.onChange?.([new Date(2026, 2, 6)], "", flatpickrInstance);
    latestConfig?.onClose?.(
      [new Date(2026, 2, 6), new Date(2026, 2, 10)],
      "",
      flatpickrInstance,
    );

    expect(onChange).toHaveBeenCalledWith({
      from: "2026-03-06",
      to: "2026-03-10",
    });
  });

  it("clears both bounds when the picker selection is cleared", () => {
    const onChange = vi.fn();

    render(<DateRangeField from="2026-03-05" to="2026-03-08" onChange={onChange} />);

    latestConfig?.onChange?.([], "", flatpickrInstance);

    expect(onChange).toHaveBeenCalledWith({
      from: "",
      to: "",
    });
  });
});

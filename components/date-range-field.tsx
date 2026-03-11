"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import type { Instance as FlatpickrInstance } from "flatpickr/dist/types/instance";

interface DateRangeFieldProps {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
}

function toInputDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function DateRangeField({ from, to, onChange }: DateRangeFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<FlatpickrInstance | null>(null);
  const onChangeRef = useRef(onChange);
  const committedRangeRef = useRef({ from, to });
  const pendingRangeRef = useRef({ from, to });

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    committedRangeRef.current = { from, to };
    pendingRangeRef.current = { from, to };
  }, [from, to]);

  useEffect(() => {
    if (!inputRef.current || pickerRef.current) {
      return;
    }

    const defaultDate = from && to ? [from, to] : from ? [from] : [];

    pickerRef.current = flatpickr(inputRef.current, {
      mode: "range",
      dateFormat: "Y-m-d",
      allowInput: false,
      disableMobile: true,
      showMonths: 1,
      defaultDate,
      onChange: (selectedDates: Date[], _dateStr: string, instance: FlatpickrInstance) => {
        const start = selectedDates[0] ? toInputDate(selectedDates[0]) : "";
        const end = selectedDates[1] ? toInputDate(selectedDates[1]) : "";
        pendingRangeRef.current = { from: start, to: end };

        if (selectedDates.length === 0) {
          onChangeRef.current({ from: "", to: "" });
          return;
        }

        if (selectedDates.length < 2) {
          instance.open();
          return;
        }

        onChangeRef.current({ from: start, to: end });
      },
      onClose: (_selectedDates: Date[], _dateStr: string, instance: FlatpickrInstance) => {
        if (_selectedDates.length >= 2) {
          const start = _selectedDates[0] ? toInputDate(_selectedDates[0]) : "";
          const end = _selectedDates[1] ? toInputDate(_selectedDates[1]) : "";

          if (
            pendingRangeRef.current.from !== start ||
            pendingRangeRef.current.to !== end
          ) {
            pendingRangeRef.current = { from: start, to: end };
            onChangeRef.current({ from: start, to: end });
          }
          return;
        }

        const pendingRange = pendingRangeRef.current;
        if (!pendingRange.from || pendingRange.to) {
          return;
        }

        const committedRange = committedRangeRef.current;
        const committedValues = committedRange.from && committedRange.to
          ? [committedRange.from, committedRange.to]
          : committedRange.from
            ? [committedRange.from]
            : [];

        pendingRangeRef.current = committedRange;
        instance.setDate(committedValues, false, "Y-m-d");
      },
    });

    return () => {
      pickerRef.current?.destroy();
      pickerRef.current = null;
    };
  }, [from, to]);

  useEffect(() => {
    if (!pickerRef.current) {
      return;
    }

    const dateValues = from && to ? [from, to] : from ? [from] : [];
    pendingRangeRef.current = { from, to };
    pickerRef.current.setDate(dateValues, false, "Y-m-d");
  }, [from, to]);

  return (
    <div className="integrated-date-range">
      <div className="integrated-date-picker-wrap">
        <input
          ref={inputRef}
          type="text"
          className="integrated-date-picker-input"
          aria-label="Date range"
          placeholder="Select date range"
          readOnly
        />
      </div>

      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
    </div>
  );
}

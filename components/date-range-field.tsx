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

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
      onChange: (selectedDates: Date[]) => {
        const start = selectedDates[0] ? toInputDate(selectedDates[0]) : "";
        const end = selectedDates[1] ? toInputDate(selectedDates[1]) : "";
        onChangeRef.current({ from: start, to: end });
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

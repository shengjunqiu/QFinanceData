import { useState } from "react";

export const timeRanges = ["1D", "1M", "3M", "1Y", "5Y", "MAX"] as const;

export type TimeRange = (typeof timeRanges)[number];

type TimeRangeControlProps = {
  defaultValue?: TimeRange;
  value?: TimeRange;
  onChange?: (range: TimeRange) => void;
};

export function TimeRangeControl({ defaultValue = "1Y", onChange, value }: TimeRangeControlProps) {
  const [internalRange, setInternalRange] = useState<TimeRange>(defaultValue);
  const selectedRange = value ?? internalRange;

  function selectRange(range: TimeRange) {
    if (value === undefined) {
      setInternalRange(range);
    }

    onChange?.(range);
  }

  return (
    <div className="range-control" aria-label="Time range">
      {timeRanges.map((range) => (
        <button
          aria-pressed={selectedRange === range}
          className={selectedRange === range ? "range-button range-button-active" : "range-button"}
          key={range}
          onClick={() => selectRange(range)}
          type="button"
        >
          {range}
        </button>
      ))}
    </div>
  );
}

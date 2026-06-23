import { useState } from "react";

const ranges = ["1D", "1M", "3M", "1Y", "5Y", "MAX"] as const;

export type TimeRange = (typeof ranges)[number];

export function TimeRangeControl() {
  const [selectedRange, setSelectedRange] = useState<TimeRange>("1Y");

  return (
    <div className="range-control" aria-label="Time range">
      {ranges.map((range) => (
        <button
          aria-pressed={selectedRange === range}
          className={selectedRange === range ? "range-button range-button-active" : "range-button"}
          key={range}
          onClick={() => setSelectedRange(range)}
          type="button"
        >
          {range}
        </button>
      ))}
    </div>
  );
}

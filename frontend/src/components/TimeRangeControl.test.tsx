import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { timeRanges, TimeRangeControl } from "./TimeRangeControl";

describe("TimeRangeControl", () => {
  it("renders every supported range", () => {
    const markup = renderToStaticMarkup(<TimeRangeControl />);

    for (const range of timeRanges) {
      expect(markup).toContain(`>${range}</button>`);
    }
  });

  it("marks the default range as pressed", () => {
    const markup = renderToStaticMarkup(<TimeRangeControl defaultValue="3M" />);

    expect(markup).toMatch(/aria-pressed="true" class="range-button range-button-active" type="button">3M<\/button>/);
  });

  it("supports controlled selected range rendering", () => {
    const markup = renderToStaticMarkup(<TimeRangeControl value="MAX" />);

    expect(markup).toMatch(/aria-pressed="true" class="range-button range-button-active" type="button">MAX<\/button>/);
  });
});

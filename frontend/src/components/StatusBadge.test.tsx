import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { DataStatus } from "../api/types";
import { dataStatusLabels, StatusBadge } from "./StatusBadge";

const statuses: DataStatus[] = ["fresh", "stale", "missing", "failed", "partial"];

describe("StatusBadge", () => {
  it("renders a label and status-specific class for every data status", () => {
    for (const status of statuses) {
      const markup = renderToStaticMarkup(<StatusBadge status={status} />);

      expect(markup).toContain(`status-${status}`);
      expect(markup).toContain(dataStatusLabels[status]);
    }
  });

  it("supports a custom display label", () => {
    const markup = renderToStaticMarkup(<StatusBadge label="新鲜" status="fresh" />);

    expect(markup).toContain("status-fresh");
    expect(markup).toContain("新鲜");
  });
});

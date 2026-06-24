import { useEffect, useMemo, useRef } from "react";
import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

import type { PriceBar } from "../api/types";

echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

type ReturnChartProps = {
  series: PriceBar[][];
  seriesName?: string;
};

export function ReturnChart({ series, seriesName = "Equal weight return" }: ReturnChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const normalizedSeries = useMemo(() => buildEqualWeightReturnSeries(series), [series]);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    const chart = echarts.init(chartRef.current);
    chart.setOption({
      grid: { left: 46, right: 18, top: 20, bottom: 30 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: number) => `${value.toFixed(2)}%`
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: normalizedSeries.map((point) => point.date),
        axisLabel: {
          color: "#66758d",
          hideOverlap: true
        },
        axisLine: { lineStyle: { color: "#d7dee8" } },
        axisTick: { show: false }
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: "#66758d",
          formatter: "{value}%"
        },
        splitLine: { lineStyle: { color: "#e3e9f0" } }
      },
      series: [
        {
          name: seriesName,
          type: "line",
          data: normalizedSeries.map((point) => point.returnPct),
          showSymbol: false,
          lineStyle: {
            color: "#1b6c8c",
            width: 2
          },
          areaStyle: {
            color: "rgba(27, 108, 140, 0.12)"
          }
        }
      ]
    });

    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [normalizedSeries, seriesName]);

  return <div className="return-chart" ref={chartRef} />;
}

function buildEqualWeightReturnSeries(series: PriceBar[][]) {
  const activeSeries = series.filter((bars) => bars.length > 0);

  if (activeSeries.length === 0) {
    return [];
  }

  const minLength = Math.min(...activeSeries.map((bars) => bars.length));
  const alignedSeries = activeSeries.map((bars) => bars.slice(-minLength));

  return alignedSeries[0].map((bar, index) => {
    const returnPct =
      alignedSeries.reduce((total, bars) => {
        const firstClose = bars[0].adjClose || bars[0].close;
        const currentClose = bars[index].adjClose || bars[index].close;

        return total + ((currentClose - firstClose) / firstClose) * 100;
      }, 0) / alignedSeries.length;

    return {
      date: bar.timestamp,
      returnPct: Math.round(returnPct * 100) / 100
    };
  });
}

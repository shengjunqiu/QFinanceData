import { useEffect, useMemo, useRef } from "react";
import { BarChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

import type { PriceBar } from "../api/types";

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

type VolumeChartProps = {
  bars: PriceBar[];
};

export function VolumeChart({ bars }: VolumeChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartData = useMemo(
    () => ({
      dates: bars.map((bar) => bar.timestamp),
      volumes: bars.map((bar) => bar.volume)
    }),
    [bars]
  );

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    const chart = echarts.init(chartRef.current);
    chart.setOption({
      animation: false,
      grid: { left: 54, right: 18, top: 12, bottom: 28 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(value)
      },
      xAxis: {
        type: "category",
        data: chartData.dates,
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
          formatter: (value: number) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(value)
        },
        splitLine: { lineStyle: { color: "#e3e9f0" } }
      },
      series: [
        {
          name: "Volume",
          type: "bar",
          data: chartData.volumes,
          itemStyle: {
            color: "#7b8da8"
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
  }, [chartData]);

  return <div className="volume-chart" ref={chartRef} />;
}

import { useEffect, useMemo, useRef } from "react";
import { CandlestickChart, LineChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

import type { PriceBar } from "../api/types";

echarts.use([CandlestickChart, DataZoomComponent, GridComponent, LegendComponent, LineChart, TooltipComponent, CanvasRenderer]);

type PriceChartProps = {
  bars: PriceBar[];
  seriesLabels?: {
    adjClose: string;
    ohlc: string;
  };
};

const defaultSeriesLabels = {
  adjClose: "Adj Close",
  ohlc: "OHLC"
};

export function PriceChart({ bars, seriesLabels = defaultSeriesLabels }: PriceChartProps) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartData = useMemo(
    () => ({
      dates: bars.map((bar) => bar.timestamp),
      candles: bars.map((bar) => [bar.open, bar.close, bar.low, bar.high]),
      adjClose: bars.map((bar) => bar.adjClose)
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
      dataZoom: [
        {
          type: "inside",
          start: 58,
          end: 100
        },
        {
          bottom: 0,
          height: 20,
          start: 58,
          end: 100,
          type: "slider"
        }
      ],
      grid: { left: 54, right: 18, top: 34, bottom: 46 },
      legend: {
        right: 18,
        top: 0,
        textStyle: { color: "#66758d" }
      },
      tooltip: {
        trigger: "axis"
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
        scale: true,
        axisLabel: { color: "#66758d" },
        splitLine: { lineStyle: { color: "#e3e9f0" } }
      },
      series: [
        {
          name: seriesLabels.ohlc,
          type: "candlestick",
          data: chartData.candles,
          itemStyle: {
            color: "#11673b",
            color0: "#a13c36",
            borderColor: "#11673b",
            borderColor0: "#a13c36"
          }
        },
        {
          name: seriesLabels.adjClose,
          type: "line",
          data: chartData.adjClose,
          showSymbol: false,
          smooth: true,
          lineStyle: {
            color: "#1b6c8c",
            width: 1.8
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
  }, [chartData, seriesLabels]);

  return <div className="price-chart" ref={chartRef} />;
}

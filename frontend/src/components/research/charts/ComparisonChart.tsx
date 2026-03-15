import React from 'react';
import Chart from 'react-apexcharts';
import type { ChartData } from '../../../types/research.types';

interface ComparisonChartProps {
  chartData: ChartData;
  height?: number;
}

export default function ComparisonChart({ chartData, height = 400 }: ComparisonChartProps) {
  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'line',
      height: height,
      toolbar: {
        show: true,
      },
      zoom: {
        enabled: true,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    xaxis: {
      type: chartData.xAxis?.type === 'datetime' ? 'datetime' : 'category',
      title: {
        text: chartData.xAxis?.title || 'Date',
      },
    },
    yaxis: {
      title: {
        text: chartData.yAxis?.title || 'Price (USD)',
      },
      min: chartData.yAxis?.min,
      max: chartData.yAxis?.max,
    },
    title: {
      text: chartData.title,
      align: 'left',
      style: {
        fontSize: '18px',
        fontWeight: 600,
      },
    },
    colors: chartData.series.map(s => s.color || '#3b82f6'),
    tooltip: {
      x: {
        format: chartData.xAxis?.type === 'datetime' ? 'dd MMM yyyy' : undefined,
      },
      y: {
        formatter: (value: number) => `$${value.toFixed(2)}`,
      },
      shared: true,
    },
    legend: {
      position: 'top',
      horizontalAlign: 'right',
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    theme: {
      mode: 'dark',
    },
  };

  const series = chartData.series.map(s => ({
    name: s.name,
    data: s.data,
  }));

  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '8px' }}>
      <Chart options={options} series={series} type="line" height={height} />
    </div>
  );
}

import React from 'react';
import Chart from 'react-apexcharts';
import type { ChartData } from '../../../types/research.types';

interface StockChartProps {
  chartData: ChartData;
  height?: number;
}

export default function StockChart({ chartData, height = 350 }: StockChartProps) {
  const options: ApexCharts.ApexOptions = {
    chart: {
      type: chartData.type === 'line' ? 'line' : chartData.type === 'area' ? 'area' : 'line',
      height: height,
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
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
        fontSize: '16px',
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
    },
    annotations: chartData.annotations ? {
      points: chartData.annotations.map(ann => ({
        x: ann.x,
        y: 0,
        marker: {
          size: 4,
          fillColor: '#fff',
          strokeColor: '#3b82f6',
          radius: 2,
        },
        label: {
          text: ann.text,
          style: {
            color: '#fff',
            fontSize: '12px',
          },
        },
      })),
    } : undefined,
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
      <Chart options={options} series={series} type={chartData.type === 'line' ? 'line' : chartData.type === 'area' ? 'area' : 'line'} height={height} />
    </div>
  );
}

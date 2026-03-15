import React from 'react';
import Chart from 'react-apexcharts';
import type { SentimentData } from '../../../types/research.types';

interface SentimentChartProps {
  sentimentData: SentimentData;
  height?: number;
}

export default function SentimentChart({ sentimentData, height = 300 }: SentimentChartProps) {
  const breakdown = sentimentData.breakdown || [];
  
  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'line',
      height: height,
      toolbar: {
        show: false,
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `${val > 0 ? '+' : ''}${val.toFixed(0)}`,
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    xaxis: {
      categories: breakdown.map(b => b.period),
      title: {
        text: 'Time Period',
      },
    },
    yaxis: {
      title: {
        text: 'Sentiment Score',
      },
      min: -100,
      max: 100,
    },
    title: {
      text: 'Sentiment Over Time',
      align: 'left',
      style: {
        fontSize: '16px',
        fontWeight: 600,
      },
    },
    colors: ['#10b981'],
    fill: {
      type: 'gradient',
      gradient: {
        shade: 'dark',
        type: 'vertical',
        shadeIntensity: 0.5,
        gradientToColors: ['#ef4444'],
        inverseColors: true,
        opacityFrom: 0.8,
        opacityTo: 0.2,
        stops: [0, 50, 100],
      },
    },
    tooltip: {
      y: {
        formatter: (val: number) => {
          const label = val > 50 ? 'Very Positive' : val > 10 ? 'Positive' : val < -50 ? 'Very Negative' : val < -10 ? 'Negative' : 'Neutral';
          return `${label} (${val > 0 ? '+' : ''}${val.toFixed(0)})`;
        },
      },
    },
    annotations: {
      yaxis: [
        {
          y: 0,
          borderColor: '#6b7280',
          borderWidth: 1,
          strokeDashArray: 5,
          label: {
            text: 'Neutral',
            style: {
              color: '#6b7280',
            },
          },
        },
      ],
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    theme: {
      mode: 'dark',
    },
  };

  const series = [{
    name: 'Sentiment Score',
    data: breakdown.map(b => b.sentiment),
  }];

  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '8px' }}>
      <Chart options={options} series={series} type="area" height={height} />
    </div>
  );
}

import React from 'react';
import Chart from 'react-apexcharts';
import type { PredictionData } from '../../../types/research.types';

interface PredictionChartProps {
  predictionData: PredictionData;
  currentPrice: number;
  height?: number;
}

export default function PredictionChart({ predictionData, currentPrice, height = 350 }: PredictionChartProps) {
  const periods = [
    { label: '30 Days', data: predictionData.shortTerm, color: '#3b82f6' },
    { label: '6 Months', data: predictionData.mediumTerm, color: '#10b981' },
    { label: '1 Year', data: predictionData.longTerm, color: '#f59e0b' },
  ];

  const categories = periods.map(p => p.label);
  const predictions = periods.map(p => currentPrice * (1 + p.data.prediction / 100));
  const confidences = periods.map(p => p.data.confidence);
  const ranges = periods.map(p => p.data.range);

  const options: ApexCharts.ApexOptions = {
    chart: {
      type: 'bar',
      height: height,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '50%',
        dataLabels: {
          position: 'top',
        },
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number) => `$${val.toFixed(2)}`,
      offsetY: -20,
      style: {
        fontSize: '12px',
        colors: ['#fff'],
      },
    },
    xaxis: {
      categories,
      title: {
        text: 'Time Period',
      },
    },
    yaxis: {
      title: {
        text: 'Predicted Price (USD)',
      },
      min: Math.min(...ranges.flat()) * 0.9,
      max: Math.max(...ranges.flat()) * 1.1,
    },
    title: {
      text: 'Price Predictions with Confidence Intervals',
      align: 'left',
      style: {
        fontSize: '16px',
        fontWeight: 600,
      },
    },
    colors: periods.map(p => p.color),
    tooltip: {
      y: {
        formatter: (val: number, opts: any) => {
          const idx = opts.dataPointIndex;
          const pred = periods[idx].data;
          const change = ((val - currentPrice) / currentPrice) * 100;
          return `$${val.toFixed(2)} (${change > 0 ? '+' : ''}${change.toFixed(2)}%)<br/>Confidence: ${pred.confidence}%<br/>Range: $${pred.range[0].toFixed(2)} - $${pred.range[1].toFixed(2)}`;
        },
      },
    },
    annotations: {
      yaxis: [
        {
          y: currentPrice,
          borderColor: '#6b7280',
          borderWidth: 2,
          strokeDashArray: 5,
          label: {
            text: `Current: $${currentPrice.toFixed(2)}`,
            style: {
              color: '#6b7280',
              fontSize: '12px',
            },
            position: 'right',
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
    name: 'Predicted Price',
    data: predictions,
  }];

  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '8px' }}>
      <Chart options={options} series={series} type="bar" height={height} />
      <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
        <p><strong>Trend:</strong> {predictionData.trendDirection}</p>
        <p><strong>Methodology:</strong> {predictionData.methodology}</p>
        <p style={{ marginTop: '8px', fontStyle: 'italic' }}>{predictionData.disclaimer}</p>
      </div>
    </div>
  );
}

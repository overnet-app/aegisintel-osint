import React from 'react';
import Chart from 'react-apexcharts';
import type { SentimentData } from '../../types/research.types';

interface SentimentIndicatorProps {
  sentimentData: SentimentData;
}

export default function SentimentIndicator({ sentimentData }: SentimentIndicatorProps) {
  const score = sentimentData.score;
  const overall = sentimentData.overall;
  const breakdown = sentimentData.breakdown || [];
  const sources = sentimentData.sources || [];

  // Color based on sentiment
  const getColor = () => {
    if (score >= 50) return '#10b981'; // Very positive - green
    if (score >= 10) return '#84cc16'; // Positive - light green
    if (score <= -50) return '#ef4444'; // Very negative - red
    if (score <= -10) return '#f97316'; // Negative - orange
    return '#6b7280'; // Neutral - gray
  };

  const getLabel = () => {
    if (overall === 'very_positive') return 'Very Positive';
    if (overall === 'positive') return 'Positive';
    if (overall === 'very_negative') return 'Very Negative';
    if (overall === 'negative') return 'Negative';
    return 'Neutral';
  };

  const gaugeOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'radialBar',
      height: 200,
    },
    plotOptions: {
      radialBar: {
        hollow: {
          size: '70%',
        },
        track: {
          background: 'rgba(255, 255, 255, 0.1)',
        },
        dataLabels: {
          name: {
            show: true,
            fontSize: '16px',
            fontWeight: 600,
            offsetY: -10,
          },
          value: {
            show: true,
            fontSize: '24px',
            fontWeight: 700,
            formatter: (val: number) => `${val > 0 ? '+' : ''}${val.toFixed(0)}`,
            offsetY: 10,
          },
        },
      },
    },
    fill: {
      colors: [getColor()],
    },
    labels: [getLabel()],
    theme: {
      mode: 'dark',
    },
  };

  const gaugeSeries = [Math.abs(score)];

  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '8px' }}>
      <h4 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Sentiment Analysis</h4>
      
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ flex: '0 0 200px' }}>
          <Chart options={gaugeOptions} series={gaugeSeries} type="radialBar" height={200} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: '12px' }}>
            <p style={{ fontSize: '14px', marginBottom: '4px' }}>
              <strong>Overall Sentiment:</strong> <span style={{ color: getColor() }}>{getLabel()}</span>
            </p>
            <p style={{ fontSize: '14px', marginBottom: '4px' }}>
              <strong>Score:</strong> {score > 0 ? '+' : ''}{score.toFixed(0)} / ±100
            </p>
            <p style={{ fontSize: '14px' }}>
              <strong>Articles Analyzed:</strong> {sources.length}
            </p>
          </div>
        </div>
      </div>

      {/* Key Events Timeline */}
      {breakdown.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h5 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>Sentiment by Period</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {breakdown.map((period, idx) => (
              <div key={idx} style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>{period.period}</span>
                  <span style={{ fontSize: '13px', color: period.sentiment >= 0 ? '#10b981' : '#ef4444' }}>
                    {period.sentiment > 0 ? '+' : ''}{period.sentiment.toFixed(0)}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {period.newsCount} articles
                  {period.keyEvents && period.keyEvents.length > 0 && (
                    <span style={{ marginLeft: '8px' }}>
                      • {period.keyEvents.slice(0, 2).join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sample Headlines */}
      {sources.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h5 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>Sample Headlines</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {sources.slice(0, 5).map((source, idx) => (
              <div key={idx} style={{ fontSize: '12px', padding: '6px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '4px' }}>
                <span style={{ marginRight: '8px', color: source.sentiment >= 0 ? '#10b981' : '#ef4444' }}>
                  {source.sentiment >= 0 ? '📈' : '📉'}
                </span>
                <span>{source.headline.substring(0, 80)}...</span>
                <a 
                  href={source.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ marginLeft: '8px', color: '#3b82f6', textDecoration: 'none' }}
                >
                  View
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

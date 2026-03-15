import React from 'react';
import type { PredictionData } from '../../types/research.types';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PredictionCardProps {
  predictionData: PredictionData;
  currentPrice: number;
}

export default function PredictionCard({ predictionData, currentPrice }: PredictionCardProps) {
  const periods = [
    { label: 'Short Term (30 Days)', data: predictionData.shortTerm, icon: '📅' },
    { label: 'Medium Term (6 Months)', data: predictionData.mediumTerm, icon: '📊' },
    { label: 'Long Term (1 Year)', data: predictionData.longTerm, icon: '📈' },
  ];

  const getTrendIcon = () => {
    if (predictionData.trendDirection === 'bullish') return <TrendingUp size={20} style={{ color: '#10b981' }} />;
    if (predictionData.trendDirection === 'bearish') return <TrendingDown size={20} style={{ color: '#ef4444' }} />;
    return <Minus size={20} style={{ color: '#6b7280' }} />;
  };

  const getTrendColor = () => {
    if (predictionData.trendDirection === 'bullish') return '#10b981';
    if (predictionData.trendDirection === 'bearish') return '#ef4444';
    return '#6b7280';
  };

  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h4 style={{ fontSize: '16px', fontWeight: 600 }}>AI Predictions</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {getTrendIcon()}
          <span style={{ fontSize: '14px', fontWeight: 600, color: getTrendColor() }}>
            {predictionData.trendDirection.toUpperCase()}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {periods.map((period, idx) => {
          const predictedPrice = currentPrice * (1 + period.data.prediction / 100);
          const change = ((predictedPrice - currentPrice) / currentPrice) * 100;
          const confidence = period.data.confidence;

          return (
            <div key={idx} style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '20px' }}>{period.icon}</span>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{period.label}</span>
              </div>
              
              <div style={{ marginBottom: '8px' }}>
                <p style={{ fontSize: '20px', fontWeight: 700, color: change >= 0 ? '#10b981' : '#ef4444' }}>
                  ${predictedPrice.toFixed(2)}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {change > 0 ? '+' : ''}{change.toFixed(2)}% from current
                </p>
              </div>

              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Confidence:</span>
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>{confidence}%</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${confidence}%`, 
                      height: '100%', 
                      background: confidence >= 70 ? '#10b981' : confidence >= 50 ? '#f59e0b' : '#ef4444',
                      transition: 'width 0.3s ease',
                    }} 
                  />
                </div>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Range: ${period.data.range[0].toFixed(2)} - ${period.data.range[1].toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', marginBottom: '12px' }}>
        <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Methodology:</p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{predictionData.methodology}</p>
      </div>

      <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        <p style={{ fontSize: '11px', color: '#ef4444', fontStyle: 'italic' }}>⚠️ {predictionData.disclaimer}</p>
      </div>
    </div>
  );
}

import React from 'react';
import type { StatisticalData } from '../../../types/research.types';

interface StatisticsTableProps {
  statistics: StatisticalData;
}

export default function StatisticsTable({ statistics }: StatisticsTableProps) {
  const comparison = statistics.comparison;
  const summary = statistics.summary;

  if (!comparison) {
    return (
      <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '8px' }}>
        <h4 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Year-by-Year Performance</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <th style={{ padding: '8px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Year</th>
              <th style={{ padding: '8px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>Return</th>
              <th style={{ padding: '8px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>End Price</th>
            </tr>
          </thead>
          <tbody>
            {statistics.yearlyReturns.map((yr, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <td style={{ padding: '8px', fontSize: '13px' }}>{yr.year}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontSize: '13px', color: yr.return >= 0 ? '#10b981' : '#ef4444' }}>
                  {yr.return > 0 ? '+' : ''}{yr.return.toFixed(2)}%
                </td>
                <td style={{ padding: '8px', textAlign: 'right', fontSize: '13px' }}>${yr.endPrice.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const symbols = comparison.symbols;

  return (
    <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '16px', borderRadius: '8px' }}>
      <h4 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>Comparison Statistics</h4>
      
      {/* Summary Metrics Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <th style={{ padding: '8px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Metric</th>
            {symbols.map(sym => (
              <th key={sym} style={{ padding: '8px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>{sym}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <td style={{ padding: '8px', fontSize: '13px' }}>CAGR</td>
            {symbols.map(sym => (
              <td key={sym} style={{ padding: '8px', textAlign: 'right', fontSize: '13px' }}>
                {comparison.cagr[sym] ? `${comparison.cagr[sym].toFixed(2)}%` : 'N/A'}
              </td>
            ))}
          </tr>
          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <td style={{ padding: '8px', fontSize: '13px' }}>Volatility</td>
            {symbols.map(sym => (
              <td key={sym} style={{ padding: '8px', textAlign: 'right', fontSize: '13px' }}>
                {comparison.volatility[sym] ? `${comparison.volatility[sym].toFixed(2)}%` : 'N/A'}
              </td>
            ))}
          </tr>
          {comparison.sharpeRatio && (
            <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <td style={{ padding: '8px', fontSize: '13px' }}>Sharpe Ratio</td>
              {symbols.map(sym => (
                <td key={sym} style={{ padding: '8px', textAlign: 'right', fontSize: '13px' }}>
                  {comparison.sharpeRatio![sym] ? comparison.sharpeRatio![sym].toFixed(2) : 'N/A'}
                </td>
              ))}
            </tr>
          )}
          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <td style={{ padding: '8px', fontSize: '13px' }}>Max Drawdown</td>
            {symbols.map(sym => (
              <td key={sym} style={{ padding: '8px', textAlign: 'right', fontSize: '13px', color: '#ef4444' }}>
                {comparison.maxDrawdown[sym] ? `-${comparison.maxDrawdown[sym].toFixed(2)}%` : 'N/A'}
              </td>
            ))}
          </tr>
          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <td style={{ padding: '8px', fontSize: '13px' }}>Total Return</td>
            {symbols.map(sym => (
              <td key={sym} style={{ padding: '8px', textAlign: 'right', fontSize: '13px', color: (summary.totalReturn[sym] || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                {summary.totalReturn[sym] ? `${summary.totalReturn[sym] > 0 ? '+' : ''}${summary.totalReturn[sym].toFixed(2)}%` : 'N/A'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      {/* Year-by-Year Returns */}
      <h5 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>Year-by-Year Returns</h5>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <th style={{ padding: '8px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Year</th>
            {symbols.map(sym => (
              <th key={sym} style={{ padding: '8px', textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>{sym}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from(new Set(statistics.yearlyReturns.map(yr => yr.year))).sort().map(year => (
            <tr key={year} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <td style={{ padding: '8px', fontSize: '13px' }}>{year}</td>
              {symbols.map(sym => {
                const yr = statistics.yearlyReturns.find(y => y.year === year && y.symbol === sym);
                return (
                  <td key={sym} style={{ padding: '8px', textAlign: 'right', fontSize: '13px', color: (yr?.return || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                    {yr ? `${yr.return > 0 ? '+' : ''}${yr.return.toFixed(2)}%` : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Best/Worst Years */}
      <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <h5 style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Best Year</h5>
          {symbols.map(sym => {
            const best = summary.bestYear[sym];
            return best ? (
              <p key={sym} style={{ fontSize: '12px', marginBottom: '4px' }}>
                {sym}: {best.year} ({best.return > 0 ? '+' : ''}{best.return.toFixed(2)}%)
              </p>
            ) : null;
          })}
        </div>
        <div>
          <h5 style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 600 }}>Worst Year</h5>
          {symbols.map(sym => {
            const worst = summary.worstYear[sym];
            return worst ? (
              <p key={sym} style={{ fontSize: '12px', marginBottom: '4px' }}>
                {sym}: {worst.year} ({worst.return > 0 ? '+' : ''}{worst.return.toFixed(2)}%)
              </p>
            ) : null;
          })}
        </div>
      </div>
    </div>
  );
}

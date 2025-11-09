/**
 * Quality Metrics Display Component
 *
 * Visualizes blend quality metrics with:
 * - Individual metric scores (0-1 scale)
 * - Overall blend quality (0-100 scale)
 * - Metric descriptions and interpretations
 * - Real-time visual feedback
 *
 * Architecture:
 * - Stateless functional component
 * - Responsive card-based layout
 * - Animated progress bars
 * - Color-coded quality indicators
 *
 * Author: Kinetic Ledger Team
 * License: MIT
 */

'use client';

import React from 'react';

/**
 * Quality metrics structure
 */
interface QualityMetrics {
  /** Velocity continuity score (0-1): smoothness of velocity across transition */
  velocity_continuity: number;
  /** Acceleration smoothness score (0-1): consistency of acceleration */
  acceleration_smoothness: number;
  /** Foot contact stability score (0-1): prevention of ground penetration */
  foot_contact_stability: number;
  /** Overall blend quality score (0-100) */
  overall_score: number;
}

/**
 * Props for QualityMetricsDisplay component
 */
interface QualityMetricsDisplayProps {
  /** Quality metrics to display */
  metrics: QualityMetrics;
}

/**
 * Helper: Get color based on metric score
 */
const getScoreColor = (score: number): string => {
  if (score >= 0.8) return '#27ae60'; // Green - Excellent
  if (score >= 0.6) return '#f39c12'; // Orange - Good
  if (score >= 0.4) return '#e67e22'; // Dark Orange - Fair
  return '#e74c3c'; // Red - Poor
};

/**
 * Helper: Get score interpretation text
 */
const getScoreInterpretation = (score: number): string => {
  if (score >= 0.8) return 'Excellent';
  if (score >= 0.6) return 'Good';
  if (score >= 0.4) return 'Fair';
  return 'Needs Improvement';
};

/**
 * Helper: Normalize 0-100 score to 0-1 for metric cards
 */
const normalizeScore = (score: number): number => {
  return Math.min(Math.max(score / 100, 0), 1);
};

/**
 * Metric Card Sub-component
 */
const MetricCard: React.FC<{
  title: string;
  score: number;
  description: string;
  icon: string;
}> = ({ title, score, description, icon }) => {
  const color = getScoreColor(score);
  const interpretation = getScoreInterpretation(score);
  const percentage = (score * 100).toFixed(1);

  return (
    <div className="metric-card">
      <div className="metric-header">
        <div className="metric-icon">{icon}</div>
        <div className="metric-title-section">
          <h3 className="metric-title">{title}</h3>
          <p className="metric-description">{description}</p>
        </div>
      </div>

      <div className="metric-score-section">
        <div className="metric-bar-container">
          <div
            className="metric-bar-fill"
            style={{
              width: `${percentage}%`,
              backgroundColor: color,
            }}
          />
        </div>

        <div className="metric-score-display">
          <span
            className="metric-percentage"
            style={{ color }}
          >
            {percentage}%
          </span>
          <span className="metric-interpretation">{interpretation}</span>
        </div>
      </div>

      <style jsx>{`
        .metric-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 1.5rem;
          transition: all 0.3s ease;
        }

        .metric-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          border-color: #3498db;
        }

        .metric-header {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
          align-items: flex-start;
        }

        .metric-icon {
          font-size: 2rem;
          flex-shrink: 0;
        }

        .metric-title-section {
          flex: 1;
        }

        .metric-title {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: #333;
        }

        .metric-description {
          margin: 0.25rem 0 0;
          font-size: 0.85rem;
          color: #999;
        }

        .metric-score-section {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .metric-bar-container {
          width: 100%;
          height: 8px;
          background: #f0f0f0;
          border-radius: 4px;
          overflow: hidden;
        }

        .metric-bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: all 0.3s ease;
        }

        .metric-score-display {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .metric-percentage {
          font-weight: 700;
          font-size: 1rem;
        }

        .metric-interpretation {
          font-size: 0.85rem;
          color: #666;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

/**
 * Overall Score Gauge Sub-component
 */
const OverallScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const normalized = normalizeScore(score);
  const color = getScoreColor(normalized);
  const percentage = score.toFixed(1);

  return (
    <div className="gauge-container">
      <div className="gauge-visual">
        <div className="gauge-background">
          <svg width="180" height="100" viewBox="0 0 180 100">
            {/* Background arc */}
            <path
              d="M 20 80 A 60 60 0 0 1 160 80"
              stroke="#e0e0e0"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
            />

            {/* Progress arc */}
            <path
              d="M 20 80 A 60 60 0 0 1 160 80"
              stroke={color}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${125.6 * normalized} 125.6`}
              opacity="0.9"
              style={{
                transition: 'stroke-dasharray 0.5s ease',
              }}
            />
          </svg>

          <div className="gauge-value">
            <div className="gauge-number">{percentage}</div>
            <div className="gauge-unit">/100</div>
          </div>
        </div>

        <div className="gauge-label">
          <h3>Overall Quality</h3>
          <p>{getScoreInterpretation(normalized)}</p>
        </div>
      </div>

      <style jsx>{`
        .gauge-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .gauge-visual {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .gauge-background {
          position: relative;
          width: 180px;
          height: 100px;
        }

        .gauge-value {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          text-align: center;
        }

        .gauge-number {
          font-size: 2rem;
          font-weight: 700;
          color: ${color};
        }

        .gauge-unit {
          font-size: 0.75rem;
          color: #999;
          margin-top: -0.25rem;
        }

        .gauge-label {
          text-align: center;
        }

        .gauge-label h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #333;
        }

        .gauge-label p {
          margin: 0.25rem 0 0;
          font-size: 0.9rem;
          color: #666;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
};

/**
 * Quality Metrics Display Component
 *
 * Shows comprehensive blend quality information including:
 * - Individual metric scores with interpretations
 * - Overall quality gauge
 * - Visual indicators
 * - Detailed descriptions
 *
 * @param props Component props
 * @returns JSX.Element
 */
export default function QualityMetricsDisplay({
  metrics,
}: QualityMetricsDisplayProps) {
  console.warn('🚀 QualityMetricsDisplay: ENTRY', metrics);

  return (
    <div className="quality-metrics-display">
      {/* Overall Score Section */}
      <div className="overall-score-section">
        <OverallScoreGauge score={metrics.overall_score} />
      </div>

      {/* Individual Metrics Grid */}
      <div className="metrics-grid">
        <MetricCard
          title="Velocity Continuity"
          score={metrics.velocity_continuity}
          description="Smoothness of joint velocity across transition"
          icon="🌊"
        />

        <MetricCard
          title="Acceleration Smoothness"
          score={metrics.acceleration_smoothness}
          description="Consistency of acceleration throughout blend"
          icon="⚡"
        />

        <MetricCard
          title="Foot Contact Stability"
          score={metrics.foot_contact_stability}
          description="Prevention of ground penetration and jitter"
          icon="🦶"
        />
      </div>

      {/* Quality Interpretation Section */}
      <div className="quality-interpretation">
        <h3>📊 Quality Analysis</h3>

        <div className="interpretation-content">
          {metrics.overall_score >= 80 ? (
            <div className="interpretation-item success">
              <span className="icon">✅</span>
              <div>
                <strong>Excellent Blend Quality</strong>
                <p>
                  This blend achieves exceptional smoothness with minimal
                  artifacts. Ready for professional use and NFT minting.
                </p>
              </div>
            </div>
          ) : metrics.overall_score >= 60 ? (
            <div className="interpretation-item good">
              <span className="icon">👍</span>
              <div>
                <strong>Good Blend Quality</strong>
                <p>
                  This blend is smooth with minor imperfections. Suitable for
                  most applications and ready for minting.
                </p>
              </div>
            </div>
          ) : metrics.overall_score >= 40 ? (
            <div className="interpretation-item fair">
              <span className="icon">⚠️</span>
              <div>
                <strong>Fair Blend Quality</strong>
                <p>
                  This blend has noticeable imperfections. Consider adjusting
                  parameters for better results.
                </p>
              </div>
            </div>
          ) : (
            <div className="interpretation-item poor">
              <span className="icon">❌</span>
              <div>
                <strong>Poor Blend Quality</strong>
                <p>
                  This blend has significant issues. Try different source
                  motions or adjust parameters.
                </p>
              </div>
            </div>
          )}

          <div className="metric-tips">
            <h4>💡 Optimization Tips</h4>
            <ul>
              {metrics.velocity_continuity < 0.7 && (
                <li>
                  Try increasing transition frames for smoother velocity
                  transitions
                </li>
              )}
              {metrics.acceleration_smoothness < 0.7 && (
                <li>Adjust blend weight to reduce acceleration spikes</li>
              )}
              {metrics.foot_contact_stability < 0.7 && (
                <li>Check source motions for foot skating issues</li>
              )}
              {metrics.overall_score >= 80 && (
                <li>Great blend! This is ready for minting as NFT</li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <style jsx>{`
        .quality-metrics-display {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .overall-score-section {
          background: linear-gradient(135deg, #f8f9fa 0%, #f0f0f0 100%);
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 2rem;
          display: flex;
          justify-content: center;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .quality-interpretation {
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 1.5rem;
        }

        .quality-interpretation h3 {
          margin: 0 0 1rem;
          font-size: 1.1rem;
          color: #333;
        }

        .interpretation-content {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .interpretation-item {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          border-radius: 4px;
          border-left: 4px solid;
        }

        .interpretation-item.success {
          background: #d5f4e6;
          border-left-color: #27ae60;
          color: #229954;
        }

        .interpretation-item.good {
          background: #fef5e7;
          border-left-color: #f39c12;
          color: #d68910;
        }

        .interpretation-item.fair {
          background: #fdecd1;
          border-left-color: #e67e22;
          color: #d35400;
        }

        .interpretation-item.poor {
          background: #fadbd8;
          border-left-color: #e74c3c;
          color: #c0392b;
        }

        .interpretation-item .icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .interpretation-item strong {
          display: block;
          margin-bottom: 0.25rem;
        }

        .interpretation-item p {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.4;
        }

        .metric-tips {
          background: white;
          padding: 1rem;
          border-radius: 4px;
          border: 1px solid #e0e0e0;
        }

        .metric-tips h4 {
          margin: 0 0 0.75rem;
          font-size: 0.95rem;
          color: #333;
        }

        .metric-tips ul {
          margin: 0;
          padding-left: 1.5rem;
          list-style: none;
        }

        .metric-tips li {
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
          color: #666;
          padding-left: 1.5rem;
          position: relative;
        }

        .metric-tips li:before {
          content: '→';
          position: absolute;
          left: 0;
          color: #3498db;
          font-weight: bold;
        }

        .metric-tips li:last-child {
          margin-bottom: 0;
        }

        @media (max-width: 768px) {
          .metrics-grid {
            grid-template-columns: 1fr;
          }

          .quality-metrics-display {
            gap: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}

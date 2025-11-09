/**
 * Motion Blending Page
 *
 * Main page for motion blending UI
 * Integrates MotionBlendingStudio component with layout
 *
 * Author: Kinetic Ledger Team
 * License: MIT
 */

'use client';

import React from 'react';
import MotionBlendingStudio from '@/components/MotionBlendingStudio';

/**
 * Motion Blending Page Component
 */
export default function MotionBlendingPage() {
  console.warn('🚀 MotionBlendingPage: ENTRY');

  return (
    <div className="motion-blending-page">
      <MotionBlendingStudio />

      <style jsx>{`
        .motion-blending-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8f9fa 0%, #f0f0f0 100%);
          padding: 2rem 0;
        }
      `}</style>
    </div>
  );
}

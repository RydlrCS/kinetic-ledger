import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

interface MotionSegment {
  id: string;
  type: string;
  color: string;
  duration: number;
  keyframes: string[];
  startTime: number;
}

interface Transition {
  fromSegment: string;
  toSegment: string;
  startTime: number;
  duration: number;
  type: 'cross-fade' | 'mesh' | 'morph';
}

interface MotionPreviewProps {
  segments: MotionSegment[];
  transitions: Transition[];
  totalDuration: number;
}

export default function MotionPreviewPanel({ segments, transitions, totalDuration }: MotionPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTransition, setActiveTransition] = useState<Transition | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (isPlaying) {
      const startTime = Date.now() - currentTime * 1000;
      
      const animate = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed >= totalDuration) {
          setCurrentTime(0);
          setIsPlaying(false);
        } else {
          setCurrentTime(elapsed);
          
          // Check for active transitions
          const activeTransitionItem = transitions.find(
            t => elapsed >= t.startTime && elapsed <= t.startTime + t.duration
          );
          setActiveTransition(activeTransitionItem || null);
          
          animationRef.current = requestAnimationFrame(animate);
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, totalDuration, transitions]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    setCurrentTime(percentage * totalDuration);
  };

  const togglePlayPause = () => setIsPlaying(!isPlaying);

  const getCurrentSegment = () => {
    return segments.find(
      seg => currentTime >= seg.startTime && currentTime < seg.startTime + seg.duration
    );
  };

  const currentSegment = getCurrentSegment();

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-blue-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
            <div className="w-6 h-6 border-3 border-white rounded-full border-t-transparent animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Motion Preview</h2>
            <p className="text-sm text-gray-500">Timeline-based blend visualization</p>
          </div>
        </div>
        
        {activeTransition && (
          <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-50 to-teal-50 rounded-full border border-blue-200">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-gray-700">
              Blending {segments.find(s => s.id === activeTransition.fromSegment)?.type} → {segments.find(s => s.id === activeTransition.toSegment)?.type}
            </span>
          </div>
        )}
      </div>

      {/* Motion Preview Animation Area */}
      <div className="relative mb-8 h-64 bg-gradient-to-br from-gray-50 to-blue-50 rounded-2xl overflow-hidden border border-gray-200">
        {/* Dot pattern background (Polkadot-inspired) */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }} />
        
        {/* Current motion display */}
        <div className="absolute inset-0 flex items-center justify-center">
          {currentSegment ? (
            <div className="text-center">
              <div className="w-40 h-40 mx-auto mb-4 rounded-full bg-gradient-to-br flex items-center justify-center text-white text-6xl font-bold shadow-2xl transition-all duration-500"
                style={{ 
                  background: `linear-gradient(135deg, ${currentSegment.color}, ${currentSegment.color}dd)`,
                  transform: activeTransition ? 'scale(1.1) rotate(5deg)' : 'scale(1)'
                }}>
                {currentSegment.type.charAt(0)}
              </div>
              <h3 className="text-2xl font-bold text-gray-800">{currentSegment.type}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {activeTransition ? `Transitioning (${activeTransition.type})` : 'Playing'}
              </p>
            </div>
          ) : (
            <div className="text-center text-gray-400">
              <p className="text-lg">Press play to preview motion blend</p>
            </div>
          )}
        </div>
        
        {/* Transition ripple effect */}
        {activeTransition && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 rounded-full border-4 border-blue-400 animate-ping opacity-20" />
            <div className="absolute w-48 h-48 rounded-full border-4 border-teal-400 animate-ping opacity-30 animation-delay-150" />
          </div>
        )}
      </div>

      {/* Timeline Strip with Keyframes */}
      <div className="mb-6">
        <div 
          ref={timelineRef}
          className="relative h-24 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl cursor-pointer overflow-hidden border border-gray-300"
          onClick={handleTimelineClick}
        >
          {/* Segments */}
          {segments.map((segment, idx) => (
            <div
              key={segment.id}
              className="absolute top-0 h-full flex items-center px-2 transition-all duration-300 hover:z-10"
              style={{
                left: `${(segment.startTime / totalDuration) * 100}%`,
                width: `${(segment.duration / totalDuration) * 100}%`,
                background: `linear-gradient(135deg, ${segment.color}cc, ${segment.color}99)`
              }}
            >
              {/* Keyframe thumbnails */}
              <div className="flex space-x-1 h-full items-center">
                {segment.keyframes.map((frame, i) => (
                  <div key={i} className="w-8 h-8 bg-white/40 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm">
                    {i + 1}
                  </div>
                ))}
              </div>
              
              {/* Segment label */}
              <div className="absolute bottom-1 left-2 text-xs font-semibold text-white drop-shadow-lg">
                {segment.type}
              </div>
            </div>
          ))}
          
          {/* Transition indicators */}
          {transitions.map((transition, idx) => (
            <div
              key={idx}
              className="absolute top-0 h-full border-l-2 border-r-2 border-blue-500 bg-blue-500/20"
              style={{
                left: `${(transition.startTime / totalDuration) * 100}%`,
                width: `${(transition.duration / totalDuration) * 100}%`
              }}
            >
              {/* Mesh pattern for blend region */}
              <div className="absolute inset-0 opacity-40" style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(59, 130, 246, 0.3) 5px, rgba(59, 130, 246, 0.3) 10px)'
              }} />
            </div>
          ))}
          
          {/* Playhead scrubber */}
          <div
            className="absolute top-0 h-full w-1 bg-gradient-to-b from-blue-600 to-blue-400 shadow-lg z-20 transition-all duration-100"
            style={{ left: `${(currentTime / totalDuration) * 100}%` }}
          >
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full">
              <div className="w-4 h-4 bg-blue-600 rounded-full shadow-lg border-2 border-white" />
            </div>
          </div>
        </div>
        
        {/* Timeline time markers */}
        <div className="flex justify-between mt-2 px-1 text-xs text-gray-500">
          <span>0:00</span>
          <span>{Math.floor(totalDuration / 60)}:{(totalDuration % 60).toFixed(0).padStart(2, '0')}</span>
        </div>
      </div>

      {/* Media Controls */}
      <div className="flex items-center justify-center space-x-4">
        <button className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-all duration-200 hover:scale-110">
          <SkipBack className="w-5 h-5 text-gray-700" />
        </button>
        
        <button 
          onClick={togglePlayPause}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 hover:shadow-xl"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6 text-white" />
          ) : (
            <Play className="w-6 h-6 text-white ml-1" />
          )}
        </button>
        
        <button className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-all duration-200 hover:scale-110">
          <SkipForward className="w-5 h-5 text-gray-700" />
        </button>
      </div>
      
      {/* Progress indicator */}
      <div className="mt-4 text-center text-sm text-gray-600">
        <span className="font-mono">{currentTime.toFixed(1)}s</span> / <span className="font-mono">{totalDuration.toFixed(1)}s</span>
      </div>
    </div>
  );
}

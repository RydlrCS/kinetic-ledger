import React, { useState } from 'react';
import { Plus, X, Move, Sliders, ChevronDown, ChevronUp } from 'lucide-react';

interface MotionMotif {
  id: string;
  name: string;
  color: string;
  icon: string;
  description: string;
}

interface SegmentConfig {
  id: string;
  motifId: string;
  duration: number;
  position: number;
}

interface TransitionConfig {
  id: string;
  fromSegment: string;
  toSegment: string;
  duration: number;
  curve: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

const MOTION_LIBRARY: MotionMotif[] = [
  { id: 'capoeira', name: 'Capoeira', color: '#f59e0b', icon: '🤸', description: 'Brazilian martial arts dance' },
  { id: 'breakdance', name: 'Breakdance', color: '#ef4444', icon: '🕺', description: 'Urban street dance style' },
  { id: 'salsa', name: 'Salsa', color: '#ec4899', icon: '💃', description: 'Latin partner dance' },
  { id: 'swing', name: 'Swing', color: '#8b5cf6', icon: '🎩', description: 'Jazz-era partner dance' },
  { id: 'wave-hip-hop', name: 'Wave Hip Hop', color: '#3b82f6', icon: '🌊', description: 'Fluid body wave movements' },
  { id: 'contemporary', name: 'Contemporary', color: '#06b6d4', icon: '🎭', description: 'Modern expressive dance' },
  { id: 'ballet', name: 'Ballet', color: '#ec4899', icon: '🩰', description: 'Classical dance technique' },
  { id: 'krump', name: 'Krump', color: '#dc2626', icon: '💥', description: 'High-energy street dance' },
];

export default function BlendConfigurationModule() {
  const [segments, setSegments] = useState<SegmentConfig[]>([]);
  const [transitions, setTransitions] = useState<TransitionConfig[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const addMotif = (motif: MotionMotif) => {
    const newSegment: SegmentConfig = {
      id: `segment-${Date.now()}`,
      motifId: motif.id,
      duration: 5,
      position: segments.length,
    };
    
    setSegments([...segments, newSegment]);
    
    // Auto-create transition if there's a previous segment
    if (segments.length > 0) {
      const prevSegment = segments[segments.length - 1];
      const newTransition: TransitionConfig = {
        id: `transition-${Date.now()}`,
        fromSegment: prevSegment.id,
        toSegment: newSegment.id,
        duration: 1,
        curve: 'ease-in-out',
      };
      setTransitions([...transitions, newTransition]);
    }
  };

  const removeSegment = (segmentId: string) => {
    setSegments(segments.filter(s => s.id !== segmentId));
    setTransitions(transitions.filter(t => t.fromSegment !== segmentId && t.toSegment !== segmentId));
  };

  const updateSegmentDuration = (segmentId: string, duration: number) => {
    setSegments(segments.map(s => s.id === segmentId ? { ...s, duration } : s));
  };

  const updateTransitionDuration = (transitionId: string, duration: number) => {
    setTransitions(transitions.map(t => t.id === transitionId ? { ...t, duration } : t));
  };

  const updateTransitionCurve = (transitionId: string, curve: TransitionConfig['curve']) => {
    setTransitions(transitions.map(t => t.id === transitionId ? { ...t, curve } : t));
  };

  const getMotifById = (id: string) => MOTION_LIBRARY.find(m => m.id === id);

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 border border-blue-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center">
            <Sliders className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Blend Configuration</h2>
            <p className="text-sm text-gray-500">Compose your motion sequence</p>
          </div>
        </div>
        
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 px-4 py-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-sm font-medium text-gray-700"
        >
          <span>{showAdvanced ? 'Hide' : 'Show'} Advanced</span>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Motion Library */}
        <div className="lg:col-span-1">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <div className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
            Motion Library
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            {MOTION_LIBRARY.map((motif) => (
              <button
                key={motif.id}
                onClick={() => addMotif(motif)}
                className="w-full flex items-center space-x-3 p-3 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200 group"
              >
                <div className="text-3xl group-hover:scale-110 transition-transform">
                  {motif.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                    {motif.name}
                  </div>
                  <div className="text-xs text-gray-500">{motif.description}</div>
                </div>
                <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
              </button>
            ))}
          </div>
        </div>

        {/* Timeline Editor */}
        <div className="lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <div className="w-2 h-2 rounded-full bg-teal-500 mr-2" />
            Timeline Editor
          </h3>
          
          {segments.length === 0 ? (
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl text-gray-400">
              <div className="text-center">
                <Move className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Add motifs from the library to start</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Visual timeline */}
              <div className="relative h-20 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl overflow-hidden border border-gray-300">
                {segments.map((segment, idx) => {
                  const motif = getMotifById(segment.motifId);
                  if (!motif) return null;
                  
                  const totalDuration = segments.reduce((sum, s) => sum + s.duration, 0);
                  const startPos = segments.slice(0, idx).reduce((sum, s) => sum + s.duration, 0);
                  
                  return (
                    <React.Fragment key={segment.id}>
                      <div
                        className={`absolute top-0 h-full flex items-center justify-center cursor-pointer transition-all ${
                          selectedSegment === segment.id ? 'z-10 ring-4 ring-blue-400' : ''
                        }`}
                        style={{
                          left: `${(startPos / totalDuration) * 100}%`,
                          width: `${(segment.duration / totalDuration) * 100}%`,
                          background: `linear-gradient(135deg, ${motif.color}dd, ${motif.color}aa)`
                        }}
                        onClick={() => setSelectedSegment(segment.id)}
                      >
                        <span className="text-2xl">{motif.icon}</span>
                      </div>
                      
                      {/* Transition overlay */}
                      {idx < segments.length - 1 && transitions[idx] && (
                        <div
                          className="absolute top-0 h-full border-x-2 border-blue-500 bg-blue-500/30 z-5"
                          style={{
                            left: `${((startPos + segment.duration - transitions[idx].duration / 2) / totalDuration) * 100}%`,
                            width: `${(transitions[idx].duration / totalDuration) * 100}%`
                          }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              ⟷
                            </div>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Segment controls */}
              <div className="space-y-3">
                {segments.map((segment, idx) => {
                  const motif = getMotifById(segment.motifId);
                  if (!motif) return null;
                  
                  return (
                    <div key={segment.id} className="space-y-2">
                      <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="text-2xl">{motif.icon}</div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800">{motif.name}</div>
                          <div className="flex items-center space-x-3 mt-2">
                            <label className="text-xs text-gray-600">Duration (s):</label>
                            <input
                              type="range"
                              min="1"
                              max="15"
                              step="0.5"
                              value={segment.duration}
                              onChange={(e) => updateSegmentDuration(segment.id, parseFloat(e.target.value))}
                              className="flex-1"
                            />
                            <span className="text-sm font-mono text-gray-700 w-12">{segment.duration}s</span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeSegment(segment.id)}
                          className="w-8 h-8 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors"
                        >
                          <X className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                      
                      {/* Transition controls */}
                      {idx < segments.length - 1 && transitions[idx] && (
                        <div className="ml-12 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center space-x-3">
                            <div className="text-xs font-semibold text-blue-700">
                              Transition to {getMotifById(segments[idx + 1].motifId)?.name}
                            </div>
                            <div className="flex-1 flex items-center space-x-2">
                              <input
                                type="range"
                                min="0.1"
                                max="3"
                                step="0.1"
                                value={transitions[idx].duration}
                                onChange={(e) => updateTransitionDuration(transitions[idx].id, parseFloat(e.target.value))}
                                className="flex-1"
                              />
                              <span className="text-xs font-mono text-gray-600 w-10">{transitions[idx].duration}s</span>
                            </div>
                            
                            {showAdvanced && (
                              <select
                                value={transitions[idx].curve}
                                onChange={(e) => updateTransitionCurve(transitions[idx].id, e.target.value as any)}
                                className="text-xs border border-blue-300 rounded px-2 py-1 bg-white"
                              >
                                <option value="linear">Linear</option>
                                <option value="ease-in">Ease In</option>
                                <option value="ease-out">Ease Out</option>
                                <option value="ease-in-out">Ease In-Out</option>
                              </select>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Action */}
      {segments.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button className="px-8 py-3 bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white font-semibold rounded-full shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl">
            Preview Blend
          </button>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}

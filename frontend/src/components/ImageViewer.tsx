import React, { useState, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Sun,
  Contrast,
  Sliders,
  Maximize2,
  Minimize2,
  Ruler,
  Columns,
  Download,
  FileText
} from 'lucide-react';
import { Button } from './ui/Button';

export interface ImageViewerProps {
  primaryImageUrl?: string;
  src?: string;
  secondaryImageUrl?: string;
  title?: string;
  alt?: string;
  isDicom?: boolean;
  isPdf?: boolean;
  fileType?: string;
  sourceType?: 'DIGITAL_MACHINE' | 'FILM_SCAN' | 'PHONE_PHOTO';
  patientName?: string;
  studyDate?: string;
  downloadUrl?: string;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  primaryImageUrl,
  src,
  secondaryImageUrl,
  title,
  alt,
  isDicom = false,
  isPdf = false,
  fileType,
  sourceType = 'DIGITAL_MACHINE',
  patientName,
  studyDate,
  downloadUrl
}) => {
  const activeImageUrl = primaryImageUrl || src || '';
  const displayTitle = title || alt || patientName || 'Medical Image';

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrastVal, setContrastVal] = useState(100);
  const [invert, setInvert] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);

  // Simple 2-point measurement caliper state
  const [measurePoints, setMeasurePoints] = useState<Array<{ x: number; y: number }>>([]);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!measureMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (measurePoints.length >= 2) {
      setMeasurePoints([{ x, y }]);
      setCalculatedDistance(null);
    } else if (measurePoints.length === 1) {
      const p1 = measurePoints[0];
      const distPx = Math.sqrt((x - p1.x) ** 2 + (y - p1.y) ** 2);
      // Approximate 1px ≈ 0.26mm standard calibrated monitor
      const distMm = parseFloat((distPx * 0.26).toFixed(1));
      setMeasurePoints([p1, { x, y }]);
      setCalculatedDistance(distMm);
    } else {
      setMeasurePoints([{ x, y }]);
    }
  };

  const resetFilters = () => {
    setZoom(1);
    setRotation(0);
    setBrightness(100);
    setContrastVal(100);
    setInvert(false);
    setMeasurePoints([]);
    setCalculatedDistance(null);
  };

  if (isPdf) {
    return (
      <div className="w-full h-[600px] border border-slate-300 rounded-xl overflow-hidden bg-slate-900 flex flex-col">
        <div className="bg-slate-800 text-white px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-light-teal" />
            <span>{displayTitle} (PDF Document)</span>
          </div>
          {downloadUrl && (
            <a href={downloadUrl} target="_blank" rel="noreferrer" className="text-brand-light-teal hover:underline flex items-center gap-1">
              <Download className="w-4 h-4" /> Download PDF
            </a>
          )}
        </div>
        <iframe src={primaryImageUrl} title={title} className="w-full flex-1 border-none bg-white" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-slate-950 text-white rounded-xl overflow-hidden border border-slate-800 select-none ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'w-full h-[650px]'
      }`}
    >
      {/* Top Header & Disclaimers */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            {displayTitle}
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
              Source: {sourceType}
            </span>
          </h4>
          {sourceType === 'PHONE_PHOTO' && (
            <p className="text-xs text-amber-400 mt-0.5">
              Notice: A photo of a film is for reference only; the signed radiology report is the primary diagnostic source.
            </p>
          )}
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
            title="Rotate 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-slate-800 mx-1" />
          <button
            onClick={() => setInvert((v) => !v)}
            className={`p-1.5 rounded ${invert ? 'bg-brand-teal text-white' : 'hover:bg-slate-800 text-slate-300'}`}
            title="Invert Grayscale"
          >
            <Sliders className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setMeasureMode((m) => !m);
              setMeasurePoints([]);
              setCalculatedDistance(null);
            }}
            className={`p-1.5 rounded ${measureMode ? 'bg-brand-teal text-white' : 'hover:bg-slate-800 text-slate-300'}`}
            title="Caliper Distance Measurement"
          >
            <Ruler className="w-4 h-4" />
          </button>
          {secondaryImageUrl && (
            <button
              onClick={() => setCompareMode((c) => !c)}
              className={`p-1.5 rounded ${compareMode ? 'bg-brand-teal text-white' : 'hover:bg-slate-800 text-slate-300'}`}
              title="Side-by-Side Comparison"
            >
              <Columns className="w-4 h-4" />
            </button>
          )}
          <button onClick={toggleFullscreen} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white" title="Fullscreen">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <Button size="sm" variant="ghost" onClick={resetFilters} className="text-xs text-slate-400 hover:text-white h-7">
            Reset
          </Button>
        </div>
      </div>

      {/* Sliders Bar */}
      <div className="bg-slate-900/60 px-4 py-2 border-b border-slate-800/60 flex items-center gap-6 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Sun className="w-3.5 h-3.5" />
          <span>Brightness: {brightness}%</span>
          <input
            type="range"
            min="30"
            max="200"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-20 accent-brand-teal h-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <Contrast className="w-3.5 h-3.5" />
          <span>Contrast: {contrastVal}%</span>
          <input
            type="range"
            min="30"
            max="200"
            value={contrastVal}
            onChange={(e) => setContrastVal(Number(e.target.value))}
            className="w-20 accent-brand-teal h-1"
          />
        </div>
        {calculatedDistance !== null && (
          <div className="ml-auto bg-brand-teal/20 text-brand-mint px-2 py-0.5 rounded border border-brand-teal/40 font-mono">
            Measured: {calculatedDistance} mm
          </div>
        )}
      </div>

      {/* Main Canvas Viewport */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center p-4 bg-black/90">
        {isDicom ? (
          <div className="p-6 text-center max-w-md bg-slate-900/90 rounded-xl border border-slate-700">
            <h5 className="font-semibold text-slate-200 mb-2">Native DICOM Dataset</h5>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Standard web browsers support 2D preview. For complete diagnostic 3D multi-planar reconstructions (MPR)
              and volumetric slice scroll, download the original DICOM files or review the verified radiologist report.
            </p>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                className="inline-flex items-center gap-2 bg-brand-teal hover:bg-brand-teal/90 text-white text-xs px-4 py-2 rounded-lg font-medium shadow"
              >
                <Download className="w-4 h-4" /> Download Raw DICOM (.dcm)
              </a>
            )}
          </div>
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${compareMode ? 'grid grid-cols-2 gap-4' : ''}`}
            onClick={handleImageClick}
          >
            {/* Primary Image Viewport */}
            <div className="relative overflow-hidden flex items-center justify-center w-full h-full">
              <img
                src={activeImageUrl}
                alt={displayTitle}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  filter: `brightness(${brightness}%) contrast(${contrastVal}%) ${invert ? 'invert(1)' : ''}`,
                  transition: 'transform 0.1s ease-out',
                  maxHeight: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain'
                }}
                className="pointer-events-none select-none"
              />

              {/* Measurement Caliper Overlay */}
              {measurePoints.map((pt, idx) => (
                <div
                  key={idx}
                  style={{ left: pt.x - 4, top: pt.y - 4 }}
                  className="absolute w-2 h-2 rounded-full bg-brand-mint border border-white pointer-events-none shadow"
                />
              ))}
              {measurePoints.length === 2 && (
                <svg className="absolute inset-0 pointer-events-none w-full h-full">
                  <line
                    x1={measurePoints[0].x}
                    y1={measurePoints[0].y}
                    x2={measurePoints[1].x}
                    y2={measurePoints[1].y}
                    stroke="#02C39A"
                    strokeWidth="2"
                    strokeDasharray="4"
                  />
                </svg>
              )}
            </div>

            {/* Comparison Image Viewport */}
            {compareMode && secondaryImageUrl && (
              <div className="relative overflow-hidden flex items-center justify-center w-full h-full border-l border-slate-800 pl-4">
                <img
                  src={secondaryImageUrl}
                  alt="Prior study comparison"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    filter: `brightness(${brightness}%) contrast(${contrastVal}%) ${invert ? 'invert(1)' : ''}`,
                    maxHeight: '100%',
                    maxWidth: '100%',
                    objectFit: 'contain'
                  }}
                  className="pointer-events-none select-none"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  X,
  Check,
  RotateCcw,
  Sparkles,
  Trash2,
  Image as ImageIcon,
  Sun,
  User,
  AlertCircle,
  FlipHorizontal
} from 'lucide-react';

interface ProfileImageUploaderProps {
  currentAvatar?: string;
  userName: string;
  onSaveAvatar: (newAvatarUrl: string | undefined) => void;
  onClose: () => void;
}

// Sample beauty industry headshots presets
const PRESET_HEADSHOTS = [
  {
    id: 'preset-1',
    title: 'Editorial Studio',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'preset-2',
    title: 'Natural Light',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'preset-3',
    title: 'Salon Director',
    url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'preset-4',
    title: 'Glamour Portrait',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'preset-5',
    title: 'Clean Minimalist',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'preset-6',
    title: 'Modern Stylist',
    url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=400',
  },
];

export const ProfileImageUploader: React.FC<ProfileImageUploaderProps> = ({
  currentAvatar,
  userName,
  onSaveAvatar,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'camera' | 'upload' | 'presets'>('camera');
  const [selectedImage, setSelectedImage] = useState<string | null>(currentAvatar || null);
  
  // Camera States
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [ringLightEffect, setRingLightEffect] = useState<boolean>(true);
  const [isMirrored, setIsMirrored] = useState<boolean>(true);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera tracks cleanly
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Start live camera video stream
  const startCamera = async () => {
    setCameraError(null);
    setCapturedPhoto(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        let stream: MediaStream;
        try {
          // Attempt high-quality user-facing camera stream first
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 640 },
              height: { ideal: 640 },
            },
            audio: false,
          });
        } catch (firstErr) {
          console.warn('First getUserMedia attempt failed, trying fallback to general video constraints:', firstErr);
          // Fallback to basic video constraint if specific user-facing or dimensions constraint is not supported
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn('Video element play() was interrupted or blocked:', playErr);
          }
        }
        setIsCameraActive(true);
      } else {
        setCameraError('Camera access is not supported on your browser or device.');
      }
    } catch (err: any) {
      console.warn('Camera could not be started:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera permissions in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError' || err.message?.includes('device not found')) {
        setCameraError('No camera hardware was detected on this device. You can easily upload a profile picture or choose from our professional presets below!');
      } else {
        setCameraError('No camera found or camera is blocked in this view. Please upload a file or select a preset instead.');
      }
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'camera') {
      startCamera();
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [activeTab]);

  // Capture headshot photo from video stream onto canvas
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Mirroring if enabled
      if (isMirrored) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      // Draw video frame to square canvas
      const minDim = Math.min(video.videoWidth, video.videoHeight);
      const startX = (video.videoWidth - minDim) / 2;
      const startY = (video.videoHeight - minDim) / 2;

      ctx.drawImage(
        video,
        startX,
        startY,
        minDim,
        minDim,
        0,
        0,
        canvas.width,
        canvas.height
      );

      // Apply subtle ring-light beauty lighting boost if enabled
      if (ringLightEffect) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          // Soft brightness boost + warm tint
          data[i] = Math.min(255, data[i] * 1.05 + 5);     // Red
          data[i + 1] = Math.min(255, data[i + 1] * 1.03); // Green
          data[i + 2] = Math.min(255, data[i + 2] * 1.02); // Blue
        }
        ctx.putImageData(imageData, 0, 0);
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      setCapturedPhoto(dataUrl);
      setSelectedImage(dataUrl);
      stopCameraStream();
    }
  };

  // Handle File Upload from device
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setSelectedImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onSaveAvatar(selectedImage || undefined);
    onClose();
  };

  const handleRemovePhoto = () => {
    setSelectedImage(null);
    setCapturedPhoto(null);
    onSaveAvatar(undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#e0bec6]/60 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-[#8e004b] to-[#b90064] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/20 backdrop-blur-md">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">Professional Headshot</h2>
              <p className="text-xs text-white/80">Capture or upload your beauty industry profile photo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#e0bec6]/40 bg-[#fdf8f8] p-1.5 gap-1">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'camera'
                ? 'bg-white text-[#8e004b] shadow-xs border border-[#e0bec6]/50'
                : 'text-[#594047] hover:bg-white/50'
            }`}
          >
            <Camera className="w-4 h-4 text-[#e2007c]" />
            <span>Live Camera</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-white text-[#8e004b] shadow-xs border border-[#e0bec6]/50'
                : 'text-[#594047] hover:bg-white/50'
            }`}
          >
            <Upload className="w-4 h-4 text-[#e2007c]" />
            <span>Upload File</span>
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'presets'
                ? 'bg-white text-[#8e004b] shadow-xs border border-[#e0bec6]/50'
                : 'text-[#594047] hover:bg-white/50'
            }`}
          >
            <ImageIcon className="w-4 h-4 text-[#e2007c]" />
            <span>Presets</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center">
          {/* TAB 1: LIVE CAMERA */}
          {activeTab === 'camera' && (
            <div className="w-full flex flex-col items-center gap-4">
              {capturedPhoto ? (
                /* Captured Photo Review State */
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="relative w-56 h-56 rounded-full overflow-hidden border-4 border-[#e2007c] shadow-lg bg-black">
                    <img
                      src={capturedPhoto}
                      alt="Captured Headshot"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="text-center">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Headshot Captured
                    </span>
                    <p className="text-xs text-[#594047] mt-1">
                      Looking fantastic! Apply to your Nexora profile or retake.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={startCamera}
                      className="px-4 py-2 rounded-full border border-[#e0bec6] bg-white text-[#8e004b] hover:bg-[#ffd9e2]/50 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retake Photo</span>
                    </button>
                  </div>
                </div>
              ) : cameraError ? (
                /* Camera Error State */
                <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center max-w-sm space-y-3">
                  <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
                  <h3 className="text-sm font-bold text-rose-900">Camera Unavailable</h3>
                  <p className="text-xs text-rose-700 leading-relaxed">{cameraError}</p>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="px-4 py-2 rounded-full bg-[#8e004b] text-white text-xs font-bold hover:bg-[#b90064] transition-colors cursor-pointer"
                  >
                    Use File Upload Instead
                  </button>
                </div>
              ) : (
                /* Live Video Viewfinder */
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="relative w-60 h-60 sm:w-64 sm:h-64 rounded-full overflow-hidden border-4 border-[#8e004b] shadow-xl bg-slate-900 flex items-center justify-center group">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
                    />

                    {/* Face Alignment Overlay Guide */}
                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-white/60 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-48 rounded-full border border-white/40" />
                    </div>

                    {/* Ring Light Effect Indicator */}
                    {ringLightEffect && (
                      <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber-400/90 text-slate-900 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full backdrop-blur-md shadow-xs flex items-center gap-1">
                        <Sun className="w-3 h-3 text-amber-900" /> Ring Light Softening Active
                      </div>
                    )}
                  </div>

                  {/* Camera Control Bar */}
                  <div className="flex items-center gap-4 bg-[#f1edec] px-4 py-2 rounded-full border border-[#e0bec6]/60 text-xs text-[#594047]">
                    <button
                      onClick={() => setRingLightEffect(!ringLightEffect)}
                      className={`p-2 rounded-full transition-colors cursor-pointer flex items-center gap-1 ${
                        ringLightEffect ? 'bg-amber-100 text-amber-800 font-bold' : 'hover:bg-white text-[#8c7077]'
                      }`}
                      title="Toggle Ring Light Beauty Effect"
                    >
                      <Sun className="w-4 h-4" />
                      <span className="text-[11px] hidden sm:inline">Beauty Light</span>
                    </button>

                    <div className="h-4 w-px bg-[#e0bec6]" />

                    <button
                      onClick={() => setIsMirrored(!isMirrored)}
                      className={`p-2 rounded-full transition-colors cursor-pointer flex items-center gap-1 ${
                        isMirrored ? 'bg-[#ffd9e2] text-[#8e004b] font-bold' : 'hover:bg-white text-[#8c7077]'
                      }`}
                      title="Mirror Camera View"
                    >
                      <FlipHorizontal className="w-4 h-4" />
                      <span className="text-[11px] hidden sm:inline">Flip</span>
                    </button>
                  </div>

                  {/* Shutter Button */}
                  <button
                    onClick={handleCapturePhoto}
                    disabled={!isCameraActive}
                    className="mt-2 px-8 py-3 bg-[#e2007c] hover:bg-[#b90064] text-white text-sm font-extrabold rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    <span>Take Headshot</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FILE UPLOAD */}
          {activeTab === 'upload' && (
            <div className="w-full flex flex-col items-center gap-5">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-[#e0bec6] hover:border-[#8e004b] rounded-3xl p-8 text-center bg-[#fdf8f8] hover:bg-[#ffd9e2]/20 transition-all cursor-pointer flex flex-col items-center gap-3"
              >
                <div className="w-16 h-16 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center shadow-xs">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1c1b1b]">Click to upload profile photo</h3>
                  <p className="text-xs text-[#594047] mt-1">Supports JPG, PNG, WEBP (Max 10MB)</p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 bg-[#8e004b] text-white text-xs font-bold rounded-full shadow-sm hover:bg-[#b90064] transition-colors"
                >
                  Select File
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* Uploaded File Preview */}
              {selectedImage && activeTab === 'upload' && (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-[#8e004b]">Selected Image Preview:</span>
                  <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-[#8e004b] shadow-md">
                    <img src={selectedImage} alt="Selected Preview" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: BEAUTY PRESETS */}
          {activeTab === 'presets' && (
            <div className="w-full space-y-3">
              <p className="text-xs font-semibold text-[#594047] text-center">
                Select a professional beauty headshot template:
              </p>
              <div className="grid grid-cols-3 gap-3">
                {PRESET_HEADSHOTS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedImage(preset.url)}
                    className={`relative rounded-2xl overflow-hidden border-2 transition-all cursor-pointer group aspect-square ${
                      selectedImage === preset.url
                        ? 'border-[#e2007c] ring-2 ring-[#e2007c]/40 shadow-md scale-102'
                        : 'border-transparent hover:border-[#e0bec6]'
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-2">
                      <span className="text-[10px] text-white font-bold truncate">{preset.title}</span>
                    </div>
                    {selectedImage === preset.url && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#e2007c] text-white flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-[#fdf8f8] border-t border-[#e0bec6]/40 flex items-center justify-between gap-3">
          {currentAvatar || selectedImage ? (
            <button
              onClick={handleRemovePhoto}
              className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Remove Photo</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex gap-2.5">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-[#e0bec6] bg-white text-[#594047] hover:bg-gray-50 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedImage}
              className="px-6 py-2.5 rounded-full bg-[#e2007c] hover:bg-[#b90064] disabled:opacity-50 text-white text-xs font-extrabold shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>Save Profile Photo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

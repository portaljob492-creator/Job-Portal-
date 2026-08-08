import React, { useState, useRef, useEffect } from 'react';
import { PortfolioItem } from '../../types';
import {
  Camera,
  Upload,
  Plus,
  Trash2,
  X,
  Sparkles,
  Check,
  RotateCcw,
  Sun,
  Eye,
  Tag,
  Edit3,
  FlipHorizontal,
  Image as ImageIcon,
  Grid,
  Maximize2,
  SlidersHorizontal,
  CheckCircle2,
  Layers
} from 'lucide-react';

interface PortfolioGalleryProps {
  items: PortfolioItem[];
  onUpdateItems: (newItems: PortfolioItem[]) => void;
  isEditable?: boolean;
}

// Preset beauty work photos for easy instant selection
const BEAUTY_PRESETS = [
  {
    title: 'Platinum Ice Blonde Foilayage',
    category: 'Hair' as const,
    technique: 'Seamless Lift & Toning',
    url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Micro-Needling & Stem Cell Glow',
    category: 'Skin' as const,
    technique: 'Collagen Induction',
    url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Editorial Cut & Feathered Blowout',
    category: 'Hair' as const,
    technique: 'Precision Shears & Round Brush',
    url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Sunset Velvet Eye Glam',
    category: 'Makeup' as const,
    technique: 'Smokey Blending & Lash Extensions',
    url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Cat-Eye Volume Lash Set',
    category: 'Makeup' as const,
    technique: '5D Russian Volume',
    url: 'https://images.unsplash.com/photo-1583001809873-a1284a563176?auto=format&fit=crop&q=80&w=800'
  },
  {
    title: 'Catwalk Metallic Chrome Gel Set',
    category: 'Nails' as const,
    technique: 'Hard Gel Sculpting',
    url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=80&w=800'
  }
];

export const PortfolioGallery: React.FC<PortfolioGalleryProps> = ({
  items,
  onUpdateItems,
  isEditable = true
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeItemModal, setActiveItemModal] = useState<PortfolioItem | 'new' | null>(null);
  const [lightboxItem, setLightboxItem] = useState<PortfolioItem | null>(null);

  // Camera & Upload Modal States
  const [modalTab, setModalTab] = useState<'camera' | 'upload' | 'presets'>('camera');
  const [titleInput, setTitleInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<PortfolioItem['category']>('Hair');
  const [techniqueInput, setTechniqueInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Camera stream controls
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [ringLight, setRingLight] = useState(true);
  const [isMirrored, setIsMirrored] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const categories = ['All', 'Hair', 'Skin', 'Makeup', 'Nails', 'Barber', 'Other'];

  const filteredItems = selectedCategory === 'All'
    ? items
    : items.filter((item) => item.category === selectedCategory);

  // Stop video stream
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Start video stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: 'user',
              width: { ideal: 1024 },
              height: { ideal: 1024 }
            },
            audio: false
          });
        } catch (firstErr) {
          console.warn('First getUserMedia attempt failed, trying fallback to general video constraints:', firstErr);
          // Fallback to basic video constraint
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn('Video play was blocked or interrupted:', playErr);
          }
        }
        setIsCameraActive(true);
      } else {
        setCameraError('Camera access is not supported by your browser.');
      }
    } catch (err: any) {
      console.warn('Camera could not be started in portfolio gallery:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission was denied. Please allow camera permissions in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError' || err.message?.includes('device not found')) {
        setCameraError('No camera hardware was detected on this device. Please upload a photo from your files or use one of our beautiful presets!');
      } else {
        setCameraError('Unable to open camera. Please grant camera permissions, upload a file, or select a preset.');
      }
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    if (activeItemModal && modalTab === 'camera') {
      startCamera();
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [activeItemModal, modalTab]);

  const handleOpenModal = (item: PortfolioItem | 'new') => {
    setActiveItemModal(item);
    if (item === 'new') {
      setTitleInput('');
      setCategoryInput('Hair');
      setTechniqueInput('');
      setDescriptionInput('');
      setPreviewImageUrl(null);
    } else {
      setTitleInput(item.title);
      setCategoryInput(item.category);
      setTechniqueInput(item.technique || '');
      setDescriptionInput(item.description || '');
      setPreviewImageUrl(item.imageUrl);
    }
    setModalTab('camera');
  };

  const handleCloseModal = () => {
    stopCameraStream();
    setActiveItemModal(null);
  };

  const handleSnapPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (isMirrored) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setPreviewImageUrl(dataUrl);
      stopCameraStream();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePortfolioItem = () => {
    if (!previewImageUrl) {
      alert('Please snap a photo or choose an image for your work sample.');
      return;
    }

    const newItem: PortfolioItem = {
      id: activeItemModal && activeItemModal !== 'new' ? activeItemModal.id : `port-${Date.now()}`,
      title: titleInput.trim() || 'Work Transformation Sample',
      category: categoryInput,
      imageUrl: previewImageUrl,
      technique: techniqueInput.trim() || 'Custom Technique',
      description: descriptionInput.trim() || 'Captured with camera',
      date: 'Just Now',
      isPlaceholder: false
    };

    if (activeItemModal === 'new') {
      onUpdateItems([newItem, ...items]);
    } else if (activeItemModal) {
      onUpdateItems(items.map((it) => (it.id === activeItemModal.id ? newItem : it)));
    }

    handleCloseModal();
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this work sample from your portfolio?')) {
      onUpdateItems(items.filter((it) => it.id !== id));
      if (lightboxItem?.id === id) setLightboxItem(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-[#e0bec6]/40 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-[#ffd9e2] text-[#8e004b] font-bold">
              <Layers className="w-5 h-5" />
            </span>
            <h3 className="text-xl font-bold text-[#1c1b1b]">Work Portfolio & Transformations</h3>
          </div>
          <p className="text-xs text-[#594047]">
            Showcase your best balayage, cuts, skin glow treatments, and makeup sets to top salon owners.
          </p>
        </div>

        {isEditable && (
          <button
            onClick={() => handleOpenModal('new')}
            className="px-5 py-2.5 rounded-full bg-[#8e004b] hover:bg-[#b90064] text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Camera className="w-4 h-4" />
            <span>+ Add Work Sample (Camera)</span>
          </button>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedCategory === cat
                ? 'bg-[#8e004b] text-white shadow-2xs'
                : 'bg-white text-[#594047] hover:bg-[#ffd9e2]/40 border border-[#e0bec6]/40'
            }`}
          >
            {cat} {cat === 'All' ? `(${items.length})` : `(${items.filter(i => i.category === cat).length})`}
          </button>
        ))}
      </div>

      {/* Gallery Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-[#e0bec6] p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center mx-auto">
            <Camera className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-[#1c1b1b]">No work samples in this category</h4>
          <p className="text-xs text-[#594047] max-w-sm mx-auto">
            Snap a live photo of your client transformation using your camera to showcase your talent.
          </p>
          {isEditable && (
            <button
              onClick={() => handleOpenModal('new')}
              className="mt-2 px-5 py-2 bg-[#e2007c] text-white text-xs font-bold rounded-full hover:bg-[#b90064]"
            >
              Take First Photo
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setLightboxItem(item)}
              className="group bg-white rounded-2xl border border-[#e0bec6]/40 shadow-2xs hover:shadow-md transition-all overflow-hidden cursor-pointer flex flex-col relative"
            >
              {/* Photo Thumbnail Container */}
              <div className="relative aspect-4/3 w-full bg-[#f1edec] overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Category Badge */}
                <span className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md text-white text-[10px] font-extrabold uppercase tracking-wider rounded-full border border-white/20">
                  {item.category}
                </span>

                {/* Placeholder Notice Badge */}
                {item.isPlaceholder && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 bg-amber-500/90 text-white text-[9px] font-bold rounded-md shadow-xs">
                    Sample Placeholder
                  </span>
                )}

                {/* Overlay Action Buttons */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxItem(item);
                    }}
                    className="p-2.5 bg-white/90 text-[#1c1b1b] rounded-full hover:bg-white shadow-md transition-all"
                    title="View Fullsize"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>

                  {isEditable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(item);
                      }}
                      className="px-3 py-2 bg-[#e2007c] text-white text-xs font-bold rounded-full hover:bg-[#b90064] shadow-md flex items-center gap-1.5 transition-all"
                      title="Replace with Camera"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Snap Camera Photo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Card Details */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <h4 className="text-sm font-bold text-[#1c1b1b] line-clamp-1">{item.title}</h4>
                  {item.technique && (
                    <p className="text-[11px] font-bold text-[#e2007c] flex items-center gap-1 mt-0.5">
                      <Sparkles className="w-3 h-3 shrink-0" />
                      <span>{item.technique}</span>
                    </p>
                  )}
                  {item.description && (
                    <p className="text-xs text-[#594047] line-clamp-2 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-2 border-t border-[#e0bec6]/30 flex items-center justify-between text-[10px] text-[#8c7077]">
                  <span>{item.date || 'Recent Work'}</span>

                  {isEditable && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(item);
                        }}
                        className="hover:text-[#8e004b] font-bold cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> Edit / Replace
                      </button>
                      <button
                        onClick={(e) => handleDeleteItem(item.id, e)}
                        className="hover:text-rose-600 cursor-pointer"
                        title="Delete photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CAMERA & EDIT MODAL */}
      {activeItemModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-[#e0bec6]/60 space-y-5 my-8">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-[#e0bec6]/30">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center font-bold">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1c1b1b]">
                    {activeItemModal === 'new' ? 'Add Beauty Work Photo' : 'Update Work Sample'}
                  </h3>
                  <p className="text-[11px] text-[#594047]">
                    Use live camera, upload a photo, or choose a preset.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 text-[#8c7077] hover:text-[#1c1b1b] rounded-full hover:bg-[#f1edec]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Source Tabs */}
            <div className="flex gap-2 p-1 bg-[#f1edec] rounded-2xl text-xs font-bold">
              <button
                onClick={() => setModalTab('camera')}
                className={`flex-1 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalTab === 'camera' ? 'bg-[#8e004b] text-white shadow-xs' : 'text-[#594047]'
                }`}
              >
                <Camera className="w-3.5 h-3.5" /> Live Camera
              </button>
              <button
                onClick={() => setModalTab('upload')}
                className={`flex-1 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalTab === 'upload' ? 'bg-[#8e004b] text-white shadow-xs' : 'text-[#594047]'
                }`}
              >
                <Upload className="w-3.5 h-3.5" /> Upload File
              </button>
              <button
                onClick={() => setModalTab('presets')}
                className={`flex-1 py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  modalTab === 'presets' ? 'bg-[#8e004b] text-white shadow-xs' : 'text-[#594047]'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Beauty Presets
              </button>
            </div>

            {/* TAB CONTENT: CAMERA */}
            {modalTab === 'camera' && (
              <div className="space-y-3">
                <div className="relative aspect-square w-full max-w-sm mx-auto bg-black rounded-2xl overflow-hidden shadow-inner flex items-center justify-center border-4 border-[#ffd9e2]">
                  {/* Simulated Ring Light Effect Overlay */}
                  {ringLight && isCameraActive && !previewImageUrl && (
                    <div className="absolute inset-0 border-[16px] border-white/20 rounded-2xl pointer-events-none ring-4 ring-white/40 animate-pulse" />
                  )}

                  {previewImageUrl ? (
                    <img
                      src={previewImageUrl}
                      alt="Captured Work"
                      className="w-full h-full object-cover"
                    />
                  ) : isCameraActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${isMirrored ? 'scale-x-[-1]' : ''}`}
                    />
                  ) : (
                    <div className="text-center p-6 text-white space-y-2">
                      <Camera className="w-10 h-10 mx-auto opacity-50 text-[#e2007c]" />
                      <p className="text-xs">{cameraError || 'Camera stream offline.'}</p>
                      <button
                        onClick={startCamera}
                        className="px-4 py-1.5 bg-[#e2007c] text-white text-xs font-bold rounded-full"
                      >
                        Start Camera
                      </button>
                    </div>
                  )}

                  {/* Camera Toolbar Overlay */}
                  {isCameraActive && !previewImageUrl && (
                    <div className="absolute top-3 right-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setRingLight(!ringLight)}
                        className={`p-2 rounded-full text-xs font-bold transition-all ${
                          ringLight ? 'bg-amber-400 text-black shadow-md' : 'bg-black/60 text-white'
                        }`}
                        title="Toggle Beauty Ring Light Effect"
                      >
                        <Sun className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsMirrored(!isMirrored)}
                        className="p-2 bg-black/60 text-white rounded-full hover:bg-black"
                        title="Mirror Camera"
                      >
                        <FlipHorizontal className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Shutter / Retake Bar */}
                <div className="flex justify-center items-center gap-3">
                  {previewImageUrl ? (
                    <button
                      onClick={() => {
                        setPreviewImageUrl(null);
                        startCamera();
                      }}
                      className="px-4 py-2 bg-[#f1edec] hover:bg-[#e0bec6]/50 text-[#8e004b] text-xs font-bold rounded-full flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" /> Retake Photo
                    </button>
                  ) : (
                    <button
                      onClick={handleSnapPhoto}
                      disabled={!isCameraActive}
                      className="px-6 py-2.5 bg-[#e2007c] hover:bg-[#b90064] disabled:opacity-50 text-white font-bold text-xs rounded-full shadow-lg flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
                    >
                      <div className="w-3 h-3 rounded-full bg-white animate-ping" />
                      <span>Snap Photo Now</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: UPLOAD */}
            {modalTab === 'upload' && (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#e0bec6] hover:border-[#e2007c] bg-[#fdf8f8] rounded-2xl p-8 text-center cursor-pointer transition-colors space-y-2"
                >
                  <Upload className="w-8 h-8 text-[#8e004b] mx-auto" />
                  <p className="text-xs font-bold text-[#1c1b1b]">Click or drag & drop photo here</p>
                  <p className="text-[10px] text-[#8c7077]">JPG, PNG, WEBP high-resolution photos</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {previewImageUrl && (
                  <div className="relative w-32 h-32 mx-auto rounded-xl overflow-hidden border border-[#e0bec6] shadow-sm">
                    <img src={previewImageUrl} alt="Uploaded" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: PRESETS */}
            {modalTab === 'presets' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-56 overflow-y-auto p-1">
                {BEAUTY_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPreviewImageUrl(preset.url);
                      setTitleInput(preset.title);
                      setCategoryInput(preset.category);
                      setTechniqueInput(preset.technique);
                    }}
                    className={`group relative rounded-xl overflow-hidden border-2 text-left cursor-pointer transition-all aspect-square ${
                      previewImageUrl === preset.url
                        ? 'border-[#e2007c] ring-2 ring-[#ffd9e2]'
                        : 'border-[#e0bec6]/40 hover:border-[#e2007c]'
                    }`}
                  >
                    <img src={preset.url} alt={preset.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent p-2 flex flex-col justify-end text-white">
                      <span className="text-[9px] font-bold text-[#ffd9e2]">{preset.category}</span>
                      <span className="text-[10px] font-bold line-clamp-1">{preset.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Form Fields for Title, Category, Technique, Description */}
            <div className="space-y-3 pt-2 border-t border-[#e0bec6]/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1c1b1b] mb-1">
                    Title / Transformation
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dimensional Blonde Balayage"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    className="w-full p-2.5 bg-[#f1edec] rounded-xl border border-[#e0bec6]/60 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#e2007c]/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1c1b1b] mb-1">Category</label>
                  <select
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value as any)}
                    className="w-full p-2.5 bg-[#f1edec] rounded-xl border border-[#e0bec6]/60 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#e2007c]/30"
                  >
                    <option value="Hair">Hair (Color/Cut/Style)</option>
                    <option value="Skin">Skin (Facials/Aesthetics)</option>
                    <option value="Makeup">Makeup & Lashes</option>
                    <option value="Nails">Nails & Extension Art</option>
                    <option value="Barber">Barbering & Fades</option>
                    <option value="Other">Other Services</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1c1b1b] mb-1">
                  Technique / Products Used
                </label>
                <input
                  type="text"
                  placeholder="e.g. Freehand foilayage + Olaplex Bond Repair"
                  value={techniqueInput}
                  onChange={(e) => setTechniqueInput(e.target.value)}
                  className="w-full p-2.5 bg-[#f1edec] rounded-xl border border-[#e0bec6]/60 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#e2007c]/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1c1b1b] mb-1">
                  Stylist Notes / Formula
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe the consultation, client request, or color formula..."
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  className="w-full p-2.5 bg-[#f1edec] rounded-xl border border-[#e0bec6]/60 text-xs focus:outline-none focus:ring-2 focus:ring-[#e2007c]/30"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-[#e0bec6]/30">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-full border border-[#e0bec6] text-xs font-bold text-[#594047] hover:bg-[#f1edec]"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePortfolioItem}
                className="px-6 py-2 rounded-full bg-[#8e004b] text-white text-xs font-bold hover:bg-[#b90064] shadow-md flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> Save to Portfolio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {lightboxItem && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-white/20 flex flex-col md:flex-row relative">
            <button
              onClick={() => setLightboxItem(null)}
              className="absolute top-3 right-3 z-10 p-2 bg-black/60 text-white rounded-full hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="md:w-1/2 bg-black aspect-square md:aspect-auto flex items-center justify-center">
              <img
                src={lightboxItem.imageUrl}
                alt={lightboxItem.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="md:w-1/2 p-6 flex flex-col justify-between space-y-4">
              <div>
                <span className="px-3 py-1 bg-[#ffd9e2] text-[#8e004b] text-[10px] font-extrabold uppercase rounded-full">
                  {lightboxItem.category}
                </span>
                <h3 className="text-xl font-bold text-[#1c1b1b] mt-2">{lightboxItem.title}</h3>

                {lightboxItem.technique && (
                  <p className="text-xs font-bold text-[#e2007c] flex items-center gap-1 mt-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{lightboxItem.technique}</span>
                  </p>
                )}

                <p className="text-xs text-[#594047] leading-relaxed mt-3">
                  {lightboxItem.description || 'No detailed formula notes specified.'}
                </p>
              </div>

              {isEditable && (
                <div className="pt-4 border-t border-[#e0bec6]/40 flex gap-2">
                  <button
                    onClick={() => {
                      const itemToEdit = lightboxItem;
                      setLightboxItem(null);
                      handleOpenModal(itemToEdit);
                    }}
                    className="flex-1 py-2 bg-[#e2007c] text-white text-xs font-bold rounded-full hover:bg-[#b90064] flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" /> Replace Photo with Camera
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

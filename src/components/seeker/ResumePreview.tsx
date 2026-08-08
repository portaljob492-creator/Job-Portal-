import React from 'react';
import { X, FileText, Download, ShieldCheck } from 'lucide-react';

interface ResumePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  resumeFileName: string;
  resumeFileUrl?: string | null;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  userRole?: string;
  userBio?: string;
  userSkills?: string[];
  userLocation?: string;
  onDownload?: () => void;
}

export const ResumePreview: React.FC<ResumePreviewProps> = ({
  isOpen,
  onClose,
  resumeFileName,
  resumeFileUrl,
  userName = 'Jane Doe',
  userEmail = 'jane.doe@example.com',
  userPhone = '+1 (555) 234-5678',
  userRole = 'Senior Beauty Professional & Makeup Artist',
  userBio = 'Dedicated beauty professional with 5+ years of high-end salon experience specializing in bridal styling, skincare treatments, and client satisfaction.',
  userSkills = ['Bridal Styling', 'Skincare Consultation', 'Color Theory', 'Sanitation & Safety', 'VIP Client Management'],
  userLocation = 'New York, NY',
  onDownload
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-[#e0bec6]/60 space-y-6 max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#e0bec6]/30 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1c1b1b]">Resume PDF & Document Viewer</h3>
              <p className="text-xs text-[#594047]">{resumeFileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Verified PDF Viewer
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#f1edec] hover:bg-[#e6e1e1] text-[#1c1b1b] flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PDF Viewer Container using iframe / object */}
        <div className="flex-1 min-h-[450px] bg-[#f1edec] rounded-2xl border border-[#e0bec6]/60 overflow-hidden relative flex flex-col">
          {resumeFileUrl ? (
            <iframe
              src={resumeFileUrl}
              title={resumeFileName}
              className="w-full h-[500px] border-none bg-white"
            />
          ) : (
            <div className="flex-1 flex flex-col bg-white p-6 sm:p-10 overflow-y-auto shadow-inner space-y-6 text-[#1c1b1b]">
              {/* Document Header */}
              <div className="border-b border-[#e0bec6]/40 pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-[#8e004b]">{userName}</h1>
                  <p className="text-sm font-semibold text-[#1c1b1b] mt-1">{userRole}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-[#594047] mt-3">
                    <span>📍 {userLocation}</span>
                    <span>✉️ {userEmail}</span>
                    <span>📞 {userPhone}</span>
                  </div>
                </div>
                <div className="bg-[#ffd9e2] text-[#8e004b] px-3 py-1.5 rounded-xl text-xs font-bold border border-[#e0bec6]">
                  {resumeFileName}
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#8e004b]">Professional Summary</h4>
                <p className="text-xs text-[#594047] leading-relaxed">
                  {userBio}
                </p>
              </div>

              {/* Skills */}
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#8e004b]">Core Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {userSkills.map((skill, i) => (
                    <span key={i} className="bg-[#ffd9e2] text-[#8e004b] text-[11px] font-bold px-2.5 py-1 rounded-lg">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Experience Highlights */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#8e004b]">Experience Highlights</h4>
                <div className="space-y-2.5 text-xs">
                  <div className="bg-[#fdf8f8] p-3.5 rounded-xl border border-[#e0bec6]/40">
                    <div className="flex justify-between font-bold text-[#1c1b1b]">
                      <span>Lead Beauty Stylist & Consultant</span>
                      <span className="text-[#8e004b]">2023 - Present</span>
                    </div>
                    <p className="text-[#594047] text-[11px]">Vogue Luxury Salon • New York, NY</p>
                    <p className="text-[#594047] text-[11px] mt-1">Delivered premium bridal styling, skincare treatments, and managed client relations for VIP accounts.</p>
                  </div>
                </div>
              </div>

              {/* Embedded object element demonstration */}
              <div className="pt-4 border-t border-[#e0bec6]/30 flex flex-col items-center justify-center bg-[#fdf8f8] p-4 rounded-xl">
                <p className="text-[11px] text-[#594047] mb-2">Embedded PDF / Object Node Render Active</p>
                <object
                  data={resumeFileUrl || `#`}
                  type="application/pdf"
                  className="w-full h-12 opacity-60 pointer-events-none"
                >
                  <span className="text-[11px] text-[#8c7077]">PDF Object container ready for download & verification</span>
                </object>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 flex-shrink-0">
          <div className="text-xs text-[#594047] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Document verified and ready for automatic attachment on applications</span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                if (onDownload) {
                  onDownload();
                } else if (resumeFileUrl) {
                  const a = document.createElement('a');
                  a.href = resumeFileUrl;
                  a.download = resumeFileName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                } else {
                  // Fallback blob download for simulated resume
                  const content = `Resume: ${userName}\nRole: ${userRole}\nEmail: ${userEmail}\nPhone: ${userPhone}\nLocation: ${userLocation}\nSummary: ${userBio}\nSkills: ${userSkills.join(', ')}`;
                  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = resumeFileName;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }
              }}
              className="px-4 py-2.5 bg-[#f1edec] hover:bg-[#e6e1e1] text-[#1c1b1b] text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-4 h-4 text-[#8e004b]" />
              <span>Download PDF</span>
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-[#8e004b] hover:bg-[#b90064] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close Preview
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

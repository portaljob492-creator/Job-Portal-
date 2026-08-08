import React from 'react';
import { ArrowLeft, HelpCircle, BadgeCheck, Store, Badge, Camera, Upload, ArrowRight, CheckCircle2, AlertCircle, Hourglass } from 'lucide-react';

interface EmployerOnboardingStep2ScreenProps {
  onBack: () => void;
  onContinue: () => void;
}

export const EmployerOnboardingStep2Screen: React.FC<EmployerOnboardingStep2ScreenProps> = ({
  onBack,
  onContinue,
}) => {
  return (
    <div className="font-body-md text-[#1c1b1b] bg-[#fdf8f8] min-h-screen pb-32 select-none">
      {/* TopAppBar */}
      <header className="bg-[#fdf8f8]/90 backdrop-blur-md border-b border-[#e0bec6] flex justify-between items-center px-5 h-16 w-full max-w-7xl mx-auto fixed top-0 z-50">
        <button 
          onClick={onBack}
          className="text-[#594047] hover:bg-[#ece7e7] transition-colors active:scale-95 duration-150 p-2 -ml-2 rounded-full flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="font-screen-title text-xl md:text-2xl font-bold text-[#8e004b]">Business Verification</h1>
        <button className="text-[#594047] hover:bg-[#ece7e7] transition-colors active:scale-95 duration-150 p-2 -mr-2 rounded-full flex items-center justify-center cursor-pointer">
          <HelpCircle className="w-6 h-6" />
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-5 pt-24 animate-in fade-in duration-200">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 rounded-full bg-[#8e004b]"></div>
            <div className="flex-1 h-1.5 rounded-full bg-[#8e004b] relative">
              {/* Glow effect for current step */}
              <div className="absolute inset-0 bg-[#8e004b] rounded-full blur-[2px] opacity-50"></div>
            </div>
            <div className="flex-1 h-1.5 rounded-full bg-[#e6e1e1]"></div>
          </div>
          <p className="text-[13px] font-medium text-[#594047] uppercase tracking-widest">Step 2 of 3</p>
        </div>

        {/* Header & Trust Explanation */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[#1c1b1b] mb-4">Verify your business.</h2>
          
          <div className="bg-[#f7f2f2] border border-[#e0bec6] rounded-xl p-4 flex items-start gap-4 relative overflow-hidden">
            {/* Decorative subtle gradient */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#b90064] rounded-full blur-3xl opacity-10 -mr-16 -mt-16 pointer-events-none"></div>
            
            <div className="w-10 h-10 rounded-full bg-[#8e004b]/10 flex items-center justify-center shrink-0">
              <BadgeCheck className="text-[#8e004b] w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#1c1b1b] mb-1">Build trust & visibility</h3>
              <p className="text-[13px] font-medium text-[#594047]">
                Verified employers receive up to 3x more applications and rank higher in candidate searches. All documents are securely encrypted.
              </p>
            </div>
          </div>
        </div>

        {/* Document Upload Sections */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-[#1c1b1b] mb-4">Required Documents</h3>
          
          <div className="flex flex-col gap-4">
            {/* Upload Card 1: Business Proof */}
            <div className="bg-white border border-[#e0bec6] rounded-xl p-4 shadow-[0_4px_12px_rgba(90,63,71,0.03)] hover:shadow-[0_8px_24px_rgba(90,63,71,0.06)] transition-all group cursor-pointer relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#ece7e7] flex items-center justify-center">
                    <Store className="text-[#594047] w-5 h-5" />
                  </div>
                  <h4 className="text-lg font-semibold text-[#1c1b1b]">Business Proof</h4>
                </div>
                <span className="text-[13px] font-medium text-[#ba1a1a] bg-[#ffdad6] px-2.5 py-1 rounded-full">Required</span>
              </div>
              
              <p className="text-[13px] font-medium text-[#594047] mb-4">
                Trade License, Registration Certificate, or official Tax documentation.
              </p>
              
              <div className="border-2 border-dashed border-[#e0bec6] rounded-lg p-4 flex flex-col items-center justify-center bg-[#fdf8f8] group-hover:bg-[#f7f2f2] transition-colors group-hover:border-[#8e004b]/40">
                <Upload className="text-[#8e004b] mb-2 w-6 h-6" />
                <p className="text-[13px] font-medium text-[#8e004b]">Tap to upload document</p>
                <p className="text-[13px] font-medium text-[#594047] mt-1">PDF, JPG, PNG up to 10MB</p>
              </div>
            </div>

            {/* Upload Card 2: Identity Proof */}
            <div className="bg-white border border-[#e0bec6] rounded-xl p-4 shadow-[0_4px_12px_rgba(90,63,71,0.03)] hover:shadow-[0_8px_24px_rgba(90,63,71,0.06)] transition-all group cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#ece7e7] flex items-center justify-center">
                    <Badge className="text-[#594047] w-5 h-5" />
                  </div>
                  <h4 className="text-lg font-semibold text-[#1c1b1b]">Identity Proof</h4>
                </div>
                <span className="text-[13px] font-medium text-[#ba1a1a] bg-[#ffdad6] px-2.5 py-1 rounded-full">Required</span>
              </div>
              
              <p className="text-[13px] font-medium text-[#594047] mb-4">
                Valid Government ID Card, Passport, or Driver's License of the business owner.
              </p>
              
              <div className="border-2 border-dashed border-[#e0bec6] rounded-lg p-4 flex flex-col items-center justify-center bg-[#fdf8f8] group-hover:bg-[#f7f2f2] transition-colors group-hover:border-[#8e004b]/40">
                <Upload className="text-[#8e004b] mb-2 w-6 h-6" />
                <p className="text-[13px] font-medium text-[#8e004b]">Tap to upload document</p>
              </div>
            </div>

            {/* Upload Card 3: Salon Proof */}
            <div className="bg-white border border-[#e0bec6] rounded-xl p-4 shadow-[0_4px_12px_rgba(90,63,71,0.03)] hover:shadow-[0_8px_24px_rgba(90,63,71,0.06)] transition-all group cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#ece7e7] flex items-center justify-center">
                    <Camera className="text-[#594047] w-5 h-5" />
                  </div>
                  <h4 className="text-lg font-semibold text-[#1c1b1b]">Salon Proof</h4>
                </div>
                <span className="text-[13px] font-medium text-[#594047] bg-[#e6e1e1] px-2.5 py-1 rounded-full">Optional</span>
              </div>
              
              <p className="text-[13px] font-medium text-[#594047] mb-4">
                Photos of the physical location (interior/exterior) or a signed lease agreement.
              </p>
              
              <div className="border-2 border-dashed border-[#e0bec6] rounded-lg p-4 flex flex-col items-center justify-center bg-[#fdf8f8] group-hover:bg-[#f7f2f2] transition-colors group-hover:border-[#8e004b]/40">
                <Camera className="text-[#8e004b] mb-2 w-6 h-6" />
                <p className="text-[13px] font-medium text-[#8e004b]">Take or upload photos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Tracker Section */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-[#1c1b1b] mb-4">What happens next?</h3>
          
          <div className="bg-white border border-[#e0bec6] rounded-xl p-4">
            {/* Status: Pending */}
            <div className="flex items-start gap-4 relative">
              <div className="w-8 h-8 rounded-full bg-[#e6e1e1] flex items-center justify-center shrink-0 z-10 relative">
                <Hourglass className="text-[#594047] w-5 h-5" />
              </div>
              <div className="pb-4">
                <p className="text-base font-semibold text-[#1c1b1b]">Pending Review</p>
                <p className="text-[13px] font-medium text-[#594047]">
                  Status: Under Review. Our team typically verifies documents within 24-48 hours.
                </p>
              </div>
              {/* Connector line */}
              <div className="absolute left-4 top-8 bottom-0 w-px bg-[#e0bec6] -ml-[0.5px]"></div>
            </div>
            
            {/* Status: Verified (Future State) */}
            <div className="flex items-start gap-4 relative opacity-50 mt-2">
              <div className="w-8 h-8 rounded-full bg-[#e6e1e1] flex items-center justify-center shrink-0 z-10 relative">
                <CheckCircle2 className="text-[#594047] w-5 h-5" />
              </div>
              <div className="pb-4">
                <p className="text-base font-semibold text-[#1c1b1b]">Verified</p>
                <p className="text-[13px] font-medium text-[#594047]">
                  Status: Active. You will receive a notification once approved.
                </p>
              </div>
              {/* Connector line */}
              <div className="absolute left-4 top-8 bottom-0 w-px bg-[#e0bec6] -ml-[0.5px]"></div>
            </div>
            
            {/* Status: Needs Update (Future State) */}
            <div className="flex items-start gap-4 relative opacity-50 mt-2">
              <div className="w-8 h-8 rounded-full bg-[#e6e1e1] flex items-center justify-center shrink-0 z-10 relative">
                <AlertCircle className="text-[#594047] w-5 h-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-[#1c1b1b]">Needs Update</p>
                <p className="text-[13px] font-medium text-[#594047]">
                  Status: Action Required. If documents are unclear, we will request an update.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 w-full bg-[#fdf8f8]/90 backdrop-blur-md border-t border-[#e0bec6] p-5 z-40 shadow-[0_-4px_20px_rgba(90,63,71,0.05)]">
        <div className="max-w-2xl mx-auto">
          <button 
            onClick={onContinue}
            className="w-full bg-[#8e004b] text-white text-base font-bold rounded-full py-4 flex items-center justify-center gap-2 hover:bg-[#b50062] transition-colors active:scale-[0.98] shadow-sm cursor-pointer"
          >
            Submit Verification
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

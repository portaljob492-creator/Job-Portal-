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
    <div className="font-body-md text-[#0f172a] bg-[#f8fafc] min-h-screen pb-32 select-none">
      {/* TopAppBar */}
      <header className="bg-[#f8fafc]/90 backdrop-blur-md border-b border-[#cbd5e1] flex justify-between items-center px-5 h-16 w-full max-w-7xl mx-auto fixed top-0 z-50">
        <button
          onClick={onBack}
          className="text-[#475569] hover:bg-[#e2e8f0] transition-colors active:scale-95 duration-150 p-2 -ml-2 rounded-full flex items-center justify-center cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="font-screen-title text-xl md:text-2xl font-bold text-[#4f46e5]">Business Verification</h1>
        <button className="text-[#475569] hover:bg-[#e2e8f0] transition-colors active:scale-95 duration-150 p-2 -mr-2 rounded-full flex items-center justify-center cursor-pointer">
          <HelpCircle className="w-6 h-6" />
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-5 pt-24 animate-in fade-in duration-200">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1.5 rounded-full bg-[#4f46e5]"></div>
            <div className="flex-1 h-1.5 rounded-full bg-[#4f46e5] relative">
              {/* Glow effect for current step */}
              <div className="absolute inset-0 bg-[#4f46e5] rounded-full blur-[2px] opacity-50"></div>
            </div>
            <div className="flex-1 h-1.5 rounded-full bg-[#e2e8f0]"></div>
          </div>
          <p className="text-[13px] font-medium text-[#475569] uppercase tracking-widest">Step 2 of 3</p>
        </div>

        {/* Header & Trust Explanation */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0f172a] mb-4">Verify your business.</h2>

          <div className="bg-[#f8fafc] border border-[#cbd5e1] rounded-xl p-4 flex items-start gap-4 relative overflow-hidden">
            {/* Decorative subtle gradient */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#6d28d9] rounded-full blur-3xl opacity-10 -mr-16 -mt-16 pointer-events-none"></div>

            <div className="w-10 h-10 rounded-full bg-[#4f46e5]/10 flex items-center justify-center shrink-0">
              <BadgeCheck className="text-[#4f46e5] w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#0f172a] mb-1">Build trust & visibility</h3>
              <p className="text-[13px] font-medium text-[#475569]">
                Verified employers receive up to 3x more applications and rank higher in candidate searches. All documents are securely encrypted.
              </p>
            </div>
          </div>
        </div>

        {/* Document Upload Sections */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-[#0f172a] mb-4">Required Documents</h3>

          <div className="flex flex-col gap-4">
            {/* Upload Card 1: Business Proof */}
            <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all group cursor-pointer relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#e2e8f0] flex items-center justify-center">
                    <Store className="text-[#475569] w-5 h-5" />
                  </div>
                  <h4 className="text-lg font-semibold text-[#0f172a]">Business Proof</h4>
                </div>
                <span className="text-[13px] font-medium text-[#ba1a1a] bg-[#ffdad6] px-2.5 py-1 rounded-full">Required</span>
              </div>

              <p className="text-[13px] font-medium text-[#475569] mb-4">
                Trade License, Registration Certificate, or official Tax documentation.
              </p>

              <div className="border-2 border-dashed border-[#cbd5e1] rounded-lg p-4 flex flex-col items-center justify-center bg-[#f8fafc] group-hover:bg-[#f8fafc] transition-colors group-hover:border-[#4f46e5]/40">
                <Upload className="text-[#4f46e5] mb-2 w-6 h-6" />
                <p className="text-[13px] font-medium text-[#4f46e5]">Tap to upload document</p>
                <p className="text-[13px] font-medium text-[#475569] mt-1">PDF, JPG, PNG up to 10MB</p>
              </div>
            </div>

            {/* Upload Card 2: Identity Proof */}
            <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all group cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#e2e8f0] flex items-center justify-center">
                    <Badge className="text-[#475569] w-5 h-5" />
                  </div>
                  <h4 className="text-lg font-semibold text-[#0f172a]">Identity Proof</h4>
                </div>
                <span className="text-[13px] font-medium text-[#ba1a1a] bg-[#ffdad6] px-2.5 py-1 rounded-full">Required</span>
              </div>

              <p className="text-[13px] font-medium text-[#475569] mb-4">
                Valid Government ID Card, Passport, or Driver's License of the business owner.
              </p>

              <div className="border-2 border-dashed border-[#cbd5e1] rounded-lg p-4 flex flex-col items-center justify-center bg-[#f8fafc] group-hover:bg-[#f8fafc] transition-colors group-hover:border-[#4f46e5]/40">
                <Upload className="text-[#4f46e5] mb-2 w-6 h-6" />
                <p className="text-[13px] font-medium text-[#4f46e5]">Tap to upload document</p>
              </div>
            </div>

            {/* Upload Card 3: Salon Proof */}
            <div className="bg-white border border-[#cbd5e1] rounded-xl p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] transition-all group cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#e2e8f0] flex items-center justify-center">
                    <Camera className="text-[#475569] w-5 h-5" />
                  </div>
                  <h4 className="text-lg font-semibold text-[#0f172a]">Salon Proof</h4>
                </div>
                <span className="text-[13px] font-medium text-[#475569] bg-[#e2e8f0] px-2.5 py-1 rounded-full">Optional</span>
              </div>

              <p className="text-[13px] font-medium text-[#475569] mb-4">
                Photos of the physical location (interior/exterior) or a signed lease agreement.
              </p>

              <div className="border-2 border-dashed border-[#cbd5e1] rounded-lg p-4 flex flex-col items-center justify-center bg-[#f8fafc] group-hover:bg-[#f8fafc] transition-colors group-hover:border-[#4f46e5]/40">
                <Camera className="text-[#4f46e5] mb-2 w-6 h-6" />
                <p className="text-[13px] font-medium text-[#4f46e5]">Take or upload photos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Status Tracker Section */}
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-[#0f172a] mb-4">What happens next?</h3>

          <div className="bg-white border border-[#cbd5e1] rounded-xl p-4">
            {/* Status: Pending */}
            <div className="flex items-start gap-4 relative">
              <div className="w-8 h-8 rounded-full bg-[#e2e8f0] flex items-center justify-center shrink-0 z-10 relative">
                <Hourglass className="text-[#475569] w-5 h-5" />
              </div>
              <div className="pb-4">
                <p className="text-base font-semibold text-[#0f172a]">Pending Review</p>
                <p className="text-[13px] font-medium text-[#475569]">
                  Status: Under Review. Our team typically verifies documents within 24-48 hours.
                </p>
              </div>
              {/* Connector line */}
              <div className="absolute left-4 top-8 bottom-0 w-px bg-[#cbd5e1] -ml-[0.5px]"></div>
            </div>

            {/* Status: Verified (Future State) */}
            <div className="flex items-start gap-4 relative opacity-50 mt-2">
              <div className="w-8 h-8 rounded-full bg-[#e2e8f0] flex items-center justify-center shrink-0 z-10 relative">
                <CheckCircle2 className="text-[#475569] w-5 h-5" />
              </div>
              <div className="pb-4">
                <p className="text-base font-semibold text-[#0f172a]">Verified</p>
                <p className="text-[13px] font-medium text-[#475569]">
                  Status: Active. You will receive a notification once approved.
                </p>
              </div>
              {/* Connector line */}
              <div className="absolute left-4 top-8 bottom-0 w-px bg-[#cbd5e1] -ml-[0.5px]"></div>
            </div>

            {/* Status: Needs Update (Future State) */}
            <div className="flex items-start gap-4 relative opacity-50 mt-2">
              <div className="w-8 h-8 rounded-full bg-[#e2e8f0] flex items-center justify-center shrink-0 z-10 relative">
                <AlertCircle className="text-[#475569] w-5 h-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-[#0f172a]">Needs Update</p>
                <p className="text-[13px] font-medium text-[#475569]">
                  Status: Action Required. If documents are unclear, we will request an update.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-0 w-full bg-[#f8fafc]/90 backdrop-blur-md border-t border-[#cbd5e1] p-5 z-40 shadow-[0_-4px_20px_rgba(15,23,42,0.05)]">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={onContinue}
            className="w-full bg-[#4f46e5] text-white text-base font-bold rounded-full py-4 flex items-center justify-center gap-2 hover:bg-[#6d28d9] transition-colors active:scale-[0.98] shadow-sm cursor-pointer"
          >
            Submit Verification
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

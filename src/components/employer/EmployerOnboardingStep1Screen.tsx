import React, { useState } from 'react';
import { ArrowLeft, ImagePlus, ChevronDown, MapPin, Globe } from 'lucide-react';

export interface EmployerBusinessSetupData {
  businessName: string;
  contactName: string;
  address: string;
  city: string;
  state: string;
  postalCode?: string;
  businessType?: string;
  description?: string;
  website?: string;
  instagram?: string;
}

interface EmployerOnboardingStep1ScreenProps {
  onBack: () => void;
  onContinue: (data: EmployerBusinessSetupData) => Promise<void>;
  contactName?: string;
}

export const EmployerOnboardingStep1Screen: React.FC<EmployerOnboardingStep1ScreenProps> = ({
  onBack,
  onContinue,
  contactName = '',
}) => {
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleContinue = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onContinue({
        businessName,
        contactName,
        address,
        city,
        state,
        postalCode: zip,
        businessType,
        description,
        website,
        instagram,
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save the business details. Please retry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="font-body-md text-[#0f172a] bg-[#f8fafc] min-h-screen pb-[100px] md:pb-[120px] select-none">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#f8fafc] border-b border-[#cbd5e1] flex items-center justify-between px-5 h-16 shadow-[0_4px_12px_rgba(15,23,42,0.05)] md:shadow-none">
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#e2e8f0] transition-colors active:scale-95 text-[#475569] cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-screen-title text-[18px] md:text-2xl font-semibold text-[#4f46e5]">Business Setup</h1>
        <div className="w-10 h-10"></div> {/* Spacer for centering */}
      </header>

      {/* Main Content Canvas */}
      <main className="pt-20 px-5 md:max-w-2xl md:mx-auto md:pt-32 animate-in fade-in duration-200">

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2 text-[13px] font-medium text-[#475569]">
            <span>Step 1 of 3</span>
            <span>Set up your business</span>
          </div>
          <div className="w-full h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
            <div className="h-full bg-[#7c3aed] w-1/3 rounded-full transition-all duration-500"></div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#cbd5e1] p-4 md:p-8 shadow-[0_4px_12px_rgba(15,23,42,0.05)] space-y-8">

          {/* Salon Logo Upload */}
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-[#e2e8f0] border-2 border-dashed border-[#cbd5e1] flex items-center justify-center overflow-hidden transition-all group-hover:border-[#4f46e5] group-hover:bg-[#ede9fe]">
                <ImagePlus className="text-[#64748b] w-8 h-8 group-hover:text-[#4f46e5] transition-colors" />
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDswlV9g5IRJT5bmpEndvvCXQYa5OmfN5bs_YUDySmNmw6w_o9XO4mAXzsxVAlYiX4zKQxIlIbUGv8Ss33G4WR2bt4Gvu9DU0fMmtsFNNAYzhpty_qYA1oqtFIxfxE7pT5w5V1hXDztnh3u8zpmdgUs1WmduO6sL5Dup5RICaUPggvvGuQpL7uQD4UQpOmdTKyO94GDYg_cu_51oFwYJbJ-VB2bx_K4W-PGXSDYZAT3WbHyA9NCozuM"
                  alt="Placeholder"
                  className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-20 transition-opacity"
                />
              </div>
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-[#7c3aed] rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                <span className="material-symbols-outlined text-white text-[16px]">edit</span>
              </div>
            </div>
            <span className="text-[13px] font-medium text-[#475569]">Upload Salon Logo</span>
          </div>

          {/* Basic Info Section */}
          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#0f172a]">Salon / Business Name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. The Glamour Studio"
                className="bg-white border border-[#e2e8f0] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] rounded-lg py-3 px-4 text-base w-full transition-all outline-none"
              />
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#0f172a]">Business Type</label>
              <div className="relative">
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="bg-white border border-[#e2e8f0] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] rounded-lg py-3 px-4 text-base w-full transition-all outline-none appearance-none cursor-pointer pr-10"
                >
                  <option disabled value="">Select a business type</option>
                  <option value="salon">Hair Salon</option>
                  <option value="spa">Day Spa</option>
                  <option value="barbershop">Barbershop</option>
                  <option value="nail_studio">Nail Studio</option>
                  <option value="aesthetic">Aesthetics Clinic</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#475569] w-5 h-5 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#0f172a]">Business Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe your services, atmosphere, and what makes your business unique..."
                className="bg-white border border-[#e2e8f0] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] rounded-lg py-3 px-4 text-base w-full transition-all outline-none min-h-[120px] resize-y"
              />
            </div>
          </div>

          <hr className="border-[#cbd5e1]/50" />

          {/* Location Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#0f172a] mb-2">Location Details</h3>
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#0f172a]">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street Address"
                className="bg-white border border-[#e2e8f0] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] rounded-lg py-3 px-4 text-base w-full transition-all outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-2">
                <label className="text-[13px] font-semibold text-[#0f172a]">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="bg-white border border-[#e2e8f0] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] rounded-lg py-3 px-4 text-base w-full transition-all outline-none"
                />
              </div>
              <div className="flex flex-col space-y-2">
                <label className="text-[13px] font-semibold text-[#0f172a]">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  className="bg-white border border-[#e2e8f0] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] rounded-lg py-3 px-4 text-base w-full transition-all outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#0f172a]">PIN / Zip Code</label>
              <input
                type="number"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="00000"
                className="bg-white border border-[#e2e8f0] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] rounded-lg py-3 px-4 text-base w-full transition-all outline-none"
              />
            </div>

            <div className="flex flex-col space-y-2 mt-4">
              <label className="text-[13px] font-semibold text-[#0f172a] mb-1">Confirm on Map</label>
              <div className="w-full h-48 rounded-lg overflow-hidden border border-[#cbd5e1] relative bg-[#e2e8f0]">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB-iyEdau-RFUumTGDrNTk11kLqscYFrM_OquusarqTDkJa7gWXBh-dU8IgFin850XWj4lp7_RGdL2pxufn3wOaKqQd-JYKf0dapTEFwW9IcA7sAhu6VBsJaFRe-gDyZ8hkc3W-fTemU9qV5amLcZUU8PaunhLdFOuVKzLJgrEArX5em_JLukDk7GQBPDDKkBKtLKcP60KHQUXEJUfN7vdcOksPTFTsU7mWbrNaco-sQYXaIcihHSVb"
                  alt="Map Location"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-[#cbd5e1] shadow-sm flex items-center space-x-2 cursor-pointer hover:bg-white transition-colors">
                  <MapPin className="text-[#4f46e5] w-4 h-4" />
                  <span className="text-[11px] text-[#0f172a] font-medium">Adjust Pin</span>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-[#cbd5e1]/50" />

          {/* Social / Web Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#0f172a] mb-2">
              Online Presence <span className="text-[#475569] font-normal text-sm">(Optional)</span>
            </h3>
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#0f172a]">Website</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569] w-5 h-5" />
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.yourstudio.com"
                  className="bg-white border border-[#e2e8f0] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] rounded-lg py-3 pl-10 pr-4 text-base w-full transition-all outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#0f172a]">Instagram Handle</label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-[#475569] font-medium">@</span>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="yourstudio"
                  className="bg-white border border-[#e2e8f0] focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] rounded-lg py-3 pl-9 pr-4 text-base w-full transition-all outline-none"
                />
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 w-full bg-[#f8fafc]/90 backdrop-blur-md border-t border-[#cbd5e1] p-5 pb-safe z-40 md:bg-transparent md:border-transparent md:backdrop-blur-none md:static md:mt-8 md:p-0 md:max-w-2xl md:mx-auto">
        {saveError && <p role="alert" className="mb-2 text-sm font-semibold text-rose-700">{saveError}</p>}
        <button
          onClick={() => void handleContinue()}
          disabled={isSaving || !businessName.trim() || !address.trim() || !city.trim() || !state.trim()}
          className="w-full bg-[#7c3aed] disabled:bg-[#e2e8f0] disabled:text-[#64748b] disabled:cursor-not-allowed hover:bg-[#7c3aed] text-white text-base md:text-xl font-semibold py-4 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex justify-center items-center h-14 cursor-pointer"
        >
          {isSaving ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

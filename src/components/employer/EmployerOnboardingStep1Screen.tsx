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
  website?: string;
  instagram?: string;
}

interface EmployerOnboardingStep1ScreenProps {
  onBack: () => void;
  onContinue: (data: EmployerBusinessSetupData) => Promise<void> | void;
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

  return (
    <div className="font-body-md text-[#1c1b1b] bg-[#fdf8f8] min-h-screen pb-[100px] md:pb-[120px] select-none">
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-[#fdf8f8] border-b border-[#e0bec6] flex items-center justify-between px-5 h-16 shadow-[0_4px_12px_rgba(90,63,71,0.05)] md:shadow-none">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ece7e7] transition-colors active:scale-95 text-[#594047] cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-screen-title text-[18px] md:text-2xl font-semibold text-[#8e004b]">Business Setup</h1>
        <div className="w-10 h-10"></div> {/* Spacer for centering */}
      </header>

      {/* Main Content Canvas */}
      <main className="pt-20 px-5 md:max-w-2xl md:mx-auto md:pt-32 animate-in fade-in duration-200">
        
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2 text-[13px] font-medium text-[#594047]">
            <span>Step 1 of 3</span>
            <span>Set up your business</span>
          </div>
          <div className="w-full h-2 bg-[#e6e1e1] rounded-full overflow-hidden">
            <div className="h-full bg-[#e2007c] w-1/3 rounded-full transition-all duration-500"></div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#e0bec6] p-4 md:p-8 shadow-[0_4px_12px_rgba(90,63,71,0.05)] space-y-8">
          
          {/* Salon Logo Upload */}
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="relative group cursor-pointer">
              <div className="w-24 h-24 rounded-full bg-[#ece7e7] border-2 border-dashed border-[#e0bec6] flex items-center justify-center overflow-hidden transition-all group-hover:border-[#8e004b] group-hover:bg-[#ffd9e2]">
                <ImagePlus className="text-[#8c7077] w-8 h-8 group-hover:text-[#8e004b] transition-colors" />
                <img 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDswlV9g5IRJT5bmpEndvvCXQYa5OmfN5bs_YUDySmNmw6w_o9XO4mAXzsxVAlYiX4zKQxIlIbUGv8Ss33G4WR2bt4Gvu9DU0fMmtsFNNAYzhpty_qYA1oqtFIxfxE7pT5w5V1hXDztnh3u8zpmdgUs1WmduO6sL5Dup5RICaUPggvvGuQpL7uQD4UQpOmdTKyO94GDYg_cu_51oFwYJbJ-VB2bx_K4W-PGXSDYZAT3WbHyA9NCozuM" 
                  alt="Placeholder"
                  className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-20 transition-opacity" 
                />
              </div>
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-[#e2007c] rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                <span className="material-symbols-outlined text-white text-[16px]">edit</span>
              </div>
            </div>
            <span className="text-[13px] font-medium text-[#594047]">Upload Salon Logo</span>
          </div>

          {/* Basic Info Section */}
          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#1c1b1b]">Salon / Business Name</label>
              <input 
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. The Glamour Studio"
                className="bg-white border border-[#e8e8e8] focus:border-[#e6007e] focus:ring-1 focus:ring-[#e6007e] rounded-lg py-3 px-4 text-base w-full transition-all outline-none"
              />
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#1c1b1b]">Business Type</label>
              <div className="relative">
                <select 
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="bg-white border border-[#e8e8e8] focus:border-[#e6007e] focus:ring-1 focus:ring-[#e6007e] rounded-lg py-3 px-4 text-base w-full transition-all outline-none appearance-none cursor-pointer pr-10"
                >
                  <option disabled value="">Select a business type</option>
                  <option value="salon">Hair Salon</option>
                  <option value="spa">Day Spa</option>
                  <option value="barbershop">Barbershop</option>
                  <option value="nail_studio">Nail Studio</option>
                  <option value="aesthetic">Aesthetics Clinic</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-[#594047] w-5 h-5 pointer-events-none" />
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#1c1b1b]">Business Description</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Briefly describe your services, atmosphere, and what makes your business unique..."
                className="bg-white border border-[#e8e8e8] focus:border-[#e6007e] focus:ring-1 focus:ring-[#e6007e] rounded-lg py-3 px-4 text-base w-full transition-all outline-none min-h-[120px] resize-y"
              />
            </div>
          </div>

          <hr className="border-[#e0bec6]/50" />

          {/* Location Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#1c1b1b] mb-2">Location Details</h3>
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#1c1b1b]">Address</label>
              <input 
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street Address"
                className="bg-white border border-[#e8e8e8] focus:border-[#e6007e] focus:ring-1 focus:ring-[#e6007e] rounded-lg py-3 px-4 text-base w-full transition-all outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-2">
                <label className="text-[13px] font-semibold text-[#1c1b1b]">City</label>
                <input 
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="bg-white border border-[#e8e8e8] focus:border-[#e6007e] focus:ring-1 focus:ring-[#e6007e] rounded-lg py-3 px-4 text-base w-full transition-all outline-none"
                />
              </div>
              <div className="flex flex-col space-y-2">
                <label className="text-[13px] font-semibold text-[#1c1b1b]">State</label>
                <input 
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                  className="bg-white border border-[#e8e8e8] focus:border-[#e6007e] focus:ring-1 focus:ring-[#e6007e] rounded-lg py-3 px-4 text-base w-full transition-all outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#1c1b1b]">PIN / Zip Code</label>
              <input 
                type="number"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="00000"
                className="bg-white border border-[#e8e8e8] focus:border-[#e6007e] focus:ring-1 focus:ring-[#e6007e] rounded-lg py-3 px-4 text-base w-full transition-all outline-none"
              />
            </div>

            <div className="flex flex-col space-y-2 mt-4">
              <label className="text-[13px] font-semibold text-[#1c1b1b] mb-1">Confirm on Map</label>
              <div className="w-full h-48 rounded-lg overflow-hidden border border-[#e0bec6] relative bg-[#ece7e7]">
                <img 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB-iyEdau-RFUumTGDrNTk11kLqscYFrM_OquusarqTDkJa7gWXBh-dU8IgFin850XWj4lp7_RGdL2pxufn3wOaKqQd-JYKf0dapTEFwW9IcA7sAhu6VBsJaFRe-gDyZ8hkc3W-fTemU9qV5amLcZUU8PaunhLdFOuVKzLJgrEArX5em_JLukDk7GQBPDDKkBKtLKcP60KHQUXEJUfN7vdcOksPTFTsU7mWbrNaco-sQYXaIcihHSVb" 
                  alt="Map Location"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-[#e0bec6] shadow-sm flex items-center space-x-2 cursor-pointer hover:bg-white transition-colors">
                  <MapPin className="text-[#8e004b] w-4 h-4" />
                  <span className="text-[11px] text-[#1c1b1b] font-medium">Adjust Pin</span>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-[#e0bec6]/50" />

          {/* Social / Web Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[#1c1b1b] mb-2">
              Online Presence <span className="text-[#594047] font-normal text-sm">(Optional)</span>
            </h3>
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#1c1b1b]">Website</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-[#594047] w-5 h-5" />
                <input 
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://www.yourstudio.com"
                  className="bg-white border border-[#e8e8e8] focus:border-[#e6007e] focus:ring-1 focus:ring-[#e6007e] rounded-lg py-3 pl-10 pr-4 text-base w-full transition-all outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-[13px] font-semibold text-[#1c1b1b]">Instagram Handle</label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-[#594047] font-medium">@</span>
                <input 
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="yourstudio"
                  className="bg-white border border-[#e8e8e8] focus:border-[#e6007e] focus:ring-1 focus:ring-[#e6007e] rounded-lg py-3 pl-9 pr-4 text-base w-full transition-all outline-none"
                />
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-0 left-0 w-full bg-[#fdf8f8]/90 backdrop-blur-md border-t border-[#e0bec6] p-5 pb-safe z-40 md:bg-transparent md:border-transparent md:backdrop-blur-none md:static md:mt-8 md:p-0 md:max-w-2xl md:mx-auto">
        <button
          onClick={() => onContinue({
            businessName,
            contactName,
            address,
            city,
            state,
            postalCode: zip,
            businessType,
            website,
            instagram,
          })}
          disabled={!businessName.trim() || !address.trim() || !city.trim() || !state.trim()}
          className="w-full bg-[#e6007e] disabled:bg-[#e6e1e1] disabled:text-[#8c7077] disabled:cursor-not-allowed hover:bg-[#e2007c] text-white text-base md:text-xl font-semibold py-4 rounded-full shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex justify-center items-center h-14 cursor-pointer"
        >
          Continue
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { 
  Building2, 
  MapPin, 
  Edit, 
  Share,
  ShieldCheck,
  Settings,
  LogOut,
  ChevronRight,
  UserCircle,
  CheckCircle2
} from 'lucide-react';

interface EmployerProfileTabProps {
  userProfile: any;
  onUpdateAvatar?: (url: string) => void;
  onLogout?: () => void;
}

export const EmployerProfileTab: React.FC<EmployerProfileTabProps> = ({ 
  userProfile, 
  onUpdateAvatar,
  onLogout
}) => {
  return (
    <div className="max-w-md mx-auto px-5 pt-6 pb-32 space-y-8 w-full animate-in fade-in duration-300">
      {/* Profile Header Section */}
      <section className="flex flex-col items-center text-center space-y-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-[#fdf8f8] shadow-sm overflow-hidden bg-white">
            <img 
              src={userProfile.avatarUrl || "https://lh3.googleusercontent.com/aida-public/AB6AXuB1IZp_aPzxW5vzzGvqJyENlLGvQmQa4pziAu_d8jlQh61Nz_UTjiKRxKcTN4IwiS341AkL6z2aar11pEB-eHxHJqodq9kweLNGjYVzXaen3emVdt9B--SZsDuGafZd22tQ-6BL4pH1ka-h_tkYlmTfYQFqneZr8pSLa6MQfX2rrHdcrjy2dWJwpTBK4lV8fCKsNtHjhK93Z9QKs2hk_Qv_dgup4VbcPmZL0KKSKCf1XzqFY41vvfpoasNr7Tqwf1U8ug"} 
              alt={userProfile.businessName || "Employer Logo"}
              className="w-full h-full object-contain p-2"
            />
          </div>
          <div className="absolute bottom-0 right-0 bg-[#e2007c] text-white rounded-full p-1 shadow-md border-2 border-[#fdf8f8]">
            <CheckCircle2 className="w-4 h-4" fill="currentColor" color="white" />
          </div>
        </div>

        <div className="space-y-1">
          <h2 className="text-[18px] font-semibold text-[#1c1b1b] flex items-center justify-center gap-2">
            {userProfile.businessName || 'Nexora Beauty Group'}
          </h2>
          <p className="text-[16px] text-[#594047] flex items-center justify-center gap-1">
            <MapPin className="w-[18px] h-[18px]" />
            {userProfile.location || 'Malviya Nagar, Jaipur'}
          </p>
        </div>

        <div className="flex gap-4 w-full">
          <button className="flex-1 bg-white border border-[#e0bec6] text-[#8e004b] text-[13px] font-medium py-2.5 rounded-full hover:bg-[#e6e1e1] transition-colors flex items-center justify-center gap-2 cursor-pointer">
            <Edit className="w-[18px] h-[18px]" />
            Edit Profile
          </button>
          <button className="flex-1 bg-white border border-[#e0bec6] text-[#8e004b] text-[13px] font-medium py-2.5 rounded-full hover:bg-[#e6e1e1] transition-colors flex items-center justify-center gap-2 cursor-pointer">
            <Share className="w-[18px] h-[18px]" />
            Share Profile
          </button>
        </div>
      </section>

      {/* Menu Sections */}
      <section className="space-y-4">
        {/* Business & Settings Group */}
        <div className="bg-white rounded-xl border border-[#e0bec6] shadow-[0_4px_12px_rgba(90,63,71,0.02)] overflow-hidden">
          <ul className="divide-y divide-[#e0bec6]/30">
            <li>
              <button className="w-full flex items-center p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#e6e1e1] cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-[#8e004b]/10 flex items-center justify-center text-[#8e004b] mr-4 shrink-0">
                  <Building2 className="w-5 h-5" fill="currentColor" color="transparent" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-[13px] font-medium text-[#1c1b1b]">Business Information</h3>
                  <p className="text-xs text-[#594047] mt-0.5">Manage your salon details and brand</p>
                </div>
                <ChevronRight className="text-[#594047]/50 w-5 h-5" />
              </button>
            </li>
            <li>
              <button className="w-full flex items-center p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#e6e1e1] cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-[#8e004b]/10 flex items-center justify-center text-[#8e004b] mr-4 shrink-0">
                  <MapPin className="w-5 h-5" fill="currentColor" color="transparent" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-[13px] font-medium text-[#1c1b1b]">Business Locations</h3>
                  <p className="text-xs text-[#594047] mt-0.5">Manage multiple branches</p>
                </div>
                <ChevronRight className="text-[#594047]/50 w-5 h-5" />
              </button>
            </li>
            <li>
              <button className="w-full flex items-center p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#e6e1e1] cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-[#8e004b]/10 flex items-center justify-center text-[#8e004b] mr-4 shrink-0">
                  <ShieldCheck className="w-5 h-5" fill="currentColor" color="transparent" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-[13px] font-medium text-[#1c1b1b]">Verification</h3>
                  <p className="text-xs text-[#594047] mt-0.5">Business documents & status</p>
                </div>
                <ChevronRight className="text-[#594047]/50 w-5 h-5" />
              </button>
            </li>
            <li>
              <button className="w-full flex items-center p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#e6e1e1] cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-[#8e004b]/10 flex items-center justify-center text-[#8e004b] mr-4 shrink-0">
                  <Settings className="w-5 h-5" fill="currentColor" color="transparent" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-[13px] font-medium text-[#1c1b1b]">Hiring Settings</h3>
                  <p className="text-xs text-[#594047] mt-0.5">Job preferences & notifications</p>
                </div>
                <ChevronRight className="text-[#594047]/50 w-5 h-5" />
              </button>
            </li>
          </ul>
        </div>

        {/* Security Section */}
        <div className="bg-white rounded-xl border border-[#e0bec6] shadow-[0_4px_12px_rgba(90,63,71,0.02)] overflow-hidden">
          <ul className="divide-y divide-[#e0bec6]/30">
            <li>
              <button className="w-full flex items-center p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#e6e1e1] cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-[#f7f2f2] flex items-center justify-center text-[#1c1b1b] mr-4 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-[13px] font-medium text-[#1c1b1b]">Change Password</h3>
                </div>
                <ChevronRight className="text-[#594047]/50 w-5 h-5" />
              </button>
            </li>
          </ul>
        </div>

        {/* Legal Section */}
        <div className="bg-white rounded-xl border border-[#e0bec6] shadow-[0_4px_12px_rgba(90,63,71,0.02)] overflow-hidden">
          <ul className="divide-y divide-[#e0bec6]/30">
            <li>
              <button className="w-full flex items-center p-4 hover:bg-[#f7f2f2] transition-colors active:bg-[#e6e1e1] cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-[#f7f2f2] flex items-center justify-center text-[#1c1b1b] mr-4 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-[13px] font-medium text-[#1c1b1b]">Terms & Privacy Policy</h3>
                </div>
                <ChevronRight className="text-[#594047]/50 w-5 h-5" />
              </button>
            </li>
          </ul>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-xl border border-[#ffdad6] shadow-[0_4px_12px_rgba(90,63,71,0.02)] overflow-hidden mt-6">
          <button 
            onClick={onLogout}
            className="w-full flex items-center p-4 hover:bg-[#ffdad6]/30 transition-colors active:bg-[#ffdad6]/50 cursor-pointer border-b border-[#ffdad6]/30"
          >
            <div className="w-10 h-10 rounded-full bg-[#ba1a1a]/10 flex items-center justify-center text-[#ba1a1a] mr-4 shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-[13px] font-medium text-[#ba1a1a]">Log Out</h3>
            </div>
          </button>
          <button className="w-full flex items-center p-4 hover:bg-[#ffdad6]/30 transition-colors active:bg-[#ffdad6]/50 cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-[#ba1a1a]/10 flex items-center justify-center text-[#ba1a1a] mr-4 shrink-0">
              <UserCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="text-[13px] font-medium text-[#ba1a1a]">Delete Employer Account</h3>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};

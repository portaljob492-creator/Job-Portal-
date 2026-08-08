import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Camera, 
  User, 
  MapPin, 
  ShieldCheck, 
  ChevronRight, 
  Trash2, 
  Plus, 
  CheckCircle, 
  Check, 
  FileText, 
  School, 
  Briefcase, 
  Settings, 
  LogOut, 
  Sparkles, 
  Upload, 
  Download, 
  Eye, 
  Award,
  DollarSign,
  SlidersHorizontal,
  X,
  HelpCircle
} from 'lucide-react';
import { UserProfile, PortfolioItem, SavedFilter } from '../../types';

interface SeekerProfileTabProps {
  userProfile: UserProfile;
  onUpdateProfile?: (updated: UserProfile) => void;
  onLogout?: () => void;
  onNavigateTab?: (tab: 'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile') => void;
  onNavigateScreen?: (screen: any) => void;
}

// Sub-interfaces for detailed editor records
interface ExperienceRecord {
  id: string;
  title: string;
  salonName: string;
  location: string;
  period: string;
  description: string;
}

interface EducationRecord {
  id: string;
  schoolName: string;
  degree: string;
  period: string;
}

interface CertificationRecord {
  id: string;
  name: string;
  issuer: string;
  licenseNumber: string;
}

export const SeekerProfileTab: React.FC<SeekerProfileTabProps> = ({
  userProfile,
  onUpdateProfile,
  onLogout,
  onNavigateTab,
  onNavigateScreen,
}) => {
  // Navigation / Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<'personal' | 'skills' | 'experience' | 'education' | 'certifications' | 'resume' | 'preferences'>('personal');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Form States (Initialized from userProfile or sensible defaults)
  const [avatarUrl, setAvatarUrl] = useState(userProfile.avatarUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuAaJMS-TFw8KhQqFDD3dvQkSaarO08xmlkA8r00syw9ep0zFCbowZNpNHwEEnrcNmrdhrN-ZlLMragM4_TCbZTy7yVM9Unhl9wdtlT1jZr5QvHvQV2maWwHQW745lV7qCBwTY0XCH8VWYlfP0XZz0pBYbXDCWzeaIfuI7nlJrZfQ9v6ZqfIwg8WMEh8nG22aa69OpCyLOw1RcpYGDVSjtM2eWUZ4KmmKPOM_HXcMdZXS_43YEDQe-6i');
  const [fullName, setFullName] = useState(userProfile.name || 'Sarah Jenkins');
  const [professionalRole, setProfessionalRole] = useState(userProfile.businessName || 'Senior Esthetician & Spa Manager');
  const [location, setLocation] = useState(userProfile.contactPerson || 'Beverly Hills, CA');
  const [bio, setBio] = useState(userProfile.bio || 'Passionate skincare specialist with over 8 years of experience in luxury spa environments. Dedicated to holistic wellness and advanced aesthetic treatments.');
  const [email, setEmail] = useState(userProfile.email || 'sarah.jenkins@example.com');
  const [phone, setPhone] = useState(userProfile.phone || '(555) 342-9988');
  const [licenseNumber, setLicenseNumber] = useState(userProfile.licenseNumber || 'CA-COS-889124');

  // Dynamic lists states
  const [skills, setSkills] = useState<string[]>(
    userProfile.specialties || ['Balayage & Dimensional Color', 'Kérastase Master Certified', 'Scalp Treatments', 'Foilayage', 'Client Consultation', 'Retail Sales']
  );
  const [newSkill, setNewSkill] = useState('');

  const [experiences, setExperiences] = useState<ExperienceRecord[]>([
    {
      id: 'exp-1',
      title: 'Senior Hair Stylist',
      salonName: 'Lumière Studio',
      location: 'Beverly Hills, CA',
      period: '2022 - Present',
      description: 'Lead stylist specializing in custom color formulations, balayage, and luxury hair extensions. Mentored 3 junior stylists.',
    },
    {
      id: 'exp-2',
      title: 'Esthetician & Colorist',
      salonName: 'Bella Salon & Day Spa',
      location: 'West Hollywood, CA',
      period: '2019 - 2022',
      description: 'Delivered premium dermal therapies and multi-dimensional coloring services. Increased beauty product retail sales by 35%.',
    }
  ]);
  const [newExp, setNewExp] = useState<Partial<ExperienceRecord>>({});

  const [educations, setEducations] = useState<EducationRecord[]>([
    {
      id: 'edu-1',
      schoolName: 'Vidal Sassoon Academy',
      degree: 'Advanced Cosmetology & Hair Coloring Program',
      period: '2018 - 2019',
    },
    {
      id: 'edu-2',
      schoolName: 'California Beauty College',
      degree: 'Associate Degree in Esthetics & Salon Management',
      period: '2016 - 2018',
    }
  ]);
  const [newEdu, setNewEdu] = useState<Partial<EducationRecord>>({});

  const [certifications, setCertifications] = useState<CertificationRecord[]>([
    {
      id: 'cert-1',
      name: 'Kérastase Master Ambassador Certification',
      issuer: 'Kérastase Professional',
      licenseNumber: 'KMP-992102',
    },
    {
      id: 'cert-2',
      name: 'Advanced Scalp & Hair Therapy Practitioner',
      issuer: 'Aveda Institute',
      licenseNumber: 'AI-SCP-8452',
    }
  ]);
  const [newCert, setNewCert] = useState<Partial<CertificationRecord>>({});

  // Resume state
  const [resumeName, setResumeName] = useState('Sarah_Jenkins_CV_2026.pdf');
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Preferences states
  const [expectedSalary, setExpectedSalary] = useState('$85,000 - $95,000 / year');
  const [preferredJobType, setPreferredJobType] = useState<'Full-time' | 'Part-time' | 'Contract'>('Full-time');
  const [availability, setAvailability] = useState('Immediate (2 weeks notice)');

  // Helper trigger Toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Actions
  const handleAddSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
      triggerToast('Skill added successfully');
    }
  };

  const handleRemoveSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
    triggerToast('Skill removed');
  };

  const handleAddExperience = () => {
    if (newExp.title && newExp.salonName) {
      const record: ExperienceRecord = {
        id: `exp-${Date.now()}`,
        title: newExp.title,
        salonName: newExp.salonName,
        location: newExp.location || 'Beverly Hills, CA',
        period: newExp.period || '2026',
        description: newExp.description || '',
      };
      setExperiences([record, ...experiences]);
      setNewExp({});
      triggerToast('Experience added successfully');
    }
  };

  const handleRemoveExperience = (id: string) => {
    setExperiences(experiences.filter(e => e.id !== id));
    triggerToast('Experience entry deleted');
  };

  const handleAddEducation = () => {
    if (newEdu.schoolName && newEdu.degree) {
      const record: EducationRecord = {
        id: `edu-${Date.now()}`,
        schoolName: newEdu.schoolName,
        degree: newEdu.degree,
        period: newEdu.period || '2026',
      };
      setEducations([...educations, record]);
      setNewEdu({});
      triggerToast('Education added successfully');
    }
  };

  const handleRemoveEducation = (id: string) => {
    setEducations(educations.filter(e => e.id !== id));
    triggerToast('Education entry deleted');
  };

  const handleAddCertification = () => {
    if (newCert.name && newCert.issuer) {
      const record: CertificationRecord = {
        id: `cert-${Date.now()}`,
        name: newCert.name,
        issuer: newCert.issuer,
        licenseNumber: newCert.licenseNumber || 'N/A',
      };
      setCertifications([...certifications, record]);
      setNewCert({});
      triggerToast('Certification added successfully');
    }
  };

  const handleRemoveCertification = (id: string) => {
    setCertifications(certifications.filter(c => c.id !== id));
    triggerToast('Certification entry deleted');
  };

  const handleSaveChanges = () => {
    if (onUpdateProfile) {
      onUpdateProfile({
        ...userProfile,
        name: fullName,
        email,
        phone,
        avatarUrl,
        businessName: professionalRole, // map to professionalRole in App
        contactPerson: location, // map to location
        licenseNumber,
        specialties: skills,
        bio,
      });
    }
    triggerToast('All changes saved to your profile!');
    setIsEditing(false);
  };

  const openEditorTab = (tab: typeof activeEditTab) => {
    setActiveEditTab(tab);
    setIsEditing(true);
  };

  return (
    <div className="relative">
      {/* 1. VIEW PROFILE MODE */}
      {!isEditing && (
        <div className="flex flex-col gap-6 select-none animate-in fade-in duration-300">
          
          {/* Profile Header Area */}
          <section className="flex flex-col items-center pt-4">
            <div className="relative w-32 h-32 mb-4 group">
              <img 
                className="w-full h-full rounded-full object-cover shadow-[0_4px_12px_rgba(90,63,71,0.05)] border-2 border-white ring-4 ring-[#ffd9e2]/60" 
                alt="Profile Avatar" 
                src={avatarUrl}
                referrerPolicy="no-referrer"
              />
              <button 
                onClick={() => openEditorTab('personal')}
                className="absolute bottom-0 right-0 bg-[#e2007c] hover:bg-[#b90064] text-white p-2.5 rounded-full shadow-md active:scale-95 transition-all cursor-pointer border border-white"
                aria-label="Edit Profile Photo"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            
            <h2 className="text-2xl font-bold text-[#1c1b1b] tracking-tight">{fullName}</h2>
            <p className="text-[#594047] text-sm font-semibold mt-1">{professionalRole}</p>
            
            <div className="flex items-center justify-center gap-1 mt-2 text-[#8c7077]">
              <MapPin className="w-4 h-4 text-[#8e004b]" />
              <span className="text-xs font-semibold">{location}</span>
            </div>
          </section>

          {/* Profile Strength Widget */}
          <section className="bg-white rounded-2xl p-5 border border-[#e0bec6]/45 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-[#1c1b1b]">Profile Strength</h3>
              <span className="text-xs font-bold bg-[#e2007c] text-white px-2.5 py-0.5 rounded-full">80% Complete</span>
            </div>
            
            <div className="flex items-center gap-5 mt-4">
              <div className="w-16 h-16 shrink-0 relative flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path 
                    className="stroke-[#ece7e7]" 
                    strokeWidth="3" 
                    fill="none" 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path 
                    className="stroke-[#8e004b] transition-all duration-1000" 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                    fill="none" 
                    strokeDasharray="80, 100"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#8e004b]" />
                </div>
              </div>
              
              <div className="flex flex-col gap-1">
                <p className="text-xs text-[#594047] font-medium">Add portfolio pieces or specialized certifications to stand out to elite salons.</p>
                <button 
                  onClick={() => {
                    if (onNavigateTab) onNavigateTab('portfolio');
                  }}
                  className="text-xs font-extrabold text-[#8e004b] hover:underline self-start flex items-center gap-1 cursor-pointer mt-1"
                >
                  <span>Go to Portfolio Gallery</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>

          {/* Editable Sections Category List */}
          <section className="flex flex-col gap-3 pb-8">
            <h3 className="text-base font-bold text-[#1c1b1b] mb-1 pl-1">My Professional Credentials</h3>
            
            {/* 1. Personal Info Card */}
            <button 
              onClick={() => openEditorTab('personal')}
              className="w-full flex items-center justify-between bg-white p-4 rounded-xl border border-[#e0bec6]/40 hover:border-[#8e004b]/50 hover:bg-[#ffd9e2]/5 hover:shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffd9e2] flex items-center justify-center text-[#8e004b]">
                  <User className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-[#1c1b1b]">Personal Information</span>
                  <span className="block text-xs text-[#594047] font-medium mt-0.5">Contact details, bio and location settings</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8c7077]" />
            </button>

            {/* 2. Skills Card */}
            <button 
              onClick={() => openEditorTab('skills')}
              className="w-full flex items-center justify-between bg-white p-4 rounded-xl border border-[#e0bec6]/40 hover:border-[#8e004b]/50 hover:bg-[#ffd9e2]/5 hover:shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffd9e2] flex items-center justify-center text-[#8e004b]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-[#1c1b1b]">Specialty Skills & Techniques</span>
                  <span className="block text-xs text-[#594047] font-medium mt-0.5">{skills.slice(0, 3).join(', ')}...</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8c7077]" />
            </button>

            {/* 3. Experience Card */}
            <button 
              onClick={() => openEditorTab('experience')}
              className="w-full flex items-center justify-between bg-white p-4 rounded-xl border border-[#e0bec6]/40 hover:border-[#8e004b]/50 hover:bg-[#ffd9e2]/5 hover:shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffd9e2] flex items-center justify-center text-[#8e004b]">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-[#1c1b1b]">Work History & Salon Experience</span>
                  <span className="block text-xs text-[#594047] font-medium mt-0.5">{experiences.length} positions added</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8c7077]" />
            </button>

            {/* 4. Education Card */}
            <button 
              onClick={() => openEditorTab('education')}
              className="w-full flex items-center justify-between bg-white p-4 rounded-xl border border-[#e0bec6]/40 hover:border-[#8e004b]/50 hover:bg-[#ffd9e2]/5 hover:shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffd9e2] flex items-center justify-center text-[#8e004b]">
                  <School className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-[#1c1b1b]">Educational Qualifications</span>
                  <span className="block text-xs text-[#594047] font-medium mt-0.5">Certificates, schools, cosmetology training</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8c7077]" />
            </button>

            {/* 5. Certifications Card */}
            <button 
              onClick={() => openEditorTab('certifications')}
              className="w-full flex items-center justify-between bg-white p-4 rounded-xl border border-[#e0bec6]/40 hover:border-[#8e004b]/50 hover:bg-[#ffd9e2]/5 hover:shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffd9e2] flex items-center justify-center text-[#8e004b]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-[#1c1b1b]">Licenses & Special Certifications</span>
                  <span className="block text-xs text-[#594047] font-medium mt-0.5">Cosmetology License: {licenseNumber}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8c7077]" />
            </button>

            {/* 6. Resume Card */}
            <button 
              onClick={() => openEditorTab('resume')}
              className="w-full flex items-center justify-between bg-white p-4 rounded-xl border border-[#e0bec6]/40 hover:border-[#8e004b]/50 hover:bg-[#ffd9e2]/5 hover:shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffd9e2] flex items-center justify-center text-[#8e004b]">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-[#1c1b1b]">Professional Resume & CV</span>
                  <span className="block text-xs text-[#594047] font-medium mt-0.5">Current: {resumeName}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8c7077]" />
            </button>

            {/* 7. Preferences Card */}
            <button 
              onClick={() => openEditorTab('preferences')}
              className="w-full flex items-center justify-between bg-white p-4 rounded-xl border border-[#e0bec6]/40 hover:border-[#8e004b]/50 hover:bg-[#ffd9e2]/5 hover:shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffd9e2] flex items-center justify-center text-[#8e004b]">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-[#1c1b1b]">Job Search Preferences</span>
                  <span className="block text-xs text-[#594047] font-medium mt-0.5">Preferred Salary, availability, job types</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8c7077]" />
            </button>

            {/* 8. Help & Support Card */}
            <button 
              onClick={() => onNavigateScreen?.('support')}
              className="w-full flex items-center justify-between bg-white p-4 rounded-xl border border-[#e0bec6]/40 hover:border-[#8e004b]/50 hover:bg-[#ffd9e2]/5 hover:shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffd9e2] flex items-center justify-center text-[#8e004b]">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-[#1c1b1b]">Help & Support Center</span>
                  <span className="block text-xs text-[#594047] font-medium mt-0.5">FAQs, Safety reporting, and Support articles</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8c7077]" />
            </button>

            {/* 9. Settings Card */}
            <button 
              onClick={() => onNavigateScreen?.('settings')}
              className="w-full flex items-center justify-between bg-white p-4 rounded-xl border border-[#e0bec6]/40 hover:border-[#8e004b]/50 hover:bg-[#ffd9e2]/5 hover:shadow-xs transition-all active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ffd9e2] flex items-center justify-center text-[#8e004b]">
                  <Settings className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-bold text-[#1c1b1b]">Account Settings</span>
                  <span className="block text-xs text-[#594047] font-medium mt-0.5">Notifications, privacy, passwords, blocked lists</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8c7077]" />
            </button>

            {/* Sign Out Button */}
            {onLogout && (
              <button 
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-3.5 mt-6 text-[#ba1a1a] bg-rose-50 hover:bg-rose-100 rounded-xl font-bold transition-colors cursor-pointer border border-rose-100 shadow-2xs"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out Account</span>
              </button>
            )}
          </section>

        </div>
      )}

      {/* 2. EDIT PROFILE MODE */}
      {isEditing && (
        <div className="flex flex-col gap-5 select-none animate-in slide-in-from-right duration-300 pb-24">
          
          {/* Header toolbar */}
          <div className="flex items-center justify-between border-b border-[#e0bec6]/40 pb-4">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsEditing(false)}
                className="w-9 h-9 rounded-full bg-white hover:bg-[#ffd9e2]/30 border border-[#e0bec6]/50 flex items-center justify-center text-[#8e004b] transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h2 className="text-xl font-bold text-[#1c1b1b]">Edit Profile</h2>
            </div>
            
            <button 
              onClick={() => setIsEditing(false)}
              className="text-xs font-bold text-[#b50062] flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View Public Profile</span>
            </button>
          </div>

          {/* Horizontal scrollable tab selection */}
          <nav className="flex overflow-x-auto no-scrollbar gap-2.5 border-b border-[#e0bec6]/30 pb-2.5">
            {[
              { id: 'personal', label: 'Personal' },
              { id: 'skills', label: 'Skills' },
              { id: 'experience', label: 'Experience' },
              { id: 'education', label: 'Education' },
              { id: 'certifications', label: 'Certifications' },
              { id: 'resume', label: 'Resume' },
              { id: 'preferences', label: 'Preferences' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveEditTab(tab.id as typeof activeEditTab)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  activeEditTab === tab.id
                    ? 'bg-[#8e004b] text-white border-[#8e004b] shadow-xs'
                    : 'bg-white text-[#594047] border-[#e0bec6]/50 hover:bg-[#ffd9e2]/20'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Tab form panes */}
          <div className="bg-white rounded-2xl border border-[#e0bec6]/40 p-5 shadow-xs min-h-[300px]">
            
            {/* PERSONAL TAB */}
            {activeEditTab === 'personal' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Image uploader container */}
                <div className="flex flex-col items-center justify-center py-2 border-b border-[#e0bec6]/25 mb-4">
                  <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#e0bec6] group">
                    <img src={avatarUrl} alt="Avatar editing" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => {
                      const newUrl = prompt('Enter image URL:', avatarUrl);
                      if (newUrl) setAvatarUrl(newUrl);
                    }}
                    className="text-xs font-bold text-[#b50062] hover:underline mt-2 cursor-pointer"
                  >
                    Change Profile Photo
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#1c1b1b]">Full Name</label>
                    <input 
                      type="text" 
                      value={fullName} 
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#fdf8f8] text-[#1c1b1b] border border-[#e0bec6]/70 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b] text-xs font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#1c1b1b]">Professional Role</label>
                    <input 
                      type="text" 
                      value={professionalRole} 
                      onChange={(e) => setProfessionalRole(e.target.value)}
                      className="w-full bg-[#fdf8f8] text-[#1c1b1b] border border-[#e0bec6]/70 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b] text-xs font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#1c1b1b]">Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e004b] w-4 h-4" />
                      <input 
                        type="text" 
                        value={location} 
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full bg-[#fdf8f8] text-[#1c1b1b] border border-[#e0bec6]/70 rounded-xl p-3 pl-9 focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b] text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#1c1b1b]">CA Cosmetology License #</label>
                    <input 
                      type="text" 
                      value={licenseNumber} 
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      placeholder="e.g. CA-COS-889124"
                      className="w-full bg-[#fdf8f8] text-[#1c1b1b] border border-[#e0bec6]/70 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b] text-xs font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#1c1b1b]">Contact Email</label>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#fdf8f8] text-[#1c1b1b] border border-[#e0bec6]/70 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b] text-xs font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#1c1b1b]">Contact Phone</label>
                    <input 
                      type="text" 
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-[#fdf8f8] text-[#1c1b1b] border border-[#e0bec6]/70 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b] text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-[#1c1b1b]">Professional Bio</label>
                    <span className="text-[10px] text-[#594047] font-bold">{bio.length} / 500 characters</span>
                  </div>
                  <textarea 
                    rows={4}
                    maxLength={500}
                    value={bio} 
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full bg-[#fdf8f8] text-[#1c1b1b] border border-[#e0bec6]/70 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b] text-xs font-semibold resize-none"
                  />
                </div>
              </div>
            )}

            {/* SKILLS TAB */}
            {activeEditTab === 'skills' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-xs font-bold text-[#8e004b] uppercase tracking-wide">Manage Specialty Skills</h3>
                <p className="text-xs text-[#594047]">Add beauty industry skills, certifications or specialties that make you stand out.</p>
                
                {/* Input Add */}
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="e.g. Balayage, Chemical Peels, Brow Threading..." 
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                    className="flex-grow bg-[#fdf8f8] text-[#1c1b1b] border border-[#e0bec6]/70 rounded-xl p-3 text-xs font-semibold focus:outline-none"
                  />
                  <button 
                    onClick={handleAddSkill}
                    className="px-5 bg-[#8e004b] text-white rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-[#b90064] cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Tags List */}
                <div className="flex flex-wrap gap-2 pt-3">
                  {skills.map((skill, index) => (
                    <span 
                      key={index} 
                      className="px-3 py-1.5 bg-[#ffd9e2]/30 border border-[#e0bec6] text-[#8e004b] text-xs font-bold rounded-xl flex items-center gap-1.5"
                    >
                      <span>{skill}</span>
                      <button 
                        onClick={() => handleRemoveSkill(index)}
                        className="p-0.5 hover:bg-[#ffd9e2] rounded-full text-[#8e004b]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                  {skills.length === 0 && (
                    <p className="text-xs text-[#8c7077] italic py-4">No custom skills added yet. Add some skills above.</p>
                  )}
                </div>
              </div>
            )}

            {/* EXPERIENCE TAB */}
            {activeEditTab === 'experience' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-xs font-bold text-[#8e004b] uppercase tracking-wide">Salon & Professional Experience</h3>

                {/* Add new form */}
                <div className="bg-[#fdf8f8] p-4 rounded-xl border border-[#e0bec6]/40 space-y-3">
                  <h4 className="text-xs font-bold text-[#1c1b1b] flex items-center gap-1"><Plus className="w-4 h-4 text-[#8e004b]" /> Add New Experience</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input 
                      type="text" 
                      placeholder="Role (e.g. Senior Hair Colorist)" 
                      value={newExp.title || ''}
                      onChange={(e) => setNewExp({ ...newExp, title: e.target.value })}
                      className="bg-white border border-[#e0bec6]/60 rounded-lg p-2.5 text-xs focus:outline-none text-[#1c1b1b]"
                    />
                    <input 
                      type="text" 
                      placeholder="Salon/Company (e.g. Lumiere Studio)" 
                      value={newExp.salonName || ''}
                      onChange={(e) => setNewExp({ ...newExp, salonName: e.target.value })}
                      className="bg-white border border-[#e0bec6]/60 rounded-lg p-2.5 text-xs focus:outline-none text-[#1c1b1b]"
                    />
                    <input 
                      type="text" 
                      placeholder="Location (e.g. Los Angeles, CA)" 
                      value={newExp.location || ''}
                      onChange={(e) => setNewExp({ ...newExp, location: e.target.value })}
                      className="bg-white border border-[#e0bec6]/60 rounded-lg p-2.5 text-xs focus:outline-none text-[#1c1b1b]"
                    />
                    <input 
                      type="text" 
                      placeholder="Period (e.g. 2024 - Present)" 
                      value={newExp.period || ''}
                      onChange={(e) => setNewExp({ ...newExp, period: e.target.value })}
                      className="bg-white border border-[#e0bec6]/60 rounded-lg p-2.5 text-xs focus:outline-none text-[#1c1b1b]"
                    />
                  </div>
                  <textarea 
                    placeholder="Short description of your responsibilities, techniques used, and achievements..."
                    rows={2}
                    value={newExp.description || ''}
                    onChange={(e) => setNewExp({ ...newExp, description: e.target.value })}
                    className="w-full bg-white border border-[#e0bec6]/60 rounded-lg p-2.5 text-xs focus:outline-none text-[#1c1b1b]"
                  />
                  <button 
                    onClick={handleAddExperience}
                    className="px-4 py-2 bg-[#8e004b] text-white rounded-lg text-xs font-bold hover:bg-[#b90064] cursor-pointer"
                  >
                    Add Position
                  </button>
                </div>

                {/* Existing entries */}
                <div className="space-y-3 pt-2">
                  {experiences.map((exp) => (
                    <div key={exp.id} className="p-3.5 border border-[#e0bec6]/50 rounded-xl flex justify-between items-start hover:border-[#8e004b]/30">
                      <div>
                        <h4 className="text-xs font-bold text-[#1c1b1b]">{exp.title}</h4>
                        <p className="text-[11px] text-[#594047] font-semibold">{exp.salonName} • {exp.location}</p>
                        <p className="text-[10px] text-[#8c7077] mt-0.5">{exp.period}</p>
                        {exp.description && <p className="text-[11px] text-[#594047] mt-1.5 italic">"{exp.description}"</p>}
                      </div>
                      <button 
                        onClick={() => handleRemoveExperience(exp.id)}
                        className="p-1.5 text-[#8c7077] hover:text-[#ba1a1a] rounded-lg"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* EDUCATION TAB */}
            {activeEditTab === 'education' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-xs font-bold text-[#8e004b] uppercase tracking-wide">Education & Beauty School Training</h3>

                {/* Add new education */}
                <div className="bg-[#fdf8f8] p-4 rounded-xl border border-[#e0bec6]/40 space-y-3">
                  <h4 className="text-xs font-bold text-[#1c1b1b] flex items-center gap-1"><Plus className="w-4 h-4 text-[#8e004b]" /> Add Education Entry</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input 
                      type="text" 
                      placeholder="School/Institution Name" 
                      value={newEdu.schoolName || ''}
                      onChange={(e) => setNewEdu({ ...newEdu, schoolName: e.target.value })}
                      className="bg-white border border-[#e0bec6]/60 rounded-lg p-2.5 text-xs focus:outline-none text-[#1c1b1b]"
                    />
                    <input 
                      type="text" 
                      placeholder="Degree/Certificate Awarded" 
                      value={newEdu.degree || ''}
                      onChange={(e) => setNewEdu({ ...newEdu, degree: e.target.value })}
                      className="bg-white border border-[#e0bec6]/60 rounded-lg p-2.5 text-xs focus:outline-none text-[#1c1b1b]"
                    />
                    <input 
                      type="text" 
                      placeholder="Period (e.g. 2018 - 2020)" 
                      value={newEdu.period || ''}
                      onChange={(e) => setNewEdu({ ...newEdu, period: e.target.value })}
                      className="bg-white border border-[#e0bec6]/60 rounded-lg p-2.5 text-xs focus:outline-none text-[#1c1b1b]"
                    />
                  </div>
                  <button 
                    onClick={handleAddEducation}
                    className="px-4 py-2 bg-[#8e004b] text-white rounded-lg text-xs font-bold hover:bg-[#b90064] cursor-pointer"
                  >
                    Add Education
                  </button>
                </div>

                {/* Existing educations list */}
                <div className="space-y-3 pt-2">
                  {educations.map((edu) => (
                    <div key={edu.id} className="p-3.5 border border-[#e0bec6]/50 rounded-xl flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-[#1c1b1b]">{edu.degree}</h4>
                        <p className="text-[11px] text-[#594047] font-semibold">{edu.schoolName}</p>
                        <p className="text-[10px] text-[#8c7077] mt-0.5">{edu.period}</p>
                      </div>
                      <button 
                        onClick={() => handleRemoveEducation(edu.id)}
                        className="p-1.5 text-[#8c7077] hover:text-[#ba1a1a] rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CERTIFICATIONS TAB */}
            {activeEditTab === 'certifications' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-xs font-bold text-[#8e004b] uppercase tracking-wide">Industry Licenses & Certifications</h3>

                {/* Add new certification */}
                <div className="bg-[#fdf8f8] p-4 rounded-xl border border-[#e0bec6]/40 space-y-3">
                  <h4 className="text-xs font-bold text-[#1c1b1b] flex items-center gap-1"><Plus className="w-4 h-4 text-[#8e004b]" /> Add Certification</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input 
                      type="text" 
                      placeholder="Certification Name (e.g. Master Ambassador)" 
                      value={newCert.name || ''}
                      onChange={(e) => setNewCert({ ...newCert, name: e.target.value })}
                      className="bg-white border border-[#e0bec6]/60 rounded-lg p-2.5 text-xs focus:outline-none text-[#1c1b1b]"
                    />
                    <input 
                      type="text" 
                      placeholder="Issuer (e.g. Kerastase)" 
                      value={newCert.issuer || ''}
                      onChange={(e) => setNewCert({ ...newCert, issuer: e.target.value })}
                      className="bg-white border border-[#e0bec6]/60 rounded-lg p-2.5 text-xs focus:outline-none text-[#1c1b1b]"
                    />
                    <input 
                      type="text" 
                      placeholder="License/Cert # (optional)" 
                      value={newCert.licenseNumber || ''}
                      onChange={(e) => setNewCert({ ...newCert, licenseNumber: e.target.value })}
                      className="bg-white border border-[#e0bec6]/60 rounded-lg p-2.5 text-xs focus:outline-none text-[#1c1b1b]"
                    />
                  </div>
                  <button 
                    onClick={handleAddCertification}
                    className="px-4 py-2 bg-[#8e004b] text-white rounded-lg text-xs font-bold hover:bg-[#b90064] cursor-pointer"
                  >
                    Add Certification
                  </button>
                </div>

                {/* Existing entries */}
                <div className="space-y-3 pt-2">
                  {certifications.map((cert) => (
                    <div key={cert.id} className="p-3.5 border border-[#e0bec6]/50 rounded-xl flex justify-between items-start">
                      <div>
                        <h4 className="text-xs font-bold text-[#1c1b1b]">{cert.name}</h4>
                        <p className="text-[11px] text-[#594047] font-semibold">{cert.issuer}</p>
                        {cert.licenseNumber && cert.licenseNumber !== 'N/A' && (
                          <p className="text-[10px] text-[#8c7077] mt-0.5">License: {cert.licenseNumber}</p>
                        )}
                      </div>
                      <button 
                        onClick={() => handleRemoveCertification(cert.id)}
                        className="p-1.5 text-[#8c7077] hover:text-[#ba1a1a] rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RESUME TAB */}
            {activeEditTab === 'resume' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-xs font-bold text-[#8e004b] uppercase tracking-wide">Manage Resume File</h3>
                
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                  onDragLeave={() => setIsDraggingOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      setResumeName(file.name);
                      triggerToast(`Dropped & updated: ${file.name}`);
                    }
                  }}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                    isDraggingOver 
                      ? 'border-[#8e004b] bg-[#ffd9e2]/20 scale-101' 
                      : 'border-[#e0bec6] hover:border-[#8e004b]/60'
                  }`}
                >
                  <Upload className="w-8 h-8 text-[#8e004b] mx-auto mb-2 animate-bounce" />
                  <p className="text-xs font-bold text-[#1c1b1b]">Drag & Drop your updated resume here</p>
                  <p className="text-[10px] text-[#594047] mt-0.5">Supports PDF, DOC, or DOCX formats up to 5MB</p>
                  
                  <div className="relative mt-4 inline-block">
                    <button className="px-4 py-2 bg-[#8e004b] text-white text-xs font-bold rounded-xl shadow-2xs hover:bg-[#b90064] cursor-pointer">
                      Browse Files
                    </button>
                    <input 
                      type="file" 
                      accept=".pdf,.doc,.docx" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setResumeName(file.name);
                          triggerToast(`Selected: ${file.name}`);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    />
                  </div>
                </div>

                <div className="bg-[#fdf8f8] border border-[#e0bec6]/60 p-4 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center shrink-0">
                      <FileText className="w-5.5 h-5.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1c1b1b] truncate">{resumeName}</p>
                      <p className="text-[10px] text-[#8c7077]">Ready and attached automatically to new applications</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => alert('Downloaded sample resume PDF')}
                    className="w-8 h-8 rounded-full bg-white border border-[#e0bec6]/60 flex items-center justify-center text-[#8e004b] hover:bg-[#ffd9e2]/30 cursor-pointer"
                    title="Download current file"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* PREFERENCES TAB */}
            {activeEditTab === 'preferences' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <h3 className="text-xs font-bold text-[#8e004b] uppercase tracking-wide">Salary & Target Preferences</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#1c1b1b]">Expected Compensation</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e004b] w-4 h-4" />
                      <input 
                        type="text" 
                        value={expectedSalary}
                        onChange={(e) => setExpectedSalary(e.target.value)}
                        placeholder="e.g. $45 - $55 / hour or $90,000 / year"
                        className="w-full bg-[#fdf8f8] text-[#1c1b1b] border border-[#e0bec6]/70 rounded-xl p-3 pl-8 focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b] text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#1c1b1b]">Preferred Job Type</label>
                    <select 
                      value={preferredJobType}
                      onChange={(e) => setPreferredJobType(e.target.value as any)}
                      className="w-full bg-[#fdf8f8] text-[#1c1b1b] border border-[#e0bec6]/70 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b] text-xs font-semibold"
                    >
                      <option value="Full-time">Full-time standard</option>
                      <option value="Part-time">Part-time standard</option>
                      <option value="Contract">Contract / Suite Rental</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="text-xs font-bold text-[#1c1b1b]">Availability / Notice Period</label>
                    <input 
                      type="text" 
                      value={availability}
                      onChange={(e) => setAvailability(e.target.value)}
                      placeholder="e.g. Immediate (no notice needed)"
                      className="w-full bg-[#fdf8f8] text-[#1c1b1b] border border-[#e0bec6]/70 rounded-xl p-3 focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b] text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Sticky Bottom Save CTA Bar */}
          <div className="fixed bottom-20 sm:bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-[#e0bec6]/40 p-4 z-40 shadow-[0_-4px_12px_rgba(90,63,71,0.06)]">
            <div className="max-w-4xl mx-auto flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-3 border border-[#8c7077] hover:bg-[#f1edec] rounded-full text-[#594047] text-xs font-bold transition-all cursor-pointer"
              >
                Discard Changes
              </button>
              <button
                type="button"
                onClick={handleSaveChanges}
                className="px-8 py-3 bg-[#8e004b] hover:bg-[#b90064] text-white rounded-full text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Embedded Floating Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-24 right-6 z-50 bg-[#1c1b1b] text-white px-4 py-3 rounded-2xl shadow-xl border border-white/20 flex items-center gap-2 text-xs font-bold animate-bounce">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

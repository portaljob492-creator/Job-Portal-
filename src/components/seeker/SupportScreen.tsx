import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  HelpCircle, 
  Search, 
  BookOpen, 
  FileText, 
  User, 
  FileCheck, 
  AlertTriangle, 
  Shield, 
  Flag, 
  AlertOctagon, 
  Lock, 
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle,
  X,
  Briefcase,
  Bookmark,
  Mail,
  Sparkles,
  Bell,
  Headphones,
  Check
} from 'lucide-react';

interface SupportScreenProps {
  onBack: () => void;
  onNavigateTab?: (tab: 'feed' | 'applications' | 'saved' | 'messages' | 'portfolio' | 'profile') => void;
}

interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

export const SupportScreen: React.FC<SupportScreenProps> = ({ onBack, onNavigateTab }) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Interactive Modals & subView Flow
  const [subView, setSubView] = useState<'home' | 'contact_form' | 'contact_success'>('home');
  const [activeModal, setActiveModal] = useState<'contact' | 'report_job' | 'report_employer' | 'live_chat' | null>(null);
  const [activeFaqCategory, setActiveFaqCategory] = useState<string | null>(null);

  // Form states
  const [issueType, setIssueType] = useState<string>('login');
  const [subject, setSubject] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: string; progress: number }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string>('#1025');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactEmail, setContactEmail] = useState('jane.doe@example.com');
  
  const [reportJobId, setReportJobId] = useState('');
  const [reportJobReason, setReportJobReason] = useState('');
  const [reportJobNotes, setReportJobNotes] = useState('');

  const [reportEmployerName, setReportEmployerName] = useState('');
  const [reportEmployerReason, setReportEmployerReason] = useState('');
  const [reportEmployerNotes, setReportEmployerNotes] = useState('');

  // Toast / Status state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Collapsible accordion for FAQs
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  // Simulated live chat states
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'Hello! 🌸 Welcome to Nexora Instant Support. I am your specialized beauty talent assistant. How can I help you today?',
      time: 'Just now'
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isTyping]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Drag and drop attachment functions
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  const addFiles = (fileList: FileList) => {
    const newFiles = Array.from(fileList).map(file => {
      let sizeStr = `${(file.size / 1024).toFixed(1)} KB`;
      if (file.size > 1024 * 1024) {
        sizeStr = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      }
      return {
        name: file.name,
        size: sizeStr,
        progress: 100
      };
    });
    setUploadedFiles(prev => [...prev, ...newFiles]);
    triggerToast(`📎 Attached ${newFiles.length} file(s).`);
  };

  const removeFile = (idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
    triggerToast("🗑️ Attachment removed.");
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      triggerToast('⚠️ Please fill out all required fields.');
      return;
    }
    const randomTicketId = `#${Math.floor(1020 + Math.random() * 8000)}`;
    setSubmittedTicketId(randomTicketId);
    setSubView('contact_success');
    triggerToast(`🎉 Support ticket ${randomTicketId} submitted successfully!`);
  };

  const handleBackToSupport = () => {
    setSubject('');
    setDescription('');
    setUploadedFiles([]);
    setSubView('home');
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactSubject.trim() || !contactMessage.trim()) {
      triggerToast('⚠️ Please fill out all required fields.');
      return;
    }
    triggerToast('🎉 Support ticket created successfully! We will reply at ' + contactEmail + ' within 2 hours.');
    setActiveModal(null);
    setContactSubject('');
    setContactMessage('');
  };

  const handleReportJobSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportJobReason) {
      triggerToast('⚠️ Please select a reason for reporting.');
      return;
    }
    triggerToast('✅ Report successfully submitted. Our Trust and Safety coordinators will investigate this job post immediately.');
    setActiveModal(null);
    setReportJobId('');
    setReportJobReason('');
    setReportJobNotes('');
  };

  const handleReportEmployerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportEmployerName.trim() || !reportEmployerReason) {
      triggerToast('⚠️ Please provide the salon name and violation reason.');
      return;
    }
    triggerToast('✅ Thank you. Report received for ' + reportEmployerName + '. We maintain a zero-tolerance policy for unprofessional salon conduct.');
    setActiveModal(null);
    setReportEmployerName('');
    setReportEmployerReason('');
    setReportEmployerNotes('');
  };

  // Static FAQ database
  const faqCategories: Record<string, { title: string; subtitle: string; icon: React.ReactNode; colorClass: string; items: { q: string; a: string }[] }> = {
    'Help Center': {
      title: 'Help Center',
      subtitle: 'Browse all articles and FAQs.',
      icon: <BookOpen className="w-5 h-5" />,
      colorClass: 'bg-[#ffd9e2] text-[#8e004b]',
      items: [
        { q: 'How does Nexora Jobs work?', a: 'Nexora is a premium job-matching platform designed exclusively for beauty professionals. Job seekers build beautiful portfolios, and salon owners post specific booth, commission, or hourly job openings.' },
        { q: 'Is there a fee for job seekers?', a: 'No, Nexora is 100% free for all beauty practitioners, stylists, estheticians, and massage therapists looking for work.' },
        { q: 'How do I schedule an interview?', a: 'When an employer reviews your beauty profile and is interested, they will send an Interview Invitation directly to your Applications dashboard. You can review and accept it.' }
      ]
    },
    'Application Help': {
      title: 'Application Help',
      subtitle: 'Track status and manage apps.',
      icon: <FileText className="w-5 h-5" />,
      colorClass: 'bg-[#f2dde9] text-[#51434c]',
      items: [
        { q: 'Can I withdraw a submitted job application?', a: 'Yes, you can go to your "My Applications" dashboard, select the application, and click "Withdraw Application" if it has not been processed yet.' },
        { q: 'How do I know if a salon viewed my application?', a: 'Your application status will update from "Submitted" to "Under Review". You will also receive an instant push notification on your workspace header.' },
        { q: 'Can I add a custom cover letter?', a: 'Yes! When you click apply, you are prompted with a quick cover note field where you can describe your experience and passion.' }
      ]
    },
    'Account Help': {
      title: 'Account Help',
      subtitle: 'Settings, login, and profile info.',
      icon: <User className="w-5 h-5" />,
      colorClass: 'bg-[#ffd9e2] text-[#e2007c]',
      items: [
        { q: 'How do I update my cosmetology or esthetician license?', a: 'Go to your "Beauty Profile" tab, click the edit button, and choose the "Licenses & Special Certifications" section to keep your active number current.' },
        { q: 'How do I change my profile headshot?', a: 'You can tap on your avatar headshot at the top right header to load the high-fidelity Profile Headshot Uploader & Camera module.' },
        { q: 'Can I switch from Seeker to Employer?', a: 'Yes, just click "Switch to Employer" in the main menu to toggle instantly to the employer dashboard and manage candidates.' }
      ]
    },
    'Resume Help': {
      title: 'Resume Help',
      subtitle: 'Uploads, formatting, and tips.',
      icon: <FileCheck className="w-5 h-5" />,
      colorClass: 'bg-[#f1edec] text-[#594047]',
      items: [
        { q: 'What formats are supported for resume uploads?', a: 'Nexora supports PDF, DOC, and DOCX formats up to 5MB. PDF is highly recommended to preserve styling.' },
        { q: 'Do I need to upload a resume for every job application?', a: 'No! Your resume file is stored securely on your Beauty Profile and is automatically sent to the salon whenever you apply.' },
        { q: 'How can I optimize my beauty resume?', a: 'Make sure to highlight your specialty techniques (e.g., Balayage, Foilayage, Dermal therapies), and list your Instagram handle so salons can preview your portfolio.' }
      ]
    },
    'Employer Issues': {
      title: 'Employer Issues',
      subtitle: 'Interactions and company info.',
      icon: <AlertTriangle className="w-5 h-5" />,
      colorClass: 'bg-[#f1edec] text-[#594047]',
      items: [
        { q: 'What should I do if an employer asks for personal banking info?', a: 'Never share your social security, banking details, or passcodes during initial conversations. Real salons pay through verified payrolls after onboarding.' },
        { q: 'The salon details do not match their description. What can I do?', a: 'You can use the "Report Employer" tool here on the Support tab to lodge an investigation request with our Trust team.' },
        { q: 'A salon has not replied to my messages.', a: 'Salons receive many applications. If you do not hear back within 5 business days, we recommend following up with a polite professional inquiry.' }
      ]
    },
    'Safety': {
      title: 'Safety',
      subtitle: 'Guidelines and secure practices.',
      icon: <Shield className="w-5 h-5" />,
      colorClass: 'bg-[#ffdad6] text-[#ba1a1a]',
      items: [
        { q: 'How does Nexora protect my personal details?', a: 'Your phone number and email are hidden from search engines and are only shared with salons to whom you actively submit applications.' },
        { q: 'What are safe salon interviewing practices?', a: 'We recommend conducting initial discussions on the Nexora platform or phone. For practical styling tests, verify the business address corresponds to a licensed brick-and-mortar salon.' }
      ]
    },
    'Privacy & Safety': {
      title: 'Privacy & Safety',
      subtitle: 'Data policies and security.',
      icon: <Lock className="w-5 h-5" />,
      colorClass: 'bg-[#f1edec] text-[#594047]',
      items: [
        { q: 'Who can see my work portfolio pictures?', a: 'Your portfolio pictures are visible on your profile page to verified salons and beauty employers looking to hire.' },
        { q: 'How do I delete my account data?', a: 'Please open a Contact Support ticket requesting account deletion. Our technical support team will wipe all personal records within 24 hours.' }
      ]
    }
  };

  // Predefined quick questions for the Live Chatbot
  const quickChatPrompts = [
    'How do I update my active cosmetology license?',
    'What resume formats are supported?',
    'Is Nexora completely free?',
    'How do I report a fake salon listing?'
  ];

  const handleSendMessage = (textToSend?: string) => {
    const rawText = textToSend || chatInput;
    if (!rawText.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: rawText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!textToSend) setChatInput('');
    setIsTyping(true);

    // Simulate bot response based on keywords
    setTimeout(() => {
      let botResponseText = "Thank you for asking! Our specialized team of talent managers has been notified. We will review your message and reply via chat or email within 10-15 minutes.";
      const query = rawText.toLowerCase();

      if (query.includes('license') || query.includes('cosmetology') || query.includes('credential')) {
        botResponseText = "To update your beauty license: Tap your Profile tab, click the Edit button in the top right, scroll down to 'Licenses & Certifications', and fill in your current license details and state registration.";
      } else if (query.includes('resume') || query.includes('pdf') || query.includes('upload')) {
        botResponseText = "Nexora supports PDF, DOC, and DOCX formats (max 5MB). We highly recommend PDF to ensure your layout looks flawless to salon owners. Upload it once on your Beauty Profile to use it for all applications.";
      } else if (query.includes('free') || query.includes('cost') || query.includes('pay')) {
        botResponseText = "Nexora is 100% free for job seekers, stylists, estheticians, and beauty creators! There are no hidden fees or commissions taken from your salary.";
      } else if (query.includes('report') || query.includes('fake') || query.includes('scam') || query.includes('suspicious')) {
        botResponseText = "Your safety is our top priority! If a listing seems fake, please tap 'Report Job' on the main support bento grid. Provide the salon name, selection reason, and notes, and our Trust team will investigate within 1 hour.";
      } else if (query.includes('interview') || query.includes('invitation')) {
        botResponseText = "When a salon owner invites you to interview, you will receive a notification and a record under your 'Apps' tab. You can view details, accept, suggest a new time, or decline from there.";
      }

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: botResponseText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatMessages(prev => [...prev, botMsg]);
      setIsTyping(false);
    }, 1200);
  };

  // Deep search logic across all FAQs
  const matchedFaqItems: { category: string; q: string; a: string }[] = [];
  if (searchQuery.trim().length > 1) {
    Object.entries(faqCategories).forEach(([catName, catData]) => {
      catData.items.forEach(item => {
        if (
          item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.a.toLowerCase().includes(searchQuery.toLowerCase()) ||
          catName.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          matchedFaqItems.push({
            category: catName,
            q: item.q,
            a: item.a
          });
        }
      });
    });
  }

  if (subView === 'contact_form') {
    return (
      <div className="min-h-screen bg-[#fdf8f8] text-[#1c1b1b] pb-24 relative select-none font-body-md">
        {/* TopAppBar exact replication of the HTML mock style */}
        <header className="sticky top-0 bg-white border-b border-[#e0bec6]/30 px-margin-side h-16 w-full flex justify-between items-center z-40 shadow-[0_4px_12px_rgba(90,63,71,0.05)]">
          <button 
            onClick={() => setSubView('home')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ffd9e2]/50 text-[#8e004b] transition-colors active:scale-95 duration-200 cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-screen-title text-base font-extrabold text-[#8e004b] tracking-tight absolute left-1/2 -translate-x-1/2">
            Contact Support
          </h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </header>

        {/* Main Content */}
        <main className="max-w-2xl mx-auto px-margin-side py-8 space-y-6">
          <p className="text-xs text-[#594047] text-center max-w-md mx-auto leading-relaxed">
            Need assistance? Fill out the form below and our beauty and wellness support team will get back to you shortly.
          </p>

          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* Issue Type */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#1c1b1b]">What can we help you with?</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'login', label: 'Login' },
                  { value: 'account', label: 'Account' },
                  { value: 'application', label: 'Application' },
                  { value: 'job_listing', label: 'Job Listing' },
                  { value: 'employer', label: 'Employer' },
                  { value: 'safety', label: 'Safety' },
                  { value: 'other', label: 'Other' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setIssueType(item.value)}
                    className={`px-4 py-2 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                      issueType === item.value
                        ? 'bg-[#ffd9e2] text-[#8e004b] border-[#8e004b] shadow-sm'
                        : 'border-[#e0bec6] text-[#594047] hover:bg-[#f1edec]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1c1b1b]" htmlFor="subject">Subject</label>
              <input
                id="subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief summary of your issue"
                className="w-full bg-[#f1edec] border-transparent focus:border-[#8e004b] focus:bg-white focus:ring-1 focus:ring-[#8e004b] rounded-lg py-3 px-4 text-xs font-semibold text-[#1c1b1b] placeholder:text-[#8c7077]/60 transition-colors outline-none"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1c1b1b]" htmlFor="description">Description</label>
              <textarea
                id="description"
                required
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please provide detailed information about the issue you are experiencing..."
                className="w-full bg-[#f1edec] border-transparent focus:border-[#8e004b] focus:bg-white focus:ring-1 focus:ring-[#8e004b] rounded-lg py-3 px-4 text-xs font-semibold text-[#1c1b1b] placeholder:text-[#8c7077]/60 transition-colors custom-scrollbar resize-y outline-none"
              />
            </div>

            {/* Screenshot Upload with drag and drop */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1c1b1b]">Attachments</label>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group ${
                  isDragging 
                    ? 'border-[#8e004b] bg-[#ffd9e2]/15' 
                    : 'border-[#e0bec6] bg-[#f1edec]/40 hover:bg-[#f1edec]/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="material-symbols-outlined text-4xl text-[#8c7077] group-hover:text-[#8e004b] transition-colors mb-2">
                  cloud_upload
                </span>
                <span className="text-xs font-bold text-[#594047] group-hover:text-[#1c1b1b] transition-colors">
                  Upload screenshots (Optional)
                </span>
                <span className="text-[10px] text-[#8c7077] mt-1">
                  PNG, JPG, or PDF up to 5MB
                </span>
              </div>

              {/* Uploaded Files list */}
              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-[#e0bec6]/30 text-xs shadow-xs">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#8e004b]" />
                        <div>
                          <p className="font-bold text-[#1c1b1b] truncate max-w-[200px]">{file.name}</p>
                          <p className="text-[10px] text-[#8c7077]">{file.size}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="text-[#ba1a1a] hover:bg-[#ffdad6] p-1.5 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-[#b90064] text-white font-bold text-xs rounded-full py-4 px-6 hover:bg-[#8e004b] transition-all active:scale-95 shadow-[0_4px_12px_rgba(185,0,100,0.2)] flex justify-center items-center gap-2 cursor-pointer"
              >
                <span>Submit Ticket</span>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </main>

        {/* Simulated Toast Overlay */}
        {toastMessage && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1c1b1b]/95 text-white px-5 py-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-2.5 text-xs font-bold animate-bounce text-center whitespace-nowrap">
            <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  if (subView === 'contact_success') {
    return (
      <div className="min-h-screen bg-[#fdf8f8] text-[#1c1b1b] pb-24 relative select-none font-body-md flex flex-col justify-between">
        {/* TopAppBar */}
        <header className="sticky top-0 bg-white border-b border-[#e0bec6]/30 px-margin-side h-16 w-full flex justify-between items-center z-40 shadow-[0_4px_12px_rgba(90,63,71,0.05)]">
          <button 
            onClick={() => setSubView('home')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ffd9e2]/50 text-[#8e004b] transition-colors active:scale-95 duration-200 cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-screen-title text-base font-extrabold text-[#8e004b] tracking-tight absolute left-1/2 -translate-x-1/2">
            Ticket Submitted
          </h1>
          <div className="w-10"></div>
        </header>

        {/* Success View */}
        <main className="flex-1 max-w-md mx-auto w-full flex flex-col items-center justify-center p-6 min-h-[60vh]">
          <div className="bg-white rounded-2xl border border-[#e0bec6]/30 shadow-[0_8px_24px_rgba(90,63,71,0.08)] p-8 flex flex-col items-center text-center w-full">
            <div className="w-20 h-20 rounded-full bg-[#ffd9e2] flex items-center justify-center mb-6 shadow-xs">
              <CheckCircle className="w-10 h-10 text-[#8e004b]" />
            </div>
            
            <h2 className="text-sm font-bold text-[#1c1b1b] mb-2">Support request submitted</h2>
            <p className="text-[11px] text-[#594047] mb-6 leading-relaxed">
              Thank you for reaching out. Our beauty and wellness support team will review your ticket and get back to you shortly.
            </p>

            <div className="bg-[#f1edec] py-3 px-8 rounded-xl mb-8 border border-[#e0bec6]/20">
              <span className="text-[10px] font-bold text-[#8c7077] uppercase tracking-widest block">Ticket ID</span>
              <p className="text-sm font-extrabold text-[#8e004b] mt-1">{submittedTicketId}</p>
            </div>

            <button
              onClick={handleBackToSupport}
              className="w-full bg-[#f1edec] text-[#1c1b1b] font-bold text-xs rounded-full py-4 px-6 hover:bg-[#e0bec6]/50 transition-colors border border-[#e0bec6]/50 active:scale-95 cursor-pointer"
            >
              Back to Support
            </button>
          </div>
        </main>

        {/* Simulated Toast Overlay */}
        {toastMessage && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1c1b1b]/95 text-white px-5 py-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-2.5 text-xs font-bold animate-bounce text-center whitespace-nowrap">
            <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf8f8] text-[#1c1b1b] pb-24 relative select-none font-body-md">
      
      {/* TopAppBar exact replication of the HTML mock style */}
      <header className="sticky top-0 bg-white border-b border-[#e0bec6]/30 px-margin-side h-16 w-full flex justify-between items-center z-40 shadow-[0_4px_12px_rgba(90,63,71,0.05)]">
        <button 
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ffd9e2]/50 text-[#8e004b] transition-colors active:scale-95 duration-200 cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="flex items-center gap-1 justify-center">
            <Sparkles className="w-4 h-4 text-[#8e004b]" />
            <h1 className="font-screen-title text-base font-extrabold text-[#8e004b] tracking-tight">Nexora Jobs</h1>
          </div>
          <span className="text-[9px] font-bold text-[#8c7077] uppercase tracking-wider block bg-[#ffd9e2]/30 px-2 py-0.5 rounded-md mt-0.5 font-mono">
            /app/jobs/support
          </span>
        </div>
        <button 
          onClick={() => triggerToast("🔔 Checking for new beauty workspace alerts...")}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#ffd9e2]/50 text-[#8c7077] transition-colors active:scale-95 duration-200 cursor-pointer"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5 text-[#8e004b]" />
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-margin-side py-6 space-y-6">
        
        {/* Support Banner Card with premium gradient background */}
        <section className="bg-gradient-to-r from-[#8e004b] via-[#b50062] to-[#e2007c] text-white rounded-2xl p-6 shadow-[0_4px_12px_rgba(90,63,71,0.05)] border border-white/10 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
          <div className="relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Support & Trust Center</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight">How can we help?</h2>
            <p className="text-xs text-white/90 leading-relaxed max-w-xl">
              Search vetted cosmetology support guides, launch safety reporting investigations, or engage with live coordinator specialists to build your beauty business safely.
            </p>
          </div>
        </section>

        {/* Live Search Bar exactly matching HTML */}
        <section className="relative">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8c7077] group-focus-within:text-[#8e004b] transition-colors w-5 h-5" />
            <input
              type="text"
              placeholder="Search help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#f1edec] py-3.5 pl-12 pr-12 rounded-lg border border-transparent focus:bg-white focus:border-[#8e004b] focus:ring-1 focus:ring-[#8e004b] outline-none transition-all duration-200 text-sm placeholder:text-[#8c7077] shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8c7077] hover:text-[#8e004b] bg-white/60 p-1 rounded-md"
              >
                Clear
              </button>
            )}
          </div>
        </section>

        {/* Search Results Drawer */}
        {searchQuery.trim().length > 1 && (
          <section className="bg-white p-5 rounded-2xl border border-[#e0bec6] shadow-sm space-y-3.5 animate-in fade-in duration-200">
            <h3 className="text-xs font-extrabold text-[#8e004b] uppercase tracking-wider flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              Found {matchedFaqItems.length} matching questions & answers
            </h3>
            
            {matchedFaqItems.length > 0 ? (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 divide-y divide-[#e0bec6]/30">
                {matchedFaqItems.map((item, idx) => (
                  <div key={idx} className="pt-2.5 first:pt-0 space-y-1">
                    <span className="text-[10px] font-extrabold text-[#e2007c] bg-[#ffd9e2]/30 px-2 py-0.5 rounded-md uppercase tracking-wide">
                      {item.category}
                    </span>
                    <h4 className="text-xs font-extrabold text-[#1c1b1b]">{item.q}</h4>
                    <p className="text-xs text-[#594047] leading-relaxed bg-[#fdf8f8] p-2.5 rounded-lg border border-[#e0bec6]/20">
                      {item.a}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#8c7077] py-2">
                No matching FAQ contents found. Try searching simple keywords like 'license', 'resume', 'safe', or 'apply'.
              </p>
            )}
          </section>
        )}

        {/* Bento Grid layout representing the 9 Category Cards */}
        <section className="space-y-3">
          <h3 className="text-xs font-extrabold text-[#594047] uppercase tracking-wider">Help Directories & Trust Services</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* 1. Help Center Card */}
            <button
              onClick={() => { setActiveFaqCategory('Help Center'); setExpandedFaq(null); }}
              className="bg-white border border-[#e0bec6]/50 rounded-xl p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] hover:shadow-md hover:bg-[#f1edec]/50 transition-all duration-200 flex items-start gap-4 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-xs text-[#1c1b1b] group-hover:text-[#8e004b] transition-colors mb-1">Help Center</h4>
                <p className="text-[11px] text-[#594047] leading-tight">Browse all articles and FAQs.</p>
              </div>
            </button>

            {/* 2. Application Help Card */}
            <button
              onClick={() => { setActiveFaqCategory('Application Help'); setExpandedFaq(null); }}
              className="bg-white border border-[#e0bec6]/50 rounded-xl p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] hover:shadow-md hover:bg-[#f1edec]/50 transition-all duration-200 flex items-start gap-4 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-xs text-[#1c1b1b] group-hover:text-[#8e004b] transition-colors mb-1">Application Help</h4>
                <p className="text-[11px] text-[#594047] leading-tight">Track status and manage apps.</p>
              </div>
            </button>

            {/* 3. Account Help Card */}
            <button
              onClick={() => { setActiveFaqCategory('Account Help'); setExpandedFaq(null); }}
              className="bg-white border border-[#e0bec6]/50 rounded-xl p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] hover:shadow-md hover:bg-[#f1edec]/50 transition-all duration-200 flex items-start gap-4 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-xs text-[#1c1b1b] group-hover:text-[#8e004b] transition-colors mb-1">Account Help</h4>
                <p className="text-[11px] text-[#594047] leading-tight">Settings, login, and profile info.</p>
              </div>
            </button>

            {/* 4. Resume Help Card */}
            <button
              onClick={() => { setActiveFaqCategory('Resume Help'); setExpandedFaq(null); }}
              className="bg-white border border-[#e0bec6]/50 rounded-xl p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] hover:shadow-md hover:bg-[#f1edec]/50 transition-all duration-200 flex items-start gap-4 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-xs text-[#1c1b1b] group-hover:text-[#8e004b] transition-colors mb-1">Resume Help</h4>
                <p className="text-[11px] text-[#594047] leading-tight">Uploads, formatting, and tips.</p>
              </div>
            </button>

            {/* 5. Employer Issues Card */}
            <button
              onClick={() => { setActiveFaqCategory('Employer Issues'); setExpandedFaq(null); }}
              className="bg-white border border-[#e0bec6]/50 rounded-xl p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] hover:shadow-md hover:bg-[#f1edec]/50 transition-all duration-200 flex items-start gap-4 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-xs text-[#1c1b1b] group-hover:text-[#8e004b] transition-colors mb-1">Employer Issues</h4>
                <p className="text-[11px] text-[#594047] leading-tight">Interactions and company info.</p>
              </div>
            </button>

            {/* 6. Safety Card */}
            <button
              onClick={() => { setActiveFaqCategory('Safety'); setExpandedFaq(null); }}
              className="bg-white border border-[#e0bec6]/50 rounded-xl p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] hover:shadow-md hover:bg-[#f1edec]/50 transition-all duration-200 flex items-start gap-4 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#ffdad6] text-[#ba1a1a] flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-xs text-[#1c1b1b] group-hover:text-[#8e004b] transition-colors mb-1">Safety</h4>
                <p className="text-[11px] text-[#594047] leading-tight">Guidelines and secure practices.</p>
              </div>
            </button>

            {/* 7. Report Job Card */}
            <button
              onClick={() => setActiveModal('report_job')}
              className="bg-white border border-[#e0bec6]/50 rounded-xl p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] hover:shadow-md hover:bg-amber-50/40 transition-all duration-200 flex items-start gap-4 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-xs text-[#1c1b1b] group-hover:text-amber-700 transition-colors mb-1">Report Job</h4>
                <p className="text-[11px] text-[#594047] leading-tight">Flag suspicious listings.</p>
              </div>
            </button>

            {/* 8. Report Employer Card */}
            <button
              onClick={() => setActiveModal('report_employer')}
              className="bg-white border border-[#e0bec6]/50 rounded-xl p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] hover:shadow-md hover:bg-rose-50/40 transition-all duration-200 flex items-start gap-4 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-xs text-[#1c1b1b] group-hover:text-rose-700 transition-colors mb-1">Report Employer</h4>
                <p className="text-[11px] text-[#594047] leading-tight">Report inappropriate conduct.</p>
              </div>
            </button>

            {/* 9. Privacy & Safety Card */}
            <button
              onClick={() => { setActiveFaqCategory('Privacy & Safety'); setExpandedFaq(null); }}
              className="bg-white border border-[#e0bec6]/50 rounded-xl p-4 shadow-[0_4px_12px_rgba(90,63,71,0.05)] hover:shadow-md hover:bg-[#f1edec]/50 transition-all duration-200 flex items-start gap-4 text-left group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-[#f1edec] text-[#594047] flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-xs text-[#1c1b1b] group-hover:text-[#8e004b] transition-colors mb-1">Privacy & Safety</h4>
                <p className="text-[11px] text-[#594047] leading-tight">Data policies and security.</p>
              </div>
            </button>

          </div>
        </section>

        {/* Dynamic Accordion Section for FAQ Category Articles */}
        {activeFaqCategory && faqCategories[activeFaqCategory] && (
          <section className="bg-white p-5 rounded-2xl border border-[#e0bec6] shadow-sm space-y-4 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between pb-3 border-b border-[#e0bec6]/30">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${faqCategories[activeFaqCategory].colorClass}`}>
                  {faqCategories[activeFaqCategory].icon}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#1c1b1b]">{faqCategories[activeFaqCategory].title} Guides</h3>
                  <p className="text-[10px] text-[#8c7077]">{faqCategories[activeFaqCategory].subtitle}</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveFaqCategory(null)}
                className="text-xs font-extrabold text-[#8c7077] hover:text-[#8e004b] hover:bg-[#ffd9e2]/30 px-3 py-1 rounded-full transition-all cursor-pointer"
              >
                Close Folder
              </button>
            </div>

            <div className="space-y-2">
              {faqCategories[activeFaqCategory].items.map((item, index) => (
                <div key={index} className="border border-[#e0bec6]/30 rounded-xl overflow-hidden bg-[#fdf8f8]">
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                    className="w-full p-3.5 hover:bg-[#ffd9e2]/10 text-left text-xs font-extrabold text-[#1c1b1b] flex items-center justify-between gap-3"
                  >
                    <span>{item.q}</span>
                    {expandedFaq === index ? <ChevronUp className="w-4 h-4 text-[#8e004b]" /> : <ChevronDown className="w-4 h-4 text-[#8c7077]" />}
                  </button>
                  {expandedFaq === index && (
                    <div className="p-4 bg-white border-t border-[#e0bec6]/20 text-xs text-[#594047] leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* "Still Need Help?" Contact Support Area (Faithfully rendered from HTML) */}
        <section className="bg-white border border-[#e0bec6]/60 rounded-xl p-8 shadow-[0_4px_12px_rgba(90,63,71,0.05)] text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#8e004b]/5 rounded-bl-full pointer-events-none" />
          
          <div className="relative z-10 space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center">
              <Headphones className="w-8 h-8" />
            </div>
            
            <div className="space-y-1">
              <h2 className="font-extrabold text-base text-[#1c1b1b]">Still need help?</h2>
              <p className="text-xs text-[#594047] max-w-md mx-auto leading-relaxed">
                Our specialized salon success advisors and Trust specialists are available to answer licensing questions or help clear up application hold-ups.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <button 
                onClick={() => setActiveModal('live_chat')}
                className="bg-[#e6007e] hover:bg-[#b90064] text-white rounded-full px-8 py-3.5 font-bold text-xs shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                Live Chat Helper
              </button>
              <button 
                onClick={() => { setSubView('contact_form'); setIssueType('login'); }}
                className="bg-white text-[#8e004b] border border-[#e0bec6] rounded-full px-8 py-3.5 font-bold text-xs hover:bg-[#f1edec] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mail className="w-4 h-4" />
                Email Support Ticket
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* CONTACT/EMAIL SUPPORT MODAL */}
      {activeModal === 'contact' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#e0bec6] space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-[#e0bec6]/30">
              <div className="flex items-center gap-2 text-[#8e004b]">
                <Mail className="w-5 h-5" />
                <h3 className="text-sm font-extrabold text-[#1c1b1b]">Open Support Ticket</h3>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-[#8c7077] hover:text-[#1c1b1b] hover:bg-[#f1edec] rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#594047] uppercase tracking-wider">Communication Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#e0bec6]/60 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b]"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#594047] uppercase tracking-wider">Subject / Help Topic</label>
                <input
                  type="text"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#e0bec6]/60 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b]"
                  placeholder="e.g., Cosmetology state transfer, upload failure"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#594047] uppercase tracking-wider">Describe your issue in detail</label>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  rows={4}
                  className="w-full p-3 rounded-xl border border-[#e0bec6]/60 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#8e004b] focus:border-[#8e004b] resize-none"
                  placeholder="Please list license numbers, job titles, or files involved if applicable..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-3 rounded-full border border-[#8c7077] text-[#594047] font-bold text-xs hover:bg-[#f1edec] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#8e004b] hover:bg-[#b90064] text-white font-bold text-xs rounded-full shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Ticket</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPORT JOB MODAL */}
      {activeModal === 'report_job' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#e0bec6] space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-[#e0bec6]/30">
              <div className="flex items-center gap-2 text-amber-600">
                <Flag className="w-5 h-5 animate-pulse" />
                <h3 className="text-sm font-extrabold text-[#1c1b1b]">Report Job Posting</h3>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-[#8c7077] hover:text-[#1c1b1b] hover:bg-[#f1edec] rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReportJobSubmit} className="space-y-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#594047] uppercase tracking-wider">Job Listing Title or ID</label>
                <input
                  type="text"
                  value={reportJobId}
                  onChange={(e) => setReportJobId(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#e0bec6]/60 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-600 focus:border-amber-600"
                  placeholder="e.g., #job-101 or Balayage Hair Stylist"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#594047] uppercase tracking-wider">Reason for reporting</label>
                <select
                  value={reportJobReason}
                  onChange={(e) => setReportJobReason(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#e0bec6]/60 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-600 focus:border-amber-600 bg-white"
                  required
                >
                  <option value="">-- Select reason --</option>
                  <option value="scam">Fake job / Scam / Fraudulent offer</option>
                  <option value="inaccurate">Inaccurate commission/salary split</option>
                  <option value="unlicensed">Operating without appropriate state license</option>
                  <option value="spam">Duplicate spam listing</option>
                  <option value="other">Other trust issue</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#594047] uppercase tracking-wider">Additional Trust Information</label>
                <textarea
                  value={reportJobNotes}
                  onChange={(e) => setReportJobNotes(e.target.value)}
                  rows={3}
                  className="w-full p-3 rounded-xl border border-[#e0bec6]/60 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-600 focus:border-amber-600 resize-none"
                  placeholder="Provide any chat excerpts or salon details that demonstrate the violation..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-3 rounded-full border border-[#8c7077] text-[#594047] font-bold text-xs hover:bg-[#f1edec] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-full shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Submit Report</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPORT EMPLOYER MODAL */}
      {activeModal === 'report_employer' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#e0bec6] space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-[#e0bec6]/30">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertOctagon className="w-5 h-5 animate-pulse" />
                <h3 className="text-sm font-extrabold text-[#1c1b1b]">Report Employer / Salon</h3>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-[#8c7077] hover:text-[#1c1b1b] hover:bg-[#f1edec] rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReportEmployerSubmit} className="space-y-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#594047] uppercase tracking-wider">Salon / Corporate Employer Name</label>
                <input
                  type="text"
                  value={reportEmployerName}
                  onChange={(e) => setReportEmployerName(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#e0bec6]/60 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-600 focus:border-rose-600"
                  placeholder="e.g. Lumière Salon and Spa"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#594047] uppercase tracking-wider">Violations committed</label>
                <select
                  value={reportEmployerReason}
                  onChange={(e) => setReportEmployerReason(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#e0bec6]/60 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-600 focus:border-rose-600 bg-white"
                  required
                >
                  <option value="">-- Select reason --</option>
                  <option value="impersonation">Impersonating another business</option>
                  <option value="harassment">Abusive/discriminatory messaging</option>
                  <option value="financial_scam">Demanding upfront security deposits / booth fees</option>
                  <option value="offline_terms">Unsafe demands outside platform</option>
                  <option value="other">Unlicensed salon operation</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-[#594047] uppercase tracking-wider">Detailed Incident Description</label>
                <textarea
                  value={reportEmployerNotes}
                  onChange={(e) => setReportEmployerNotes(e.target.value)}
                  rows={3}
                  className="w-full p-3 rounded-xl border border-[#e0bec6]/60 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-600 focus:border-rose-600 resize-none"
                  placeholder="Tell us exactly what occurred, including dates and messages..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 py-3 rounded-full border border-[#8c7077] text-[#594047] font-bold text-xs hover:bg-[#f1edec] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-full shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>Submit Safety Case</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INTERACTIVE LIVE CHAT WORKSPACE MODAL */}
      {activeModal === 'live_chat' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full h-[520px] flex flex-col shadow-2xl border border-[#e0bec6] overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Chat header */}
            <div className="bg-gradient-to-r from-[#8e004b] to-[#e2007c] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                  <Headphones className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold tracking-tight">Nexora Chat Assistant</h3>
                  <p className="text-[10px] text-white/80 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping inline-block" />
                    Online & Vetted
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setActiveModal(null)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages workspace area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#fdf8f8] text-xs">
              
              {chatMessages.map(msg => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl p-3.5 space-y-1 ${
                    msg.sender === 'user' 
                      ? 'bg-[#8e004b] text-white rounded-br-none' 
                      : 'bg-white text-[#1c1b1b] border border-[#e0bec6]/40 rounded-bl-none shadow-xs'
                  }`}>
                    <p className="leading-relaxed">{msg.text}</p>
                    <span className="block text-[8px] text-right opacity-60 font-mono">
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-[#e0bec6]/40 rounded-2xl p-3.5 rounded-bl-none shadow-xs text-[#8c7077] italic text-[11px] flex items-center gap-1.5">
                    <span className="w-1 h-1 bg-[#8e004b] rounded-full animate-bounce" />
                    <span className="w-1 h-1 bg-[#8e004b] rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1 h-1 bg-[#8e004b] rounded-full animate-bounce [animation-delay:0.4s]" />
                    Assistant is typing advice...
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Quick action helper prompt tags */}
            <div className="p-2 border-t border-[#e0bec6]/30 bg-[#f1edec]/40 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none">
              {quickChatPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(p)}
                  className="bg-white border border-[#e0bec6] rounded-full px-3 py-1.5 text-[10px] text-[#8e004b] font-bold hover:bg-[#ffd9e2]/20 shrink-0 transition-colors cursor-pointer"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Chat bottom keyboard panel */}
            <div className="p-3 border-t border-[#e0bec6]/30 bg-white flex items-center gap-2">
              <input
                type="text"
                placeholder="Ask about licenses, resume tips or support guides..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1 bg-[#f1edec] py-2.5 px-4 rounded-xl border border-transparent focus:bg-white focus:border-[#8e004b] outline-none text-xs transition-all"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!chatInput.trim()}
                className="w-10 h-10 rounded-full bg-[#8e004b] disabled:bg-[#8c7077]/40 text-white flex items-center justify-center shrink-0 hover:bg-[#b90064] transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Simulated Toast Overlay */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1c1b1b]/95 text-white px-5 py-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-2.5 text-xs font-bold animate-bounce text-center whitespace-nowrap">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Vetted 5-item Bottom Navigation bar representing active Support status */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center py-3 bg-white border-t border-[#e0bec6]/40 z-30 sm:hidden shadow-[0_-4px_12px_rgba(90,63,71,0.05)]">
        <button 
          onClick={() => {
            onBack();
            if (onNavigateTab) onNavigateTab('feed');
          }}
          className="flex flex-col items-center justify-center text-[#594047] hover:text-[#8e004b] active:scale-90 transition-transform w-16 cursor-pointer"
        >
          <Briefcase className="w-5 h-5 text-[#8c7077]" />
          <span className="text-[10px] font-bold mt-1 text-[#8c7077]">Jobs</span>
        </button>
        <button 
          onClick={() => {
            onBack();
            if (onNavigateTab) onNavigateTab('applications');
          }}
          className="flex flex-col items-center justify-center text-[#594047] hover:text-[#8e004b] active:scale-90 transition-transform w-16 cursor-pointer"
        >
          <FileText className="w-5 h-5 text-[#8c7077]" />
          <span className="text-[10px] font-bold mt-1 text-[#8c7077]">Apps</span>
        </button>
        <button 
          onClick={() => {
            onBack();
            if (onNavigateTab) onNavigateTab('saved');
          }}
          className="flex flex-col items-center justify-center text-[#594047] hover:text-[#8e004b] active:scale-90 transition-transform w-16 cursor-pointer"
        >
          <Bookmark className="w-5 h-5 text-[#8c7077]" />
          <span className="text-[10px] font-bold mt-1 text-[#8c7077]">Saved</span>
        </button>
        <button 
          className="flex flex-col items-center justify-center bg-[#ffd9e2] text-[#8e004b] rounded-full px-4 py-1.5 active:scale-90 transition-transform cursor-pointer"
        >
          <Headphones className="w-5 h-5 text-[#8e004b]" />
          <span className="text-[10px] font-bold mt-0.5 text-[#8e004b]">Support</span>
        </button>
        <button 
          onClick={() => {
            onBack();
            if (onNavigateTab) onNavigateTab('profile');
          }}
          className="flex flex-col items-center justify-center text-[#594047] hover:text-[#8e004b] active:scale-90 transition-transform w-16 cursor-pointer"
        >
          <User className="w-5 h-5 text-[#8c7077]" />
          <span className="text-[10px] font-bold mt-1 text-[#8c7077]">Profile</span>
        </button>
      </nav>
    </div>
  );
};

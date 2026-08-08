import React, { useState } from 'react';
import { JobPosting, Applicant, UserProfile } from '../../types';
import { ProfileImageUploader } from '../profile/ProfileImageUploader';
import {
  Plus,
  Building2,
  Users,
  Briefcase,
  CheckCircle2,
  Calendar,
  Clock,
  X,
  Phone,
  Mail,
  FileText,
  UserCheck,
  ChevronRight,
  LogOut,
  Sparkles,
  MapPin,
  ExternalLink,
  Tag,
  Camera
} from 'lucide-react';

interface EmployerWorkspaceProps {
  jobs: JobPosting[];
  applicants: Applicant[];
  userProfile: UserProfile;
  onAddJob: (newJob: JobPosting) => void;
  onUpdateApplicantStatus: (applicantId: string, status: Applicant['status']) => void;
  onUpdateAvatar?: (newAvatarUrl: string | undefined) => void;
  onSwitchRole: () => void;
  onLogout: () => void;
}

export const EmployerWorkspace: React.FC<EmployerWorkspaceProps> = ({
  jobs,
  applicants,
  userProfile,
  onAddJob,
  onUpdateApplicantStatus,
  onUpdateAvatar,
  onSwitchRole,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'jobs' | 'applicants' | 'salon'>('jobs');
  const [showPostModal, setShowPostModal] = useState<boolean>(false);
  const [showImageUploader, setShowImageUploader] = useState<boolean>(false);

  // New Job Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<JobPosting['category']>('Hair');
  const [jobType, setJobType] = useState<JobPosting['jobType']>('Commission');
  const [salary, setSalary] = useState('$60,000 - $85,000/yr');
  const [location, setLocation] = useState('Beverly Hills, CA');
  const [description, setDescription] = useState('We are hiring a dedicated beauty professional to join our salon team...');
  const [requirements, setRequirements] = useState('Valid State License, 2+ years experience');
  const [benefits, setBenefits] = useState('Health Insurance, Paid Masterclasses, Product Discounts');

  // Candidate Filter State
  const [candidateFilter, setCandidateFilter] = useState<string>('All');
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [interviewTime, setInterviewTime] = useState<string>('Tuesday, Aug 12 at 2:00 PM');

  const filteredApplicants = applicants.filter((a) => {
    if (candidateFilter === 'All') return true;
    return a.status === candidateFilter;
  });

  const handlePostJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    const newJob: JobPosting = {
      id: `job-${Date.now()}`,
      title,
      salonName: userProfile.businessName || 'Luxe & Co Salon Group',
      salonLogo: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=120&h=120',
      location,
      image: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&q=80&w=800',
      rating: 5.0,
      reviewsCount: 1,
      salary,
      jobType,
      category,
      tags: ['New Listing', 'Flexible Hours', 'Health Benefits'],
      description,
      requirements: requirements.split(',').map((r) => r.trim()),
      benefits: benefits.split(',').map((b) => b.trim()),
      postedDate: 'Just now',
      isBookmarked: false,
      isFeatured: true,
      activeApplicantsCount: 0,
    };

    onAddJob(newJob);
    setShowPostModal(false);
    // Reset form
    setTitle('');
  };

  const handleScheduleConfirm = () => {
    if (selectedApplicant) {
      onUpdateApplicantStatus(selectedApplicant.id, 'Interview Scheduled');
      setShowScheduleModal(false);
      setSelectedApplicant(null);
    }
  };

  return (
    <div className="bg-[#fdf8f8] min-h-screen text-[#1c1b1b] flex flex-col font-sans pb-16">
      {/* Top Header */}
      <header className="sticky top-0 bg-white border-b border-[#e0bec6]/40 shadow-sm z-30 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#b90064] text-white flex items-center justify-center font-bold text-xl shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-[#8e004b] tracking-tight block leading-none">
                {userProfile.businessName || 'Nexora Beauty Group'}
              </span>
              <span className="text-[10px] font-semibold text-[#594047] uppercase tracking-wider">
                Employer Dashboard
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPostModal(true)}
              className="px-4 py-2 bg-[#e2007c] text-white rounded-full text-xs font-bold hover:bg-[#b90064] transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Post New Role</span>
            </button>

            <button
              onClick={onSwitchRole}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ffd9e2] text-[#8e004b] text-xs font-semibold hover:bg-[#ffb0c8] transition-colors cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Switch to Job Seeker</span>
            </button>

            <button
              onClick={onLogout}
              title="Log out"
              className="p-2 text-[#594047] hover:text-[#8e004b] hover:bg-[#e6e1e1] rounded-full transition-colors cursor-pointer ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-grow w-full">
        {/* Key Metrics Header Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-2xl border border-[#e0bec6]/40 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center font-bold">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-[#1c1b1b]">{jobs.length}</span>
              <p className="text-xs font-medium text-[#594047]">Active Postings</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#e0bec6]/40 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-[#1c1b1b]">{applicants.length}</span>
              <p className="text-xs font-medium text-[#594047]">Total Candidates</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#e0bec6]/40 shadow-xs flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <span className="text-2xl font-extrabold text-[#1c1b1b]">
                {applicants.filter((a) => a.status === 'Interview Scheduled').length}
              </span>
              <p className="text-xs font-medium text-[#594047]">Interviews Scheduled</p>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-[#e0bec6]/40 pb-3 mb-6">
          <button
            onClick={() => setActiveTab('jobs')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'jobs'
                ? 'bg-[#8e004b] text-white shadow-sm'
                : 'bg-white text-[#594047] hover:bg-[#f7f2f2] border border-[#e0bec6]/40'
            }`}
          >
            My Job Postings ({jobs.length})
          </button>

          <button
            onClick={() => setActiveTab('applicants')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'applicants'
                ? 'bg-[#8e004b] text-white shadow-sm'
                : 'bg-white text-[#594047] hover:bg-[#f7f2f2] border border-[#e0bec6]/40'
            }`}
          >
            Candidate Applicants ({applicants.length})
          </button>

          <button
            onClick={() => setActiveTab('salon')}
            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'salon'
                ? 'bg-[#8e004b] text-white shadow-sm'
                : 'bg-white text-[#594047] hover:bg-[#f7f2f2] border border-[#e0bec6]/40'
            }`}
          >
            Salon Profile & Locations
          </button>
        </div>

        {/* TAB 1: MY JOB POSTINGS */}
        {activeTab === 'jobs' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-bold text-[#1c1b1b]">Active Listings</h2>
              <button
                onClick={() => setShowPostModal(true)}
                className="text-xs text-[#8e004b] font-bold hover:underline flex items-center gap-1"
              >
                + Add Another Listing
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white rounded-2xl border border-[#e0bec6]/50 shadow-xs p-5 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#ffd9e2] text-[#8e004b] px-2.5 py-0.5 rounded-full">
                        {job.jobType}
                      </span>
                      <span className="text-[10px] text-[#8c7077]">{job.postedDate}</span>
                    </div>

                    <h3 className="text-base font-bold text-[#1c1b1b] mb-1">{job.title}</h3>
                    <p className="text-xs font-bold text-[#e2007c] mb-2">{job.salary}</p>
                    <p className="text-xs text-[#594047] flex items-center gap-1 mb-3">
                      <MapPin className="w-3.5 h-3.5" /> {job.location}
                    </p>

                    <div className="bg-[#fdf8f8] p-3 rounded-xl border border-[#e0bec6]/30 flex items-center justify-between text-xs">
                      <span className="text-[#594047] font-medium">Applicants Received:</span>
                      <span className="font-extrabold text-[#8e004b] text-sm">
                        {applicants.filter((a) => a.appliedJobId === job.id).length || job.activeApplicantsCount || 0}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#e0bec6]/30 flex gap-2">
                    <button
                      onClick={() => setActiveTab('applicants')}
                      className="w-full py-2 bg-[#8e004b] text-white rounded-full text-xs font-bold hover:bg-[#b90064] transition-colors cursor-pointer"
                    >
                      View Candidates
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: CANDIDATE APPLICANTS PIPELINE */}
        {activeTab === 'applicants' && (
          <div className="space-y-6">
            {/* Filter Status Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {['All', 'New', 'Shortlisted', 'Interview Scheduled', 'Hired'].map((st) => (
                <button
                  key={st}
                  onClick={() => setCandidateFilter(st)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer ${
                    candidateFilter === st
                      ? 'bg-[#e2007c] text-white'
                      : 'bg-white text-[#594047] border border-[#e0bec6]/40'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredApplicants.map((applicant) => (
                <div
                  key={applicant.id}
                  className="bg-white rounded-2xl p-5 border border-[#e0bec6]/50 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#8e004b] text-white font-bold text-lg flex items-center justify-center flex-shrink-0">
                      {applicant.name.charAt(0)}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#1c1b1b]">{applicant.name}</h3>
                        <span className="text-[11px] font-semibold text-[#8e004b] bg-[#ffd9e2] px-2 py-0.5 rounded-full">
                          {applicant.experienceYears} yrs exp
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-[#e2007c] mt-0.5 mb-1">
                        Applied for: {applicant.appliedJobTitle}
                      </p>

                      <p className="text-xs text-[#594047] mb-2">
                        License: <span className="font-medium text-[#1c1b1b]">{applicant.licenseNumber}</span> • Applied {applicant.appliedDate}
                      </p>

                      {applicant.coverNote && (
                        <p className="text-xs bg-[#fdf8f8] p-2.5 rounded-xl border border-[#e0bec6]/30 text-[#594047] italic">
                          "{applicant.coverNote}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status Dropdown */}
                  <div className="flex flex-col md:items-end gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-[#e0bec6]/30">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#594047] font-semibold">Status:</span>
                      <select
                        value={applicant.status}
                        onChange={(e) =>
                          onUpdateApplicantStatus(applicant.id, e.target.value as Applicant['status'])
                        }
                        className="text-xs font-bold bg-[#f1edec] text-[#8e004b] rounded-lg px-3 py-1.5 border border-[#e0bec6] outline-none cursor-pointer"
                      >
                        <option value="New">New</option>
                        <option value="Shortlisted">Shortlisted</option>
                        <option value="Interview Scheduled">Interview Scheduled</option>
                        <option value="Hired">Hired</option>
                        <option value="Declined">Declined</option>
                      </select>
                    </div>

                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => {
                          setSelectedApplicant(applicant);
                          setShowScheduleModal(true);
                        }}
                        className="px-3 py-1.5 bg-[#8e004b] text-white text-xs font-semibold rounded-full hover:bg-[#b90064] transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Schedule Interview</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SALON PROFILE */}
        {activeTab === 'salon' && (
          <div className="max-w-2xl mx-auto bg-white p-6 sm:p-8 rounded-2xl border border-[#e0bec6]/40 shadow-sm space-y-6">
            <div className="flex items-center gap-4 pb-4 border-b border-[#e0bec6]/30">
              <div className="relative group">
                <button
                  onClick={() => setShowImageUploader(true)}
                  title="Update Salon Photo or Logo"
                  className="w-16 h-16 rounded-2xl bg-[#ffd9e2] text-[#8e004b] font-bold text-2xl flex items-center justify-center overflow-hidden border border-[#e0bec6] shadow-xs cursor-pointer relative"
                >
                  {userProfile.avatarUrl ? (
                    <img
                      src={userProfile.avatarUrl}
                      alt={userProfile.businessName || 'Salon Group'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{(userProfile.businessName || 'Luxe').charAt(0)}</span>
                  )}
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                </button>
              </div>

              <div className="flex-1">
                <h2 className="text-xl font-bold text-[#1c1b1b]">{userProfile.businessName || 'Luxe & Co Salon Group'}</h2>
                <p className="text-xs text-[#594047]">Beverly Hills • Soho NY • Miami</p>
                <button
                  onClick={() => setShowImageUploader(true)}
                  className="mt-1 text-xs text-[#8e004b] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" /> Change Brand Headshot / Photo
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#594047]">
              <div>
                <label className="font-bold text-[#1c1b1b] block mb-1">Salon Description</label>
                <p className="p-3 bg-[#fdf8f8] rounded-xl border border-[#e0bec6]/30 leading-relaxed">
                  Premier luxury beauty group operating high-end salons and day spas across major US metropolitan markets. Known for color mastery, medical esthetics, and elite talent culture.
                </p>
              </div>

              <div>
                <label className="font-bold text-[#1c1b1b] block mb-1">Recruitment Contact</label>
                <p className="p-3 bg-[#fdf8f8] rounded-xl border border-[#e0bec6]/30">
                  Sarah Jenkins (Director of Talent & Operations) • hello@nexorabeauty.com
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* POST NEW JOB MODAL */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-[#e0bec6] shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="flex justify-between items-center pb-3 border-b border-[#e0bec6]/30 mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#1c1b1b]">Post New Role</h3>
                <p className="text-xs text-[#594047]">Publish job listing to Nexora Beauty Talent Network</p>
              </div>
              <button
                onClick={() => setShowPostModal(false)}
                className="p-1 text-[#594047] hover:text-[#1c1b1b] rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostJob} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-[#1c1b1b] block mb-1">Job Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Master Balayage Colorist"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] outline-none focus:ring-2 focus:ring-[#8e004b]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#1c1b1b] block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as JobPosting['category'])}
                    className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] outline-none"
                  >
                    <option value="Hair">Hair</option>
                    <option value="Skincare">Skincare</option>
                    <option value="Nails">Nails</option>
                    <option value="Lashes & Brows">Lashes & Brows</option>
                    <option value="Massage">Massage</option>
                    <option value="Management">Management</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-[#1c1b1b] block mb-1">Position Type</label>
                  <select
                    value={jobType}
                    onChange={(e) => setJobType(e.target.value as JobPosting['jobType'])}
                    className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] outline-none"
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Commission">Commission</option>
                    <option value="Chair Rental">Chair Rental</option>
                    <option value="Part-time">Part-time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-[#1c1b1b] block mb-1">Compensation / Pay</label>
                  <input
                    type="text"
                    required
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] outline-none"
                  />
                </div>

                <div>
                  <label className="font-semibold text-[#1c1b1b] block mb-1">Location</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#1c1b1b] block mb-1">Role Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[#1c1b1b] block mb-1">Requirements (comma separated)</label>
                <input
                  type="text"
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] outline-none"
                />
              </div>

              <div>
                <label className="font-semibold text-[#1c1b1b] block mb-1">Benefits (comma separated)</label>
                <input
                  type="text"
                  value={benefits}
                  onChange={(e) => setBenefits(e.target.value)}
                  className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] outline-none"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPostModal(false)}
                  className="flex-1 py-3 rounded-full text-xs font-bold text-[#594047] bg-[#f1edec]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-full text-xs font-bold text-white bg-[#e2007c] hover:bg-[#b90064] shadow-md cursor-pointer"
                >
                  Publish Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCHEDULE INTERVIEW MODAL */}
      {showScheduleModal && selectedApplicant && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#e0bec6] shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-[#1c1b1b]">Schedule Interview with {selectedApplicant.name}</h3>
            <p className="text-xs text-[#594047]">Position: {selectedApplicant.appliedJobTitle}</p>

            <div>
              <label className="text-xs font-bold text-[#1c1b1b] block mb-1">Interview Date & Time</label>
              <input
                type="text"
                value={interviewTime}
                onChange={(e) => setInterviewTime(e.target.value)}
                className="w-full bg-[#fdf8f8] border border-[#e0bec6] rounded-xl p-3 text-xs text-[#1c1b1b] outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 py-2.5 rounded-full text-xs font-bold text-[#594047] bg-[#f1edec]"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleConfirm}
                className="flex-1 py-2.5 rounded-full text-xs font-bold text-white bg-[#8e004b] hover:bg-[#b90064]"
              >
                Confirm & Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROFILE HEADSHOT UPLOADER & CAMERA MODAL */}
      {showImageUploader && (
        <ProfileImageUploader
          currentAvatar={userProfile.avatarUrl}
          userName={userProfile.name}
          onSaveAvatar={(newUrl) => onUpdateAvatar?.(newUrl)}
          onClose={() => setShowImageUploader(false)}
        />
      )}
    </div>
  );
};

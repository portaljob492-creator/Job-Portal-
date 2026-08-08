import React, { useState, useRef, useEffect } from 'react';
import { Conversation, ChatMessage, UserProfile, UserRole, JobPosting } from '../../types';
import {
  MessageSquare,
  Send,
  Paperclip,
  Search,
  CheckCheck,
  Building2,
  User,
  Calendar,
  Sparkles,
  X,
  ChevronRight,
  Image as ImageIcon,
  FileText,
  PhoneCall,
  Clock,
  Briefcase
} from 'lucide-react';

interface MessagingCenterProps {
  currentRole: UserRole;
  userProfile: UserProfile;
  conversations: Conversation[];
  messages: ChatMessage[];
  jobs: JobPosting[];
  activeConversationId?: string;
  onSelectConversation?: (conversationId: string) => void;
  onSendMessage: (conversationId: string, text: string, attachment?: { name: string; url: string; type: 'image' | 'file' }) => void;
  onClose?: () => void;
}

export const MessagingCenter: React.FC<MessagingCenterProps> = ({
  currentRole,
  userProfile,
  conversations,
  messages,
  jobs,
  activeConversationId: externalActiveId,
  onSelectConversation,
  onSendMessage,
  onClose
}) => {
  // Filter conversations for the current user/role
  const roleFilteredConversations = conversations.filter((c) => {
    if (currentRole === 'seeker') {
      // In a real app, match by seeker email/name. Here show all or seeker specific
      return true;
    } else {
      // Employer side: show conversations matching employer's salon or jobs
      return true;
    }
  });

  const [selectedConvId, setSelectedConvId] = useState<string>(
    externalActiveId || roleFilteredConversations[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'unread' | 'interviews'>('all');
  const [messageText, setMessageText] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ name: string; url: string; type: 'image' | 'file' } | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [interviewDate, setInterviewDate] = useState('2026-08-12');
  const [interviewTime, setInterviewTime] = useState('14:00');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (externalActiveId) {
      setSelectedConvId(externalActiveId);
    }
  }, [externalActiveId]);

  // Scroll to bottom when new message arrives or conversation changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedConvId, messages]);

  const currentConv = conversations.find((c) => c.id === selectedConvId);
  const currentJob = currentConv ? jobs.find((j) => j.id === currentConv.jobId) : null;

  const currentMessages = messages.filter((m) => m.conversationId === selectedConvId);

  // Search and filter logic
  const filteredConversations = roleFilteredConversations.filter((c) => {
    const searchTarget = `${c.salonName} ${c.jobTitle} ${c.seekerName} ${c.lastMessage}`.toLowerCase();
    const matchesSearch = searchTarget.includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterTab === 'unread') {
      return currentRole === 'seeker' ? c.unreadCountSeeker > 0 : c.unreadCountEmployer > 0;
    }
    if (filterTab === 'interviews') {
      return c.status === 'Interview Requested' || c.status === 'Offer Extended';
    }
    return true;
  });

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!messageText.trim() && !attachedFile) || !selectedConvId) return;

    onSendMessage(selectedConvId, messageText.trim(), attachedFile || undefined);
    setMessageText('');
    setAttachedFile(null);
  };

  const handleQuickReply = (text: string) => {
    if (!selectedConvId) return;
    onSendMessage(selectedConvId, text);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImg = file.type.startsWith('image/');
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({
        name: file.name,
        url: reader.result as string,
        type: isImg ? 'image' : 'file'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendInterviewInvite = () => {
    if (!selectedConvId) return;
    const dateFormatted = new Date(`${interviewDate}T${interviewTime}`).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

    const inviteText = `🗓️ Interview Invitation: We would love to schedule a model test / interview with you on ${dateFormatted}! Please reply to confirm this time.`;
    onSendMessage(selectedConvId, inviteText);
    setShowScheduleModal(false);
  };

  // Quick reply options based on role
  const quickReplies = currentRole === 'seeker'
    ? [
        'I am available for an interview!',
        'Thank you! Is this position full-time or part-time?',
        'I have attached my portfolio and state license copy.',
        'What are the salon floor hours?'
      ]
    : [
        'Thanks for reaching out! Your portfolio is impressive.',
        'Are you available for a 15-minute phone screening tomorrow?',
        'Could you share your California Cosmetology license number?',
        'We would love to invite you in for a live trial session.'
      ];

  return (
    <div className="bg-white rounded-3xl border border-[#e0bec6]/50 shadow-xl overflow-hidden flex flex-col md:flex-row h-[780px] max-h-[85vh] w-full relative">
      {/* LEFT SIDEBAR: CONVERSATION LIST */}
      <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-[#e0bec6]/40 flex flex-col bg-[#fdf8f8]">
        {/* Header & Search */}
        <div className="p-4 border-b border-[#e0bec6]/30 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#ffd9e2] text-[#8e004b] flex items-center justify-center font-bold">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-[#1c1b1b]">Messages</h2>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 text-[#594047] hover:bg-[#f1edec] rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#8c7077] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search salon or candidate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-[#e0bec6]/60 text-xs text-[#1c1b1b] focus:outline-none focus:ring-2 focus:ring-[#e2007c]/30"
            />
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1 p-1 bg-[#f1edec] rounded-xl text-[11px] font-bold">
            <button
              onClick={() => setFilterTab('all')}
              className={`flex-1 py-1 rounded-lg transition-colors cursor-pointer ${
                filterTab === 'all' ? 'bg-white text-[#8e004b] shadow-2xs' : 'text-[#594047]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterTab('unread')}
              className={`flex-1 py-1 rounded-lg transition-colors cursor-pointer ${
                filterTab === 'unread' ? 'bg-white text-[#8e004b] shadow-2xs' : 'text-[#594047]'
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setFilterTab('interviews')}
              className={`flex-1 py-1 rounded-lg transition-colors cursor-pointer ${
                filterTab === 'interviews' ? 'bg-white text-[#8e004b] shadow-2xs' : 'text-[#594047]'
              }`}
            >
              Interviews
            </button>
          </div>
        </div>

        {/* Conversation Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#e0bec6]/20">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-[#594047] space-y-2">
              <MessageSquare className="w-8 h-8 text-[#8c7077] mx-auto opacity-50" />
              <p className="text-xs font-semibold">No messages found</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const unread = currentRole === 'seeker' ? conv.unreadCountSeeker : conv.unreadCountEmployer;
              const displayTitle = currentRole === 'seeker' ? conv.salonName : conv.seekerName;
              const displayAvatar = currentRole === 'seeker' ? conv.salonLogo : conv.seekerAvatar;

              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConvId(conv.id);
                    onSelectConversation?.(conv.id);
                  }}
                  className={`w-full p-3.5 text-left transition-all flex items-start gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-[#ffd9e2]/40 border-l-4 border-[#e2007c]'
                      : 'hover:bg-white/80'
                  }`}
                >
                  <div className="relative">
                    <div className="w-11 h-11 rounded-full bg-[#f1edec] border border-[#e0bec6]/50 overflow-hidden flex items-center justify-center font-bold text-[#8e004b] text-base shrink-0 shadow-2xs">
                      {displayAvatar ? (
                        <img
                          src={displayAvatar}
                          alt={displayTitle}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{displayTitle.charAt(0)}</span>
                      )}
                    </div>
                    {/* Status Pill */}
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="text-xs font-bold text-[#1c1b1b] truncate">{displayTitle}</h4>
                      <span className="text-[10px] font-semibold text-[#8c7077] shrink-0">
                        {conv.lastMessageTime}
                      </span>
                    </div>

                    <p className="text-[11px] font-medium text-[#e2007c] truncate mb-1">
                      {conv.jobTitle}
                    </p>

                    <p className="text-[11px] text-[#594047] truncate leading-tight">
                      {conv.lastMessage}
                    </p>

                    {/* Badges */}
                    <div className="flex items-center justify-between mt-2">
                      {conv.status && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          conv.status === 'Interview Requested'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : conv.status === 'Offer Extended'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {conv.status}
                        </span>
                      )}

                      {unread > 0 && (
                        <span className="bg-[#e2007c] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT MAIN CHAT AREA */}
      {currentConv ? (
        <div className="flex-1 flex flex-col bg-white">
          {/* Chat Header */}
          <div className="p-4 border-b border-[#e0bec6]/40 bg-[#fdf8f8] flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#f1edec] border border-[#e0bec6]/60 overflow-hidden flex items-center justify-center font-bold text-[#8e004b] text-base shrink-0 shadow-2xs">
                {currentRole === 'seeker' ? (
                  currentConv.salonLogo ? (
                    <img
                      src={currentConv.salonLogo}
                      alt={currentConv.salonName}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-5 h-5 text-[#8e004b]" />
                  )
                ) : currentConv.seekerAvatar ? (
                  <img
                    src={currentConv.seekerAvatar}
                    alt={currentConv.seekerName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-[#8e004b]" />
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#1c1b1b] flex items-center gap-2">
                  <span>{currentRole === 'seeker' ? currentConv.salonName : currentConv.seekerName}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Now
                  </span>
                </h3>
                <p className="text-xs text-[#594047] font-medium flex items-center gap-1">
                  <Briefcase className="w-3 h-3 text-[#e2007c]" />
                  <span>Re: {currentConv.jobTitle}</span>
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2">
              {currentRole === 'employer' && (
                <button
                  onClick={() => setShowScheduleModal(true)}
                  className="px-3.5 py-1.5 bg-[#e2007c] hover:bg-[#b90064] text-white text-xs font-bold rounded-full shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Schedule Interview</span>
                </button>
              )}

              <a
                href={`tel:5551234567`}
                onClick={(e) => {
                  e.preventDefault();
                  alert(`Direct phone connection to ${currentRole === 'seeker' ? currentConv.salonName : currentConv.seekerName}: (555) 019-2831`);
                }}
                className="p-2 bg-white border border-[#e0bec6]/60 rounded-full text-[#8e004b] hover:bg-[#ffd9e2]/50 transition-colors cursor-pointer"
                title="Call Candidate/Salon"
              >
                <PhoneCall className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Job Banner Context Card inside chat */}
          {currentJob && (
            <div className="bg-[#ffd9e2]/30 px-4 py-2 border-b border-[#e0bec6]/30 flex items-center justify-between text-xs text-[#594047]">
              <div className="flex items-center gap-2 truncate">
                <Sparkles className="w-3.5 h-3.5 text-[#e2007c] shrink-0" />
                <span className="font-bold text-[#1c1b1b]">{currentJob.title}</span>
                <span className="text-[11px] text-[#8e004b] font-semibold">{currentJob.salary}</span>
              </div>
              <span className="text-[10px] font-bold bg-white text-[#8e004b] px-2 py-0.5 rounded-full border border-[#e0bec6]/40 shrink-0">
                {currentJob.jobType}
              </span>
            </div>
          )}

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gradient-to-b from-white to-[#fdf8f8]">
            <div className="text-center my-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8c7077] bg-[#f1edec] px-3 py-1 rounded-full border border-[#e0bec6]/30">
                Direct Beauty Workspace Chat
              </span>
            </div>

            {currentMessages.length === 0 ? (
              <div className="text-center py-12 text-[#594047]">
                <p className="text-xs font-semibold">Start the conversation with {currentRole === 'seeker' ? currentConv.salonName : currentConv.seekerName}!</p>
              </div>
            ) : (
              currentMessages.map((m) => {
                const isMe = m.senderRole === currentRole;

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="text-[10px] font-bold text-[#8c7077]">{m.senderName}</span>
                      <span className="text-[9px] text-[#8c7077]">{m.timestamp}</span>
                    </div>

                    <div
                      className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                        isMe
                          ? 'bg-[#8e004b] text-white rounded-tr-none'
                          : 'bg-[#f1edec] text-[#1c1b1b] rounded-tl-none border border-[#e0bec6]/40'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.text}</p>

                      {/* Attachment handling */}
                      {m.attachment && (
                        <div className="mt-2.5 pt-2 border-t border-white/20">
                          {m.attachment.type === 'image' ? (
                            <img
                              src={m.attachment.url}
                              alt={m.attachment.name}
                              className="max-h-48 rounded-xl object-cover border border-white/30"
                            />
                          ) : (
                            <div className="flex items-center gap-2 bg-black/10 p-2 rounded-xl text-[11px]">
                              <FileText className="w-4 h-4" />
                              <span className="truncate">{m.attachment.name}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Smart Reply Suggestions */}
          <div className="px-4 py-2 bg-[#fdf8f8] border-t border-[#e0bec6]/30 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-bold text-[#8c7077] shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#e2007c]" /> Quick Replies:
            </span>
            {quickReplies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickReply(reply)}
                className="text-[10px] font-semibold bg-white text-[#8e004b] border border-[#e0bec6]/60 hover:border-[#e2007c] hover:bg-[#ffd9e2]/40 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer shrink-0"
              >
                {reply}
              </button>
            ))}
          </div>

          {/* Attached File Bar preview */}
          {attachedFile && (
            <div className="px-4 py-1.5 bg-[#ffd9e2]/50 border-t border-[#e0bec6]/30 flex items-center justify-between text-xs">
              <span className="text-[#8e004b] font-bold flex items-center gap-1">
                <Paperclip className="w-3.5 h-3.5" /> Attached: {attachedFile.name}
              </span>
              <button
                onClick={() => setAttachedFile(null)}
                className="text-rose-600 hover:text-rose-800 font-bold text-xs"
              >
                Remove
              </button>
            </div>
          )}

          {/* Message Input Box */}
          <form
            onSubmit={handleSend}
            className="p-3 bg-white border-t border-[#e0bec6]/40 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-[#594047] hover:bg-[#f1edec] rounded-full transition-colors cursor-pointer shrink-0"
              title="Attach photo, resume, or portfolio document"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
            />

            <input
              type="text"
              placeholder={`Write a message to ${currentRole === 'seeker' ? currentConv.salonName : currentConv.seekerName}...`}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="flex-1 bg-[#f1edec]/70 px-4 py-2.5 rounded-full border border-[#e0bec6]/50 text-xs text-[#1c1b1b] focus:outline-none focus:ring-2 focus:ring-[#e2007c]/40"
            />

            <button
              type="submit"
              disabled={!messageText.trim() && !attachedFile}
              className="p-2.5 bg-[#e2007c] hover:bg-[#b90064] disabled:opacity-40 text-white rounded-full shadow-md transition-all cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#594047] space-y-3">
          <MessageSquare className="w-12 h-12 text-[#e0bec6]" />
          <h3 className="text-base font-bold text-[#1c1b1b]">Select a conversation to start chatting</h3>
          <p className="text-xs text-[#8c7077] max-w-xs">
            Connect directly regarding open beauty positions, model tests, and interview schedules.
          </p>
        </div>
      )}

      {/* SCHEDULE INTERVIEW MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#e0bec6]/60 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-[#e0bec6]/30">
              <h3 className="text-base font-bold text-[#1c1b1b] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#e2007c]" /> Schedule Model Test / Interview
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-[#8c7077] hover:text-[#1c1b1b]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#594047]">
              Send an official interview invitation timestamp directly into the chat thread for {currentConv?.seekerName}.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#1c1b1b] mb-1">Interview Date</label>
                <input
                  type="date"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                  className="w-full p-2.5 bg-[#f1edec] rounded-xl border border-[#e0bec6]/60 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1c1b1b] mb-1">Time</label>
                <input
                  type="time"
                  value={interviewTime}
                  onChange={(e) => setInterviewTime(e.target.value)}
                  className="w-full p-2.5 bg-[#f1edec] rounded-xl border border-[#e0bec6]/60 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 rounded-full border border-[#e0bec6] text-xs font-bold text-[#594047]"
              >
                Cancel
              </button>
              <button
                onClick={handleSendInterviewInvite}
                className="px-5 py-2 rounded-full bg-[#e2007c] text-white text-xs font-bold hover:bg-[#b90064] shadow-xs"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

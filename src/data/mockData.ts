import { JobPosting, Application, Applicant } from '../types';

export const INITIAL_JOBS: JobPosting[] = [
  {
    id: 'job-1',
    title: 'Senior Hair Colorist & Balayage Specialist',
    salonName: 'Luxe & Co Salon',
    salonLogo: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=120&h=120',
    location: 'Beverly Hills, CA',
    image: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&q=80&w=800',
    rating: 4.9,
    reviewsCount: 128,
    salary: '$65,000 - $95,000/yr + Tips',
    jobType: 'Commission',
    category: 'Hair',
    tags: ['High Foot Traffic', 'Health Benefits', 'Paid Masterclasses', '50% Product Discount'],
    description: 'Luxe & Co Salon is seeking an experienced, high-touch Senior Colorist specializing in modern dimensional color, balayage, and luxury hair extensions. We serve an elite clientele and provide state-of-the-art color stations, luxury product lines (Kérastase & Oribe), and continuous education.',
    requirements: [
      'Valid California Cosmetology License required',
      'Minimum 3+ years active salon floor experience',
      'Strong portfolio showcasing blonde & balayage techniques',
      'Excellent client consultation and retail sales skills'
    ],
    benefits: [
      'Flexible 4-day work schedule',
      'Medical, Dental & Vision coverage after 90 days',
      'Generous commission on service & retail sales',
      'Annual travel stipend for International Beauty Expos'
    ],
    postedDate: '2 days ago',
    isBookmarked: true,
    isFeatured: true,
    activeApplicantsCount: 8
  },
  {
    id: 'job-2',
    title: 'Licensed Medical Esthetician',
    salonName: 'Glow & Botanicals Spa',
    salonLogo: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=120&h=120',
    location: 'Soho, New York, NY',
    image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=800',
    rating: 4.8,
    reviewsCount: 94,
    salary: '$38 - $52/hr + Tips',
    jobType: 'Full-time',
    category: 'Skincare',
    tags: ['HydraFacial Certified', 'Flexible Hours', 'Retail Bonus', '401(k) Matching'],
    description: 'Join Manhattan top holistic beauty spa! We are looking for a passionate Licensed Esthetician skilled in customized facial protocols, microneedling, chemical peels, and LED therapy. Provide luxury custom treatments in a soothing botanical environment.',
    requirements: [
      'Active NY Esthetics License',
      'Certification in HydraFacial and Dermaplaning preferred',
      'Passionate about skin health and customized client homecare regimes',
      'Strong interpersonal and sales communication skills'
    ],
    benefits: [
      'Competitive hourly wage plus lucrative commission structure',
      'Paid time off (PTO) and sick leave',
      'Free spa services for staff and family discounts',
      'Ongoing training on cutting-edge clinical skincare brands'
    ],
    postedDate: '1 day ago',
    isBookmarked: false,
    isFeatured: true,
    activeApplicantsCount: 14
  },
  {
    id: 'job-3',
    title: 'Master Lash & Brow Artist',
    salonName: 'Velvet Lash Bar',
    salonLogo: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=120&h=120',
    location: 'Austin, TX',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800',
    rating: 5.0,
    reviewsCount: 67,
    salary: '$55,000 - $80,000/yr',
    jobType: 'Full-time',
    category: 'Lashes & Brows',
    tags: ['Volume Lashes', 'Lamination Specialist', 'Gratuity Included', 'Growth Potential'],
    description: 'Velvet Lash Bar is expanding! We are hiring a Master Lash Technician & Brow Specialist capable of delivering volume extension sets, brow lamination, microblading, and lash lifts. Join a friendly, highly aesthetic studio with a devoted local following.',
    requirements: [
      'Cosmetology or Esthetician License in Texas',
      'Certified Lash Technician with speed & retention mastery',
      'Clean hygiene standards and attention to detail'
    ],
    benefits: [
      'All premium lash supplies provided',
      'Full booking schedule handled by front desk team',
      'Paid sick leave and performance bonuses'
    ],
    postedDate: '3 days ago',
    isBookmarked: true,
    isFeatured: false,
    activeApplicantsCount: 5
  },
  {
    id: 'job-4',
    title: 'Luxury Booth Rental Stylist',
    salonName: 'The Studio Collective',
    salonLogo: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=120&h=120',
    location: 'Miami, FL',
    image: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&q=80&w=800',
    rating: 4.7,
    reviewsCount: 88,
    salary: 'Keep 100% Earnings ($225/wk rent)',
    jobType: 'Chair Rental',
    category: 'Hair',
    tags: ['24/7 Access', 'Private Station', 'Ring Light Included', 'Towels Provided'],
    description: 'Own your business inside Miami premier beauty hub! Rent a gorgeous, fully customized station with natural light, hydraulic chair, shampoo bowl access, towel service, and vibrant community of fellow beauty entrepreneurs.',
    requirements: [
      'FL Cosmetology License & Independent Business Insurance',
      'Existing client book or strong motivation to build',
      'Professionalism and respect for shared luxury space'
    ],
    benefits: [
      'Keep 100% of your service & retail revenue',
      'Free salon booking app software subscription included',
      'Modern client waiting lounge & complimentary prosecco bar'
    ],
    postedDate: '5 days ago',
    isBookmarked: false,
    isFeatured: false,
    activeApplicantsCount: 3
  },
  {
    id: 'job-5',
    title: 'Salon Director & Operations Manager',
    salonName: 'Elegance Beauty Group',
    salonLogo: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=120&h=120',
    location: 'Chicago, IL',
    image: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&q=80&w=800',
    rating: 4.9,
    reviewsCount: 150,
    salary: '$85,000 - $110,000/yr + Profit Share',
    jobType: 'Full-time',
    category: 'Management',
    tags: ['Leadership', 'Profit Sharing', 'Full Benefits', 'Paid Time Off'],
    description: 'Elegance Beauty Group is hiring an ambitious Salon Director to lead daily operations, manage a team of 25+ stylists and estheticians, optimize booking schedules, oversee inventory, and drive client retention strategies across 2 premier locations.',
    requirements: [
      '3+ years management experience in salon, spa, or luxury hospitality',
      'Strong financial literacy, scheduling, and staff leadership abilities',
      'Passion for the beauty industry culture'
    ],
    benefits: [
      'Annual profit sharing bonus',
      'Full healthcare, dental, 401(k) matching',
      'Executive leadership development courses'
    ],
    postedDate: 'Just now',
    isBookmarked: false,
    isFeatured: true,
    activeApplicantsCount: 12
  },
  {
    id: 'job-6',
    title: 'Nail Artist & Gel Extension Specialist',
    salonName: 'Blossom Nail Lounge',
    salonLogo: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&q=80&w=120&h=120',
    location: 'Seattle, WA',
    image: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&q=80&w=800',
    rating: 4.8,
    reviewsCount: 45,
    salary: '$28 - $42/hr + High Tips',
    jobType: 'Full-time',
    category: 'Nails',
    tags: ['Structured Gel', 'Nail Art', 'Flexible Shifts', 'Paid Uniforms'],
    description: 'Specializing in non-toxic structured gel overlays, Japanese nail art, and builder gel extensions. We offer ergonomic work stations, dust extractors, high-end gel polishes (Leafgel/Presto), and steady year-round appointments.',
    requirements: [
      'WA Manicurist or Cosmetology License',
      'Experience in e-file manicures and nail art',
      'Commitment to sanitation and client comfort'
    ],
    benefits: [
      'High hourly guarantee plus tips',
      'Product discounts & paid art workshops',
      'Consistent client traffic via online booking'
    ],
    postedDate: '4 days ago',
    isBookmarked: false,
    isFeatured: false,
    activeApplicantsCount: 6
  },
  {
    id: 'job-7',
    title: 'Luxury Holistic Bodywork & Massage Therapist',
    salonName: 'Serenity Wellness Spa',
    salonLogo: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&q=80&w=120&h=120',
    location: 'Miami, FL',
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&q=80&w=800',
    rating: 4.9,
    reviewsCount: 112,
    salary: '$75,000 - $105,000/yr',
    jobType: 'Full-time',
    category: 'Massage',
    tags: ['Deep Tissue', 'Aromatherapy', 'Health Benefits', 'Flexible Hours'],
    description: 'Serenity Wellness Spa seeks a Licensed Massage Therapist specializing in deep tissue, lymphatic drainage, and luxury hot stone body treatments. Provide serene wellness care in an oceanfront luxury sanctuary.',
    requirements: [
      'Active Massage Therapy License',
      'Minimum 2+ years luxury resort or spa experience',
      'Certifications in Lymphatic Drainage or Prenatal massage a plus'
    ],
    benefits: [
      'Comprehensive medical, vision & dental insurance',
      'Generous tip structure + commission on spa product sales',
      'Complimentary spa access for employee wellness'
    ],
    postedDate: '1 day ago',
    isBookmarked: false,
    isFeatured: true,
    activeApplicantsCount: 9
  },
  {
    id: 'job-8',
    title: 'Executive Blonding & Extensions Master',
    salonName: 'Haute Couture Hair Studio',
    salonLogo: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=120&h=120',
    location: 'Soho, New York, NY',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=800',
    rating: 5.0,
    reviewsCount: 210,
    salary: '$110,000 - $150,000/yr + High Commission',
    jobType: 'Commission',
    category: 'Hair',
    tags: ['K-Tip Extensions', 'High Foot Traffic', 'Celebrity Salon', '401(k) Matching'],
    description: 'Premier Manhattan fashion salon looking for an elite Hair Extension Specialist and Master Blonding Colorist. Serve celebrity clients, runway models, and fashion influencers with top-of-the-line luxury hair products.',
    requirements: [
      'Valid New York Cosmetology License',
      'Mastery in Keratin Bond (K-Tip) and Hand-Tied Wefts',
      'High client retention rate and strong Instagram portfolio'
    ],
    benefits: [
      'Top-tier commission rate up to 60%',
      'Full healthcare benefits + 401(k) match',
      'Paid annual masterclass trips to Paris & Milan fashion weeks'
    ],
    postedDate: '3 days ago',
    isBookmarked: true,
    isFeatured: true,
    activeApplicantsCount: 15
  }
];

export const INITIAL_APPLICATIONS: Application[] = [
  {
    id: 'app-1',
    jobId: 'job-1',
    jobTitle: 'Senior Hair Colorist & Balayage Specialist',
    salonName: 'Luxe & Co Salon',
    salonLogo: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=120&h=120',
    location: 'Beverly Hills, CA',
    appliedDate: 'Yesterday',
    status: 'Interview Scheduled',
    notes: 'Interview scheduled for Tuesday at 2:00 PM PST with Salon Manager Sarah.',
    interviewDate: 'Tue, Aug 12 • 2:00 PM'
  },
  {
    id: 'app-2',
    jobId: 'job-3',
    jobTitle: 'Master Lash & Brow Artist',
    salonName: 'Velvet Lash Bar',
    salonLogo: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=120&h=120',
    location: 'Austin, TX',
    appliedDate: '3 days ago',
    status: 'Under Review',
    notes: 'Portfolio received by hiring team. Currently reviewing lash extension samples.'
  }
];

export const INITIAL_APPLICANTS: Applicant[] = [
  {
    id: 'cand-1',
    name: 'Jane Doe',
    appliedJobId: 'job-1',
    appliedJobTitle: 'Senior Hair Colorist & Balayage Specialist',
    email: 'jane.doe@example.com',
    phone: '(555) 234-5678',
    experienceYears: 5,
    licenseNumber: 'CA-COS-889124',
    status: 'Interview Scheduled',
    appliedDate: '2 hours ago',
    coverNote: 'I have 5 years experience specializing in blonde color corrections and balayage at high-end studios. Would love to join Luxe & Co!',
    portfolioUrl: 'instagram.com/janedoe_hair'
  },
  {
    id: 'cand-2',
    name: 'Maya Lin',
    appliedJobId: 'job-1',
    appliedJobTitle: 'Senior Hair Colorist & Balayage Specialist',
    email: 'maya.beauty@example.com',
    phone: '(555) 987-6543',
    experienceYears: 4,
    licenseNumber: 'CA-COS-772109',
    status: 'Shortlisted',
    appliedDate: '1 day ago',
    coverNote: 'Extensive background in foilayage and scalp treatments. Kérastase certified master.',
    portfolioUrl: 'instagram.com/mayalin_styles'
  },
  {
    id: 'cand-3',
    name: 'Carlos Rivera',
    appliedJobId: 'job-5',
    appliedJobTitle: 'Salon Director & Operations Manager',
    email: 'carlos.r@example.com',
    phone: '(555) 345-6789',
    experienceYears: 7,
    licenseNumber: 'N/A (Business Mgmt)',
    status: 'New',
    appliedDate: '3 hours ago',
    coverNote: 'Managed top-performing Chicago day spa generating $2.4M annually. Expert in Mindbody/Zenoti and staff mentoring.',
    portfolioUrl: 'linkedin.com/in/carlosrivera-beauty'
  }
];

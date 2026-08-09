import type { JobPosting } from '../types';
import { requireSupabase } from '../lib/supabase';

const one = <T>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null;
const list = (value?: string | null) => value ? value.split(/\n|,|•/).map((v) => v.trim()).filter(Boolean) : [];

function mapAdminJob(row: any): JobPosting {
  const salon = one<any>(row.salon);
  const location = one<any>(row.location);
  const format = (v: unknown) => Number(v || 0).toLocaleString('en-IN');
  return {
    id: row.id, title: row.title, salonName: salon?.name || 'Salon', salonLogo: salon?.logo_path || undefined,
    location: [location?.city || salon?.city, location?.state || salon?.state].filter(Boolean).join(', '),
    image: row.image_path || '', rating: Number(salon?.rating_average || 0), reviewsCount: Number(salon?.review_count || 0),
    salary: row.salary_min || row.salary_max ? `₹${format(row.salary_min)} - ₹${format(row.salary_max)}/${row.pay_type || 'month'}` : 'Salary not disclosed',
    jobType: row.employment_type === 'part_time' ? 'Part-time' : row.employment_type === 'contract' ? 'Contract' : 'Full-time',
    category: row.category || 'Hair', tags: row.tags || [], description: row.description,
    requirements: list(row.responsibilities), benefits: list(row.benefits), postedDate: new Date(row.created_at).toLocaleDateString('en-IN'),
    approvalStatus: row.status, rejectionReason: row.admin_review_reason || undefined,
  };
}

export async function loadPendingApprovalJobs() {
  const { data, error } = await requireSupabase().from('job_posts')
    .select('*, salon:salons!job_posts_salon_id_fkey(*), location:job_salon_locations!job_posts_location_id_fkey(*)')
    .eq('status', 'pending_approval').order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapAdminJob);
}

export async function approvePendingJob(jobId: string) {
  const { data, error } = await requireSupabase().rpc('approve_job', { target_job_id: jobId });
  if (error) throw error;
  return data;
}

export async function rejectPendingJob(jobId: string, reason?: string) {
  const { data, error } = await requireSupabase().rpc('reject_job', { target_job_id: jobId, p_reason: reason || null });
  if (error) throw error;
  return data;
}

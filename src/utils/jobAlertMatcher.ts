import { JobPosting, SavedFilter, JobAlertNotification } from '../types';

function parseAnnualINR(value: string): number {
  const matches = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return 0;
  let amount = Math.max(...matches.map(Number));
  const normalized = value.toLowerCase();
  if (/lpa|lakh|lac/.test(normalized)) amount *= 100000;
  else if (/month|\/mo\b|monthly/.test(normalized)) amount *= 12;
  else if (/week|\/wk\b|weekly/.test(normalized)) amount *= 52;
  else if (/hr|hour|hourly/.test(normalized)) amount *= 2000;
  if (normalized.includes('keep 100%') || normalized.includes('chair rent')) amount = 600000;
  return amount;
}

/**
 * Evaluates whether a JobPosting matches a given SavedFilter configuration.
 */
export function checkJobMatchesSavedFilter(job: JobPosting, filter: SavedFilter): boolean {
  // 1. Search Query Check
  if (filter.searchQuery && filter.searchQuery.trim().length > 0) {
    const q = filter.searchQuery.trim().toLowerCase();
    const titleMatch = job.title.toLowerCase().includes(q);
    const descMatch = job.description.toLowerCase().includes(q);
    const salonMatch = job.salonName.toLowerCase().includes(q);
    const tagsMatch = job.tags.some((t) => t.toLowerCase().includes(q));

    if (!titleMatch && !descMatch && !salonMatch && !tagsMatch) {
      return false;
    }
  }

  // 2. Category Check
  if (filter.category && filter.category !== 'All') {
    if (job.category !== filter.category) {
      return false;
    }
  }

  // 3. Location Check
  if (filter.location && filter.location !== 'All Locations') {
    const locFilter = filter.location.toLowerCase().split(',')[0].trim();
    const jobLoc = job.location.toLowerCase();
    if (!jobLoc.includes(locFilter)) {
      return false;
    }
  }

  // 4. Job Type Check
  if (filter.jobType && filter.jobType !== 'All Types') {
    if (job.jobType !== filter.jobType) {
      return false;
    }
  }

  // 5. Salary Filter Check
  if (filter.salary && filter.salary !== 'All Salaries') {
    const annualSalary = parseAnnualINR(job.salary);
    if (filter.salary === '₹3 lakh+' && annualSalary < 300000) return false;
    if (filter.salary === '₹5 lakh+' && annualSalary < 500000) return false;
    if (filter.salary === '₹7.5 lakh+' && annualSalary < 750000) return false;
    if (filter.salary === '₹10 lakh+' && annualSalary < 1000000) return false;
  }

  // 6. Tag / Perk Check
  if (filter.tag && filter.tag !== 'All Perks') {
    const hasTag = job.tags.some((t) => t.toLowerCase().includes(filter.tag!.toLowerCase()));
    if (!hasTag) {
      return false;
    }
  }

  return true;
}

/**
 * Runs a new job against a list of saved filters and generates matching JobAlertNotifications.
 */
export function processNewJobForAlerts(
  job: JobPosting,
  savedFilters: SavedFilter[]
): JobAlertNotification[] {
  const alerts: JobAlertNotification[] = [];

  savedFilters.forEach((filter) => {
    // Check if notification is enabled for this filter
    if (filter.notifyInApp !== false || filter.notifyPush !== false) {
      if (checkJobMatchesSavedFilter(job, filter)) {
        alerts.push({
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          savedFilterId: filter.id,
          savedFilterName: filter.name,
          jobId: job.id,
          jobTitle: job.title,
          salonName: job.salonName,
          location: job.location,
          salary: job.salary,
          category: job.category,
          matchedAt: 'Just now',
          isRead: false
        });
      }
    }
  });

  return alerts;
}

export interface ParsedScanClient {
  deviceType: 'Mobile' | 'Desktop' | 'Tablet';
  browser: string;
  os: string;
  country: string;
  city: string;
  referrer: string;
}

const TIMEZONE_CITY_MAP: Record<string, { country: string; city: string }> = {
  'America/New_York': { country: 'United States', city: 'New York' },
  'America/Chicago': { country: 'United States', city: 'Chicago' },
  'America/Denver': { country: 'United States', city: 'Denver' },
  'America/Los_Angeles': { country: 'United States', city: 'Los Angeles' },
  'America/Toronto': { country: 'Canada', city: 'Toronto' },
  'Europe/London': { country: 'United Kingdom', city: 'London' },
  'Europe/Berlin': { country: 'Germany', city: 'Berlin' },
  'Europe/Paris': { country: 'France', city: 'Paris' },
  'Asia/Kolkata': { country: 'India', city: 'Mumbai' },
  'Asia/Calcutta': { country: 'India', city: 'Mumbai' },
  'Asia/Singapore': { country: 'Singapore', city: 'Singapore' },
  'Asia/Tokyo': { country: 'Japan', city: 'Tokyo' },
  'Asia/Dubai': { country: 'United Arab Emirates', city: 'Dubai' },
  'Australia/Sydney': { country: 'Australia', city: 'Sydney' },
};

export function parseClientEnvironment(): ParsedScanClient {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const lower = ua.toLowerCase();

  let deviceType: 'Mobile' | 'Desktop' | 'Tablet' = 'Desktop';
  if (/ipad|tablet|playbook|silk/i.test(lower) || (/android/i.test(lower) && !/mobile/i.test(lower))) {
    deviceType = 'Tablet';
  } else if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(lower)) {
    deviceType = 'Mobile';
  }

  let browser = 'Other';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  let os = 'Other';
  if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/mac os x|macintosh/i.test(ua)) os = 'macOS';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/linux/i.test(ua)) os = 'Linux';

  let country = 'Unknown';
  let city = 'Unknown';
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (TIMEZONE_CITY_MAP[tz]) {
      country = TIMEZONE_CITY_MAP[tz].country;
      city = TIMEZONE_CITY_MAP[tz].city;
    } else if (tz.includes('/')) {
      const parts = tz.split('/');
      country = parts[0].replace(/_/g, ' ');
      city = parts[parts.length - 1].replace(/_/g, ' ');
    }
  } catch {
    // Fallback to Unknown
  }

  return {
    deviceType,
    browser,
    os,
    country,
    city,
    referrer: typeof document !== 'undefined' ? (document.referrer || 'Direct Scan').slice(0, 250) : 'Direct Scan',
  };
}

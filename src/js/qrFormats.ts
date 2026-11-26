import type { QRType } from '../types';

export interface QRFieldSpec {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'url' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'datetime-local';
  required?: boolean;
  options?: { value: string; label: string }[];
}

export interface QRTypeConfig {
  type: QRType;
  label: string;
  category: 'Links' | 'Communication' | 'Social' | 'Media' | 'Utility';
  description: string;
  fields: QRFieldSpec[];
  buildPayload: (values: Record<string, string>) => string;
}

function normalizeUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^(https?:\/\/|mailto:|tel:|sms:|upi:|WIFI:|BEGIN:)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export const QR_TYPES: QRTypeConfig[] = [
  {
    type: 'website',
    label: 'Website',
    category: 'Links',
    description: 'Link to any web page, campaign landing page, or storefront.',
    fields: [
      { key: 'url', label: 'Destination URL', placeholder: 'https://yourbrand.com/launch', type: 'url', required: true },
    ],
    buildPayload: (v) => normalizeUrl(v.url),
  },
  {
    type: 'google_review',
    label: 'Google Review',
    category: 'Links',
    description: 'Send customers straight to your Google Business review form.',
    fields: [
      {
        key: 'url',
        label: 'Google Review Link or Place ID',
        placeholder: 'https://g.page/r/your-business/review',
        type: 'text',
        required: true,
      },
    ],
    buildPayload: (v) => {
      const val = (v.url || '').trim();
      if (!val) return '';
      if (/^https?:\/\//i.test(val)) return val;
      return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(val)}`;
    },
  },
  {
    type: 'whatsapp',
    label: 'WhatsApp',
    category: 'Communication',
    description: 'Start a pre-filled WhatsApp conversation with one scan.',
    fields: [
      { key: 'phone', label: 'WhatsApp Number (with country code)', placeholder: '14155550199', type: 'tel', required: true },
      { key: 'message', label: 'Pre-filled Message', placeholder: 'Hello! I would like to know more.', type: 'textarea' },
    ],
    buildPayload: (v) => {
      const digits = (v.phone || '').replace(/[^\d]/g, '');
      if (!digits) return '';
      const msg = (v.message || '').trim();
      return msg ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}` : `https://wa.me/${digits}`;
    },
  },
  {
    type: 'phone',
    label: 'Phone',
    category: 'Communication',
    description: 'Trigger an instant phone call from mobile devices.',
    fields: [
      { key: 'phone', label: 'Phone Number', placeholder: '+1 415 555 0199', type: 'tel', required: true },
    ],
    buildPayload: (v) => {
      const clean = (v.phone || '').replace(/[^\d+]/g, '');
      return clean ? `tel:${clean}` : '';
    },
  },
  {
    type: 'sms',
    label: 'SMS',
    category: 'Communication',
    description: 'Open the native SMS app with a recipient and message.',
    fields: [
      { key: 'phone', label: 'Recipient Phone', placeholder: '+1 415 555 0199', type: 'tel', required: true },
      { key: 'body', label: 'SMS Text', placeholder: 'JOIN VIP', type: 'textarea' },
    ],
    buildPayload: (v) => {
      const clean = (v.phone || '').replace(/[^\d+]/g, '');
      if (!clean) return '';
      const body = (v.body || '').trim();
      return body ? `sms:${clean}?body=${encodeURIComponent(body)}` : `sms:${clean}`;
    },
  },
  {
    type: 'email',
    label: 'Email',
    category: 'Communication',
    description: 'Compose a pre-addressed email with subject and message.',
    fields: [
      { key: 'email', label: 'Recipient Email', placeholder: 'hello@company.com', type: 'email', required: true },
      { key: 'subject', label: 'Subject Line', placeholder: 'Partnership Inquiry', type: 'text' },
      { key: 'body', label: 'Message Body', placeholder: 'Hi team,', type: 'textarea' },
    ],
    buildPayload: (v) => {
      const to = (v.email || '').trim();
      if (!to) return '';
      const params = new URLSearchParams();
      if (v.subject?.trim()) params.set('subject', v.subject.trim());
      if (v.body?.trim()) params.set('body', v.body.trim());
      const qs = params.toString();
      return qs ? `mailto:${to}?${qs}` : `mailto:${to}`;
    },
  },
  {
    type: 'wifi',
    label: 'WiFi',
    category: 'Utility',
    description: 'Share wireless network credentials cleanly on arrival.',
    fields: [
      { key: 'ssid', label: 'Network Name (SSID)', placeholder: 'Studio_Guest_5G', type: 'text', required: true },
      { key: 'password', label: 'Password', placeholder: 'Network password', type: 'text' },
      {
        key: 'encryption',
        label: 'Security Type',
        placeholder: 'WPA',
        type: 'select',
        options: [
          { value: 'WPA', label: 'WPA / WPA2 / WPA3' },
          { value: 'WEP', label: 'WEP' },
          { value: 'nopass', label: 'Open (No Password)' },
        ],
      },
    ],
    buildPayload: (v) => {
      const ssid = (v.ssid || '').trim();
      if (!ssid) return '';
      const enc = v.encryption || 'WPA';
      const pwd = (v.password || '').trim();
      return `WIFI:T:${enc};S:${ssid};P:${pwd};;`;
    },
  },
  {
    type: 'google_maps',
    label: 'Google Maps',
    category: 'Links',
    description: 'Direct visitors to turn-by-turn navigation for your venue.',
    fields: [
      {
        key: 'location',
        label: 'Google Maps URL or Street Address',
        placeholder: '1600 Amphitheatre Pkwy, Mountain View, CA',
        type: 'text',
        required: true,
      },
    ],
    buildPayload: (v) => {
      const val = (v.location || '').trim();
      if (!val) return '';
      if (/^https?:\/\//i.test(val)) return val;
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(val)}`;
    },
  },
  {
    type: 'upi',
    label: 'UPI Payment',
    category: 'Utility',
    description: 'Accept instant UPI payments with payee ID and optional amount.',
    fields: [
      { key: 'pa', label: 'UPI ID (VPA)', placeholder: 'merchant@okhdfcbank', type: 'text', required: true },
      { key: 'pn', label: 'Payee Name', placeholder: 'Pulse Studio', type: 'text', required: true },
      { key: 'am', label: 'Amount (INR, optional)', placeholder: '499.00', type: 'number' },
      { key: 'tn', label: 'Payment Note', placeholder: 'Invoice #1042', type: 'text' },
    ],
    buildPayload: (v) => {
      const pa = (v.pa || '').trim();
      if (!pa) return '';
      const params = new URLSearchParams();
      params.set('pa', pa);
      if (v.pn?.trim()) params.set('pn', v.pn.trim());
      if (v.am?.trim()) params.set('am', v.am.trim());
      params.set('cu', 'INR');
      if (v.tn?.trim()) params.set('tn', v.tn.trim());
      return `upi://pay?${params.toString()}`;
    },
  },
  {
    type: 'instagram',
    label: 'Instagram',
    category: 'Social',
    description: 'Route scans directly to your Instagram profile or reel.',
    fields: [
      { key: 'handle', label: 'Instagram Username or Profile URL', placeholder: '@pulseqr', type: 'text', required: true },
    ],
    buildPayload: (v) => {
      const raw = (v.handle || '').trim();
      if (!raw) return '';
      if (/^https?:\/\//i.test(raw)) return raw;
      return `https://instagram.com/${raw.replace(/^@/, '')}`;
    },
  },
  {
    type: 'facebook',
    label: 'Facebook',
    category: 'Social',
    description: 'Connect offline packaging to your Facebook page or group.',
    fields: [
      { key: 'handle', label: 'Facebook Page URL or Username', placeholder: 'https://facebook.com/yourpage', type: 'text', required: true },
    ],
    buildPayload: (v) => {
      const raw = (v.handle || '').trim();
      if (!raw) return '';
      if (/^https?:\/\//i.test(raw)) return raw;
      return `https://facebook.com/${raw.replace(/^@/, '')}`;
    },
  },
  {
    type: 'youtube',
    label: 'YouTube',
    category: 'Social',
    description: 'Launch product tutorials, channels, or YouTube Shorts.',
    fields: [
      { key: 'url', label: 'YouTube Channel or Video URL', placeholder: 'https://youtube.com/@channel', type: 'url', required: true },
    ],
    buildPayload: (v) => normalizeUrl(v.url),
  },
  {
    type: 'pdf',
    label: 'PDF',
    category: 'Media',
    description: 'Distribute restaurant menus, brochures, or technical spec sheets.',
    fields: [
      { key: 'url', label: 'Hosted PDF URL (or upload below)', placeholder: 'https://yourdomain.com/menu.pdf', type: 'url', required: true },
    ],
    buildPayload: (v) => normalizeUrl(v.url),
  },
  {
    type: 'image',
    label: 'Image',
    category: 'Media',
    description: 'Display high-resolution lookbooks, posters, or gallery assets.',
    fields: [
      { key: 'url', label: 'Hosted Image URL (or upload below)', placeholder: 'https://yourdomain.com/poster.png', type: 'url', required: true },
    ],
    buildPayload: (v) => normalizeUrl(v.url),
  },
  {
    type: 'video',
    label: 'Video',
    category: 'Media',
    description: 'Link to product walkthroughs, reels, or hosted MP4 clips.',
    fields: [
      { key: 'url', label: 'Hosted Video URL (or upload below)', placeholder: 'https://yourdomain.com/demo.mp4', type: 'url', required: true },
    ],
    buildPayload: (v) => normalizeUrl(v.url),
  },
  {
    type: 'vcard',
    label: 'vCard',
    category: 'Utility',
    description: 'Digital business card that saves directly to mobile contacts.',
    fields: [
      { key: 'fullName', label: 'Full Name', placeholder: 'Maya Lin', type: 'text', required: true },
      { key: 'org', label: 'Company', placeholder: 'Northstar Labs', type: 'text' },
      { key: 'title', label: 'Job Title', placeholder: 'Operations Lead', type: 'text' },
      { key: 'phone', label: 'Phone', placeholder: '+1 415 555 0199', type: 'tel' },
      { key: 'email', label: 'Email', placeholder: 'maya@northstar.io', type: 'email' },
      { key: 'website', label: 'Website', placeholder: 'https://northstar.io', type: 'url' },
    ],
    buildPayload: (v) => {
      const fn = (v.fullName || '').trim();
      if (!fn) return '';
      return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${fn}`,
        v.org?.trim() ? `ORG:${v.org.trim()}` : '',
        v.title?.trim() ? `TITLE:${v.title.trim()}` : '',
        v.phone?.trim() ? `TEL:${v.phone.trim()}` : '',
        v.email?.trim() ? `EMAIL:${v.email.trim()}` : '',
        v.website?.trim() ? `URL:${normalizeUrl(v.website)}` : '',
        'END:VCARD',
      ]
        .filter(Boolean)
        .join('\n');
    },
  },
  {
    type: 'event',
    label: 'Event',
    category: 'Utility',
    description: 'Calendar invite card with event title, location, and timing.',
    fields: [
      { key: 'summary', label: 'Event Title', placeholder: 'Annual Product Summit', type: 'text', required: true },
      { key: 'location', label: 'Venue / Meeting Link', placeholder: 'Moscone West, San Francisco', type: 'text' },
      { key: 'start', label: 'Start Date & Time', placeholder: '', type: 'datetime-local', required: true },
      { key: 'end', label: 'End Date & Time', placeholder: '', type: 'datetime-local' },
    ],
    buildPayload: (v) => {
      const summary = (v.summary || '').trim();
      if (!summary) return '';
      const fmt = (iso: string) =>
        iso ? iso.replace(/[-:]/g, '').replace('T', 'T') + '00' : '';
      return [
        'BEGIN:VEVENT',
        `SUMMARY:${summary}`,
        v.location?.trim() ? `LOCATION:${v.location.trim()}` : '',
        v.start ? `DTSTART:${fmt(v.start)}` : '',
        v.end ? `DTEND:${fmt(v.end)}` : '',
        'END:VEVENT',
      ]
        .filter(Boolean)
        .join('\n');
    },
  },
  {
    type: 'google_form',
    label: 'Google Form',
    category: 'Links',
    description: 'Collect event RSVPs, customer feedback, or lead registrations.',
    fields: [
      { key: 'url', label: 'Google Form URL', placeholder: 'https://docs.google.com/forms/d/e/.../viewform', type: 'url', required: true },
    ],
    buildPayload: (v) => normalizeUrl(v.url),
  },
];

export function getQRTypeConfig(type: QRType): QRTypeConfig {
  return QR_TYPES.find((t) => t.type === type) ?? QR_TYPES[0];
}

export function getManageQrUrl(qrId: string, editToken?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pulseqr.app';
  const base = `${origin}/manage/${encodeURIComponent(qrId)}`;
  return editToken ? `${base}?token=${encodeURIComponent(editToken)}` : base;
}

export function getDynamicRedirectUrl(qrId: string): string {
  return getManageQrUrl(qrId);
}

export function getShortUrl(qrId: string): string {
  return getManageQrUrl(qrId);
}

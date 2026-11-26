import { Timestamp } from 'firebase/firestore';

export type QRType =
  | 'website'
  | 'google_review'
  | 'whatsapp'
  | 'phone'
  | 'sms'
  | 'email'
  | 'wifi'
  | 'google_maps'
  | 'upi'
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'pdf'
  | 'image'
  | 'video'
  | 'vcard'
  | 'event'
  | 'google_form';

export type QRStatus = 'active' | 'paused' | 'archived';

export type PaperSize = 'A4' | 'A5' | 'Letter' | 'Custom';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string;
  role: 'user' | 'admin';
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended';
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface QRCodeRecord {
  qrId: string;
  owner: string;
  title: string;
  shortSlug: string;
  originalLink: string;
  currentLink: string;
  currentUrl?: string;
  cardNumber?: string;
  batchId?: string;
  batchName?: string;
  qrImage: string;
  qrType: QRType;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  scanCount: number;
  status: QRStatus;
  customColor: string;
  bgColor: string;
  logo: string;
  expiryDate: string;
}

export interface QREditTokenRecord {
  qrId: string;
  owner: string;
  token: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PrintBatchRecord {
  batchId: string;
  owner: string;
  batchName: string;
  cardCount: number;
  startCardNumber: number;
  paperSize: PaperSize;
  paperWidthMm: number;
  paperHeightMm: number;
  cardWidthMm: number;
  cardHeightMm: number;
  rows: number;
  cols: number;
  qrXPercent: number;
  qrYPercent: number;
  qrSizePercent: number;
  templateUrl: string;
  defaultUrl: string;
  qrColor: string;
  qrBgColor: string;
  status: 'active' | 'archived';
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface BulkOperationLog {
  row?: number;
  cardNumber?: string;
  qrId?: string;
  status: 'success' | 'error';
  message: string;
}

export interface ScanEventRecord {
  scanId: string;
  qrId: string;
  qrOwner: string;
  qrTitle: string;
  qrType: string;
  deviceType: 'Mobile' | 'Desktop' | 'Tablet';
  browser: string;
  os: string;
  country: string;
  city: string;
  referrer: string;
  timestamp: Timestamp | null;
}

export interface ContactMessageRecord {
  messageId: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  userId: string;
  status: 'new' | 'reviewed';
  createdAt: Timestamp | null;
}

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: 'success' | 'error' | 'info';
}

import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './config';

/**
 * Compresses an image file client-side to a compact WebP/PNG data URI (< 42KB)
 * so it stays safely within Firestore's 50KB blueprint cap if Storage is unavailable.
 */
export function compressImageToDataUrl(
  file: File,
  maxDimension = 180,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image format.'));
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (dataUrl.length > 46000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.65);
        }
        if (dataUrl.length > 49000) {
          reject(new Error('Image is too large even after compression. Choose a smaller icon.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads an image asset to Firebase Storage first; falls back to compact compressed
 * data URL if the Storage bucket has not been enabled yet on the Firebase project.
 */
export async function uploadImageAsset(
  file: File,
  folder: 'logos' | 'avatars' | 'templates',
  uid: string
): Promise<{ url: string; usedStorage: boolean }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const storageRef = ref(storage, `${folder}/${uid}/${Date.now()}_${safeName}`);

  try {
    const uploadPromise = uploadBytes(storageRef, file, {
      contentType: file.type || 'image/png',
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Storage upload timeout')), 4500)
    );
    await Promise.race([uploadPromise, timeoutPromise]);
    const url = await getDownloadURL(storageRef);
    return { url, usedStorage: true };
  } catch {
    if (folder === 'templates') {
      throw new Error('Storage unavailable for large template; using local print copy.');
    }
    const dataUrl = await compressImageToDataUrl(file, folder === 'logos' ? 160 : 200, 0.8);
    return { url: dataUrl, usedStorage: false };
  }
}

/**
 * Uploads media files (PDF, Image, Video) for media QR codes to Firebase Storage.
 */
export async function uploadMediaFile(
  file: File,
  uid: string
): Promise<string> {
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('File must be 20 MB or smaller.');
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const storageRef = ref(storage, `media/${uid}/${Date.now()}_${safeName}`);
  await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
  });
  return getDownloadURL(storageRef);
}

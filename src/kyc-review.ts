import { collection, addDoc } from 'firebase/firestore';
import { RondaServices } from './firebase-config.js';

export interface KycReviewData {
  userId: string;
  reason: string;
  selfieBlob: Blob;
  docBlob: Blob;
  timestamp: number;
  deviceInfo: {
    userAgent: string;
    screen: string;
  };
}

export async function submitKycReview(payload: any): Promise<string> {
  const ref = await addDoc(collection(RondaServices.db, 'kycReviews'), {
    userId: payload.uid || payload.userId,
    userName: payload.name || payload.userName || 'Usuario RONDA',
    userEmail: payload.email || payload.userEmail || '',
    createdAt: new Date().toISOString(),
    status: 'pending',
    reasonsForManual: [payload.reason || payload.reviewReason || 'Manual review required'],
    faceVerified: payload.faceVerified || false
  });
  return ref.id;
}

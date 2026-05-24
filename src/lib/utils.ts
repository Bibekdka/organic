import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { auth } from "./firebase"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUserAttribution() {
  const user = auth.currentUser;
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Unknown User';
  
  // Basic device detection
  const ua = navigator.userAgent;
  let device = 'Web';
  if (/mobile/i.test(ua)) device = 'Mobile';
  if (/tablet/i.test(ua)) device = 'Tablet';
  if (/iPad|iPhone|iPod/.test(ua)) device = 'iOS';
  if (/Android/.test(ua)) device = 'Android';
  if (/Macintosh/.test(ua)) device = 'Mac';
  if (/Windows/.test(ua)) device = 'Windows';
  if (/Linux/.test(ua)) device = 'Linux';

  return {
    userName,
    userId: user?.uid,
    device,
    timestamp: Date.now()
  };
}

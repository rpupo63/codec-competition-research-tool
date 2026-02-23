import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function mapThreatLevelToString(level: number): "LOW" | "MODERATE" | "HIGH" | "CRITICAL" {
  if (level <= 1) return "LOW";
  if (level === 2) return "MODERATE";
  if (level === 3) return "HIGH";
  return "CRITICAL"; // Assuming 4 or higher
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

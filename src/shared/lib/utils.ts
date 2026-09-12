import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Ghép class Tailwind, lớp sau thắng lớp trước. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

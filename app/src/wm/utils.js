import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs) => twMerge(clsx(inputs));
export const spring = { type: 'spring', stiffness: 300, damping: 30 };
export const pillSpring = { type: 'spring', stiffness: 380, damping: 30, mass: 0.9 };

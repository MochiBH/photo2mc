import { cva } from 'class-variance-authority';
import { cn } from './utils';

const buttonVariants = cva(
  "rounded-2xl border border-transparent bg-clip-padding text-sm font-semibold inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 select-none active:scale-[0.96]",
  {
    variants: {
      variant: {
        default: 'bg-neon text-primary-foreground glow-lime hover:brightness-110',
        outline: 'border-white/14 bg-white/[0.05] hover:bg-white/[0.1] hover:border-white/25',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        ghost: 'hover:bg-white/[0.07]',
        destructive: 'bg-bad-soft text-bad border-bad/40 hover:bg-bad/25',
      },
      size: { default: 'h-11 gap-2 px-4', sm: 'h-9 gap-1.5 px-3 text-[0.8rem] rounded-xl', lg: 'h-12 gap-2 px-5 text-base', icon: 'size-11' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({ className, variant = 'default', size = 'default', type = 'button', ...props }) {
  return <button type={type} data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

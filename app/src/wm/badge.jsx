import { cva } from 'class-variance-authority';
import { cn } from './utils';

const badgeVariants = cva(
  'h-6 gap-1 rounded-full border border-transparent px-2.5 text-xs font-semibold inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 [&>svg]:size-3! tnum',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        good: 'bg-good-soft text-good',
        bad: 'bg-bad-soft text-bad',
        gold: 'bg-gold-soft text-gold',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export function Badge({ className, variant = 'default', ...props }) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

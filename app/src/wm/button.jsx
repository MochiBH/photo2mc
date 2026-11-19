import { cva } from 'class-variance-authority';
import { cn } from './utils';

const buttonVariants = cva(
  "rounded-xl border border-transparent bg-clip-padding text-sm font-semibold inline-flex items-center justify-center whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 select-none active:scale-[0.97]",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:brightness-105',
        outline: 'border-border bg-card hover:bg-muted dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        ghost: 'hover:bg-muted dark:hover:bg-muted/50',
        destructive: 'bg-destructive/10 hover:bg-destructive/20 text-destructive dark:bg-destructive/20',
      },
      size: {
        default: 'h-11 gap-2 px-4',
        sm: 'h-9 gap-1.5 px-3 text-[0.8rem]',
        lg: 'h-12 gap-2 px-5 text-base',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export function Button({ className, variant = 'default', size = 'default', type = 'button', ...props }) {
  return <button type={type} data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

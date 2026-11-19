import { cn } from './utils';

export function Input({ className, type, ...props }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'dark:bg-input/30 border-input aria-invalid:border-destructive h-11 rounded-xl border bg-card px-3 py-1 text-base transition-colors placeholder:text-muted-foreground w-full min-w-0 disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

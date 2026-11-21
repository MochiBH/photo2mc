import { cn } from './utils';

export function Input({ className, type, ...props }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'border-white/12 font-normal tracking-normal normal-case text-foreground aria-invalid:border-destructive h-12 rounded-2xl border bg-black/30 px-3.5 py-1 text-base transition-[border-color,box-shadow] placeholder:text-white/35 w-full min-w-0 disabled:opacity-50 focus:border-primary/70 focus:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)] focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  );
}

import { cn } from './utils';
import { rippleFrom } from '../fx/fx';

/* Watermelon UI "Shimmer Button", in neon: a lime-to-cyan slab with a sheen that sweeps on hover and on press. */
export function ShimmerButton({ children, className, type = 'button', onClick, ...props }) {
  return (
    <button
      type={type}
      onClick={(e) => { rippleFrom(e); if (onClick) onClick(e); }}
      className={cn(
        'group relative h-13 w-full overflow-hidden rounded-2xl px-6 text-base font-bold tracking-tight',
        'bg-neon text-primary-foreground glow-lime',
        'transition-[filter,transform] duration-300 hover:brightness-110 active:scale-[0.97] disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      <div className={cn('absolute inset-0 -translate-x-full', 'bg-linear-to-r from-transparent via-white/55 to-transparent', 'transition-transform duration-700 group-hover:translate-x-full group-active:translate-x-full')} />
    </button>
  );
}

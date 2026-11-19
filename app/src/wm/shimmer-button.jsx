import { cn } from './utils';

/* Watermelon UI "Shimmer Button". The sheen also runs once on press, since phones have no hover. */
export function ShimmerButton({ children, className, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(
        'group relative h-12 w-full overflow-hidden rounded-xl px-6 text-base font-semibold',
        'bg-primary text-primary-foreground',
        'transition-[box-shadow,transform] duration-300 hover:shadow-lg active:scale-[0.98] disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      <div
        className={cn(
          'absolute inset-0 -translate-x-full',
          'bg-linear-to-r from-transparent via-white/40 to-transparent',
          'transition-transform duration-700 group-hover:translate-x-full group-active:translate-x-full',
        )}
      />
    </button>
  );
}

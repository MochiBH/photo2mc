import { cn } from './utils';

/* Watermelon UI card, as smoked glass. `glow` adds a light travelling round the edge, for the one hero card on a screen.
   The light and the soft glow under it are their own small elements (see .glow-ring and .glow-halo) so that they move
   without the card being repainted. */
export function Card({ className, glow = false, children, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn(
        'bg-card text-card-foreground relative flex min-w-0 flex-col gap-4 rounded-3xl py-4 text-sm ring-1 ring-white/10',
        'shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_20px_50px_-28px_rgb(0_0_0/0.9)]',
        glow && 'glow-border',
        className,
      )}
      {...props}
    >
      {glow && <><span className="glow-halo" aria-hidden="true" /><span className="glow-ring" aria-hidden="true"><i /></span></>}
      {children}
    </div>
  );
}
export function CardHeader({ className, ...props }) {
  return <div data-slot="card-header" className={cn('grid auto-rows-min items-start gap-1 px-4', className)} {...props} />;
}
export function CardTitle({ className, ...props }) {
  return <h3 data-slot="card-title" className={cn('m-0 text-base leading-snug font-semibold tracking-tight', className)} {...props} />;
}
export function CardDescription({ className, ...props }) {
  return <div data-slot="card-description" className={cn('text-muted-foreground text-sm', className)} {...props} />;
}
export function CardContent({ className, ...props }) {
  return <div data-slot="card-content" className={cn('px-4', className)} {...props} />;
}

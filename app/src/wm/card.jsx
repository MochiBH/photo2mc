import { cn } from './utils';

export function Card({ className, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn('ring-foreground/10 bg-card text-card-foreground gap-4 rounded-2xl py-4 text-sm ring-1 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] dark:shadow-none flex flex-col min-w-0', className)}
      {...props}
    />
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
export function CardFooter({ className, ...props }) {
  return <div data-slot="card-footer" className={cn('bg-muted/50 -mb-4 rounded-b-2xl border-t p-4 flex items-center', className)} {...props} />;
}

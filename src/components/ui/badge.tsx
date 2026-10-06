import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
        ready: "border-transparent bg-state-ready/15 text-state-ready",
        blocked: "border-transparent bg-state-blocked/15 text-state-blocked",
        in_progress: "border-transparent bg-state-progress/15 text-state-progress",
        awaiting_approval: "border-transparent bg-state-approval/20 text-amber-700 dark:text-amber-300",
        done: "border-transparent bg-state-done/20 text-muted-foreground",
        critical: "border-state-critical/40 bg-state-critical/10 text-state-critical",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

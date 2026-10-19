import * as React from "react"
import { cn } from "@/utils/helpers"

const Badge = React.forwardRef(({ className, variant = "default", ...props }, ref) => {
  const variants = {
    default: "bg-primary/20 text-primary border-primary/30",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive/20 text-destructive border-destructive/30",
    success: "bg-green-500/20 text-green-500 border-green-500/30",
    warning: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
    outline: "text-foreground border-border",
  };

  return (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variants[variant],
        className
      )}
      {...props}
    />
  )
})
Badge.displayName = "Badge"

export { Badge }

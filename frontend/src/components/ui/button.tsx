import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: 
          "bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 text-primary-foreground shadow-md hover:shadow-xl hover:from-primary-300 hover:via-primary-400 hover:to-primary-500 focus-visible:ring-primary-400 rounded-xl",
        destructive:
          "bg-destructive text-white shadow-md hover:bg-destructive/90 hover:shadow-lg focus-visible:ring-destructive rounded-xl",
        outline:
          "border-2 border-border bg-background shadow-sm hover:bg-accent hover:border-primary-400/50 hover:text-accent-foreground focus-visible:ring-primary-400 rounded-xl transition-colors",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 hover:shadow-md focus-visible:ring-secondary rounded-xl",
        ghost:
          "hover:bg-accent hover:text-accent-foreground focus-visible:ring-accent rounded-lg",
        link: 
          "text-primary underline-offset-4 hover:underline hover:text-primary-600 focus-visible:ring-primary-400 rounded-md",
      },
      size: {
        sm: "h-9 rounded-lg px-3 text-xs",
        default: "h-11 px-5 py-2.5 rounded-xl",
        lg: "h-14 rounded-xl px-8 text-base",
        xl: "h-16 rounded-2xl px-10 text-lg",
        icon: "size-11 rounded-xl",
        "icon-sm": "size-9 rounded-lg",
        "icon-lg": "size-14 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

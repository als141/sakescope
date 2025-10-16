import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-semibold transition-all duration-200 w-fit whitespace-nowrap shrink-0 [&>svg]:pointer-events-none overflow-hidden",
  {
    variants: {
      variant: {
        default: 
          "border-transparent bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 [a&]:hover:bg-primary-200 dark:[a&]:hover:bg-primary-800",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        outline:
          "border-border bg-background [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        success:
          "border-transparent bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 [a&]:hover:bg-green-200 dark:[a&]:hover:bg-green-800",
        warning:
          "border-transparent bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 [a&]:hover:bg-yellow-200 dark:[a&]:hover:bg-yellow-800",
        error:
          "border-transparent bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 [a&]:hover:bg-red-200 dark:[a&]:hover:bg-red-800",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90",
      },
      size: {
        sm: "px-2 py-0.5 text-xs [&>svg]:size-3",
        default: "px-3 py-1 text-sm [&>svg]:size-3.5",
        lg: "px-4 py-1.5 text-base [&>svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

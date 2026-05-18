"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function ButtonGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="button-group"
      role="group"
      className={cn(
        "inline-flex items-stretch [&>[data-slot=button]:not(:first-child)]:rounded-l-none [&>[data-slot=button]:not(:last-child)]:rounded-r-none [&>[data-slot=button]:not(:first-child)]:border-l-0",
        className
      )}
      {...props}
    />
  )
}

export { ButtonGroup }

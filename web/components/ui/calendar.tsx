"use client"

import * as React from "react"
import { DayPicker, type DropdownProps } from "react-day-picker"
import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function CalendarDropdown({ value, onChange, options }: DropdownProps) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={onChange}
        className="cursor-pointer appearance-none rounded-lg border border-input bg-background pl-2.5 pr-6 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring min-w-[72px]"
      >
        {options?.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-1.5 size-3 opacity-50" />
    </div>
  )
}

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 select-none", className)}
      classNames={{
        months:          "relative flex flex-col gap-4",
        month:           "space-y-4",
        month_caption:   "flex justify-center items-center h-7",
        caption_label:   "text-sm font-medium",
        dropdowns:       "flex items-center gap-1.5",
        nav:             "",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-1 top-0 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-1 top-0 h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        month_grid:      "w-full border-collapse space-y-1",
        weekdays:        "flex",
        weekday:         "text-muted-foreground w-9 font-normal text-[0.8rem] text-center",
        week:            "flex w-full mt-2",
        day:             "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent focus-within:relative focus-within:z-20 [&:has(.day-range-start)]:rounded-l-md [&:has(.day-range-end)]:rounded-r-md [&:has(.day-range-start)]:bg-primary/20 [&:has(.day-range-end)]:bg-primary/20",
        day_button:      cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        selected:        "[&>button]:!bg-primary [&>button]:text-primary-foreground [&>button]:hover:!bg-primary [&>button]:hover:text-primary-foreground",
        today:           "[&>button]:bg-accent [&>button]:text-accent-foreground",
        outside:         "opacity-40 aria-selected:opacity-30",
        disabled:        "opacity-30 pointer-events-none",
        hidden:          "invisible",
        range_start:     "day-range-start [&>button]:!bg-primary [&>button]:text-primary-foreground [&>button]:rounded-r-none",
        range_end:       "day-range-end [&>button]:!bg-primary [&>button]:text-primary-foreground [&>button]:rounded-l-none",
        range_middle:    "bg-accent [&>button]:!bg-transparent [&>button]:rounded-none [&>button]:hover:!bg-transparent [&>button]:text-accent-foreground",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left"
            ? <ChevronLeft className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />,
        Dropdown: CalendarDropdown,
      }}
      {...props}
    />
  )
}

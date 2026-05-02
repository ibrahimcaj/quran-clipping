"use client"

import * as React from "react"
import { type DateRange } from "react-day-picker"
import { format, subDays, startOfMonth, endOfMonth, startOfYear, startOfQuarter } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const PRESETS: { label: string; getValue: () => DateRange }[] = [
  { label: "Last 24 hours",  getValue: () => ({ from: subDays(new Date(), 1),   to: new Date() }) },
  { label: "Last 7 days",    getValue: () => ({ from: subDays(new Date(), 7),   to: new Date() }) },
  { label: "Last 30 days",   getValue: () => ({ from: subDays(new Date(), 30),  to: new Date() }) },
  { label: "Last 3 months",  getValue: () => ({ from: subDays(new Date(), 90),  to: new Date() }) },
  { label: "Last 12 months", getValue: () => ({ from: subDays(new Date(), 365), to: new Date() }) },
  { label: "This month",     getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "Quarter to date",getValue: () => ({ from: startOfQuarter(new Date()), to: new Date() }) },
  { label: "Year to date",   getValue: () => ({ from: startOfYear(new Date()),  to: new Date() }) },
]

interface DateRangePickerProps {
  value: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
  align?: "start" | "center" | "end"
  startMonth?: Date
  endMonth?: Date
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  className,
  align = "start",
  startMonth = new Date(2016, 0),
  endMonth = new Date(),
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const label = value?.from
    ? value.to
      ? `${format(value.from, "MMM d, yyyy")} – ${format(value.to, "MMM d, yyyy")}`
      : format(value.from, "MMM d, yyyy")
    : placeholder

  function selectPreset(preset: typeof PRESETS[0]) {
    onChange(preset.getValue())
  }

  function isPresetActive(preset: typeof PRESETS[0]) {
    if (!value?.from || !value?.to) return false
    const p = preset.getValue()
    if (!p.from || !p.to) return false
    return (
      Math.abs(value.from.getTime() - p.from.getTime()) < 60000 &&
      Math.abs(value.to.getTime() - p.to.getTime()) < 60000
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 justify-start text-sm font-normal gap-2",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-1rem),340px)] p-0 overflow-hidden"
        align={align}
      >
        <div className="flex flex-col">
          {/* Presets */}
          <div className="border-b p-2 flex flex-row gap-1 overflow-x-auto flex-nowrap scrollbar-none">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => selectPreset(preset)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs transition-colors",
                  isPresetActive(preset)
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div>
            <Calendar
              mode="range"
              selected={value}
              onSelect={onChange}
              numberOfMonths={1}
              captionLayout="dropdown"
              startMonth={startMonth}
              endMonth={endMonth}
              disabled={{ after: new Date() }}
              defaultMonth={value?.from ?? subDays(new Date(), 30)}
              className="p-3"
            />
            {value && (
              <div className="border-t p-2 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
                  onClick={() => { onChange(undefined); setOpen(false) }}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

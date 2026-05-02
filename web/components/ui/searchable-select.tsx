"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type SearchableSelectItem = {
    value: string;
    label: string;
    subtitle?: string;
    image?: string;
};

export function SearchableSelect({
    items,
    value,
    onChange,
    placeholder,
    searchPlaceholder,
    emptyLabel,
    className,
    disabled = false,
}: {
    items: SearchableSelectItem[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    searchPlaceholder: string;
    emptyLabel: string;
    className?: string;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const selected = useMemo(() => items.find((item) => item.value === value), [items, value]);

    return (
        <Popover open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
            <PopoverTrigger
                render={
                    <button
                        type="button"
                        disabled={disabled}
                        className={cn(
                            "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors hover:border-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                            className,
                        )}
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            {selected?.image && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={selected.image} alt="" className="size-6 shrink-0 rounded object-cover" />
                            )}
                            <span className="truncate text-left">{selected?.label ?? placeholder}</span>
                        </span>
                        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                    </button>
                }
            />
            <PopoverContent className="w-[320px] p-0">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyLabel}</CommandEmpty>
                        <CommandGroup>
                            {items.map((item) => {
                                const checked = item.value === value;
                                return (
                                    <CommandItem
                                        key={item.value}
                                        value={`${item.label} ${item.subtitle ?? ""}`}
                                        onSelect={() => {
                                            onChange(item.value);
                                            setOpen(false);
                                        }}
                                    >
                                        <span className="mr-2 flex h-4 w-4 shrink-0 items-center justify-center">
                                            {checked ? (
                                                <Check className="h-4 w-4" />
                                            ) : item.image ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={item.image}
                                                    alt=""
                                                    className="size-4 rounded object-cover"
                                                />
                                            ) : null}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="truncate">{item.label}</p>
                                            {item.subtitle ? <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p> : null}
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

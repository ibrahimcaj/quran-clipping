import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface ColorPickerProps {
    value: string;
    onChange: (color: string) => void;
    label?: string;
}

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
    const hexValue = value.startsWith("#") ? value : "#" + value;

    return (
        <div className="flex items-end gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="w-12 h-10 p-1"
                        style={{ backgroundColor: hexValue }}
                        title={hexValue}
                    />
                </PopoverTrigger>
                <PopoverContent className="w-64">
                    <div className="flex flex-col gap-4">
                        {label && (
                            <label className="text-sm font-medium">
                                {label}
                            </label>
                        )}
                        <Input
                            type="color"
                            value={hexValue}
                            onChange={(e) =>
                                onChange(e.target.value.replace("#", ""))
                            }
                            className="w-full h-12 cursor-pointer"
                        />
                        <Input
                            type="text"
                            value={hexValue}
                            onChange={(e) =>
                                onChange(e.target.value.replace("#", ""))
                            }
                            placeholder="#000000"
                            className="w-full"
                        />
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import { cn } from "~/lib/utils";

interface ComboboxOption {
	value: string;
	label: string;
}

interface ComboboxProps {
	options: ComboboxOption[];
	value: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	searchPlaceholder?: string;
	disabled?: boolean;
	className?: string;
}

export function Combobox({
	options,
	value,
	onValueChange,
	placeholder = "選択してください",
	searchPlaceholder = "検索...",
	disabled = false,
	className,
}: ComboboxProps) {
	const [open, setOpen] = React.useState(false);
	const [query, setQuery] = React.useState("");
	const inputRef = React.useRef<HTMLInputElement>(null);

	const filtered = query
		? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
		: options;

	const selectedLabel = options.find((o) => o.value === value)?.label;

	function handleSelect(val: string) {
		onValueChange(val);
		setOpen(false);
		setQuery("");
	}

	return (
		<PopoverPrimitive.Root
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) setQuery("");
			}}
		>
			<PopoverPrimitive.Trigger asChild>
				<button
					type="button"
					disabled={disabled}
					className={cn(
						"flex h-8 w-72 items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
						!selectedLabel && "text-muted-foreground",
						className,
					)}
				>
					<span className="truncate">{selectedLabel ?? placeholder}</span>
					<ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
				</button>
			</PopoverPrimitive.Trigger>

			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Content
					sideOffset={4}
					align="start"
					onOpenAutoFocus={(e) => {
						e.preventDefault();
						inputRef.current?.focus();
					}}
					className="z-50 w-72 rounded-lg border border-border bg-popover text-popover-foreground shadow-md outline-none"
				>
					{/* Search input */}
					<div className="flex items-center gap-2 border-b px-3 py-2">
						<SearchIcon className="size-4 shrink-0 text-muted-foreground" />
						<input
							ref={inputRef}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder={searchPlaceholder}
							className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
						/>
					</div>

					{/* Options list */}
					<div className="max-h-60 overflow-y-auto p-1">
						{filtered.length === 0 ? (
							<p className="py-6 text-center text-sm text-muted-foreground">
								見つかりません
							</p>
						) : (
							filtered.map((o) => (
								<button
									key={o.value}
									type="button"
									onClick={() => handleSelect(o.value)}
									className="relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
								>
									{o.value === value && (
										<span className="absolute right-2 flex size-4 items-center justify-center">
											<CheckIcon className="size-4" />
										</span>
									)}
									{o.label}
								</button>
							))
						)}
					</div>
				</PopoverPrimitive.Content>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}

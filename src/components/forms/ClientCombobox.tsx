import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { normalizeSearch } from "@/lib/searchUtils";

export interface ClientOption {
  id: string;
  name: string;
  address_intervention?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface ClientComboboxProps {
  clients: ClientOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
}

/**
 * Combobox de sélection client : recherche intelligente
 * (tolérante aux accents, à la casse, sur nom + adresse + email + téléphone).
 */
export default function ClientCombobox({
  clients,
  value,
  onChange,
  placeholder = "Sélectionner un client...",
  allowEmpty = true,
  emptyLabel = "Aucun",
  className,
}: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => clients.find((c) => c.id === value) ?? null,
    [clients, value]
  );

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return clients;
    return clients.filter((c) => {
      const haystack = normalizeSearch(
        [c.name, c.address_intervention, c.email, c.phone].filter(Boolean).join(" ")
      );
      return haystack.includes(q);
    });
  }, [clients, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">
            {selected ? selected.name : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Rechercher un client..."
              className="border-0 focus:ring-0"
            />
          </div>
          <CommandList>
            <CommandEmpty>Aucun client trouvé.</CommandEmpty>
            <CommandGroup>
              {allowEmpty && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  <span className="text-muted-foreground italic">{emptyLabel}</span>
                </CommandItem>
              )}
              {filtered.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.name}</div>
                    {c.address_intervention && (
                      <div className="truncate text-xs text-muted-foreground">{c.address_intervention}</div>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
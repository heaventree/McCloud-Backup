import * as React from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"

export interface Option {
  label: string
  value: string
}

interface MultiSelectProps {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  className,
  disabled = false,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const handleRemove = (value: string) => {
    onChange(selected.filter((item) => item !== value))
  }

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleOutsideClick)
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <div
        className={cn(
          "flex min-h-10 w-full flex-wrap items-center rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-white focus-within:outline-none focus-within:ring-2 focus-within:ring-gray-400 focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:ring-offset-gray-950 dark:focus-within:ring-gray-800",
          isOpen && "ring-2 ring-gray-400 ring-offset-2 dark:ring-gray-800",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
        onClick={() => !disabled && setIsOpen(true)}
      >
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1 py-1">
            {selected.map((value) => {
              const option = options.find((opt) => opt.value === value)
              return (
                <Badge
                  key={value}
                  variant="secondary"
                  className="flex items-center gap-1 rounded-md px-2 py-1"
                >
                  {option?.label || value}
                  {!disabled && (
                    <button
                      type="button"
                      className="ml-1 rounded-full outline-none ring-offset-white focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 dark:ring-offset-gray-950 dark:focus:ring-gray-800"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemove(value)
                      }}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </Badge>
              )
            })}
          </div>
        ) : (
          <span className="py-1 text-muted-foreground">{placeholder}</span>
        )}
      </div>
      {isOpen && !disabled && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-md dark:border-gray-800 dark:bg-gray-950">
          <div className="max-h-60 overflow-y-auto p-1">
            {options.map((option) => (
              <div
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm",
                  selected.includes(option.value)
                    ? "bg-gray-100 dark:bg-gray-800"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
                onClick={() => {
                  handleSelect(option.value)
                  // We don't close the dropdown when selecting multiple items
                }}
              >
                {option.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
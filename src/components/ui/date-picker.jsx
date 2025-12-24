import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function DatePicker({ value, onChange, className, disabled }) {
  const [date, setDate] = React.useState(value ? new Date(value + 'T00:00:00') : undefined)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (value) {
      setDate(new Date(value + 'T00:00:00'))
    }
  }, [value])

  const handleSelect = (newDate) => {
    if (newDate) {
      setDate(newDate)
      const year = newDate.getFullYear()
      const month = String(newDate.getMonth() + 1).padStart(2, '0')
      const day = String(newDate.getDate()).padStart(2, '0')
      onChange(`${year}-${month}-${day}`)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-12 border-2 border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 rounded-2xl",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-5 w-5" />
          {date ? format(date, "dd/MM/yyyy") : <span>Selecione uma data</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-lg shadow-xl border z-50" align="start" side="bottom" sideOffset={4}>
        <style>{`
          .rdp-day:not(.rdp-day_disabled):not(.rdp-day_outside):hover {
            background-color: #dbeafe !important;
            cursor: pointer;
          }
          .dark .rdp-day:not(.rdp-day_disabled):not(.rdp-day_outside):hover {
            background-color: rgb(30 58 138 / 0.3) !important;
          }
          .rdp-day_selected:hover {
            background-color: #2563eb !important;
          }
        `}</style>
        <div className="p-3">
          <DayPicker
            mode="single"
            selected={date}
            onSelect={handleSelect}
            locale={ptBR}
            showOutsideDays={false}
            components={{
              IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
              IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

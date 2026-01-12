import * as React from "react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function WeekPicker({ value, onChange, className, disabled }) {
  const [date, setDate] = React.useState(() => {
    if (value) {
      const [year, month, day] = value.split('-').map(Number)
      // Usar horário local ao invés de UTC para evitar problemas de fuso
      return new Date(year, month - 1, day)
    }
    return undefined
  })
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (value) {
      // Usar horário local para evitar mudança de dia
      const [year, month, day] = value.split('-').map(Number)
      setDate(new Date(year, month - 1, day))
    }
  }, [value])

  const handleSelect = (newDate) => {
    if (newDate) {
      setDate(newDate)
      // Usar horário local para evitar mudança de dia
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
            "w-full justify-start text-left font-normal h-8 border-2 border-green-300 dark:border-green-600 hover:border-green-400 dark:hover:border-green-500 rounded-2xl",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione uma segunda-feira</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-lg shadow-xl border z-50" align="start" side="bottom" sideOffset={4}>
        <style>{`
          .rdp-day:not(.rdp-day_disabled):not(.rdp-day_outside):hover {
            background-color: #dbeafe !important;
            cursor: pointer;
          }
          .dark .rdp-day:not(.rdp_day_disabled):not(.rdp-day_outside):hover {
            background-color: rgb(30 58 138 / 0.3) !important;
          }
          .rdp-day_selected {
            background-color: #2563eb !important;
            color: white !important;
          }
          .rdp-day_selected:hover {
            background-color: #1d4ed8 !important;
          }
          .rdp-day_disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        `}</style>
        <div className="p-3">
          <DayPicker
            mode="single"
            selected={date}
            onSelect={handleSelect}
            locale={ptBR}
            showOutsideDays={false}
            disabled={(date) => {
              // Bloquear todos os dias exceto segundas-feiras (1 = segunda)
              const dayOfWeek = date.getDay();
              return dayOfWeek !== 1;
            }}
            modifiers={{
              monday: (date) => date.getDay() === 1
            }}
            modifiersStyles={{
              monday: {
                backgroundColor: '#dcfce7',
                color: '#166534',
                fontWeight: 'bold',
                borderRadius: '50%'
              }
            }}
            fromYear={2020}
            toYear={2030}
            components={{
              IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
              IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

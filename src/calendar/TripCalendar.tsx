import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DayCellMountArg } from '@fullcalendar/core'
import { lineColorForIndex } from '../utils/lineColors'
import type { Day } from '../types/trip'
import './TripCalendar.css'

export function TripCalendar({ days }: { days: Day[] }) {
  const dayIndexByDate = new Map(days.map((day, index) => [day.date, index]))

  function handleDateClick(date: string) {
    const day = days.find((d) => d.date === date)
    if (day) {
      document.getElementById(`day-${day.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  function handleDayCellMount(arg: DayCellMountArg) {
    const dateStr = arg.date.toLocaleDateString('en-CA')
    const dayIndex = dayIndexByDate.get(dateStr)
    if (dayIndex === undefined) return

    arg.el.classList.add('fc-day-has-stop')
    const dot = document.createElement('span')
    dot.className = 'atlas-day-dot'
    dot.style.background = lineColorForIndex(dayIndex)
    arg.el.querySelector('.fc-daygrid-day-top')?.appendChild(dot)
  }

  return (
    <div className="atlas-calendar">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{ left: 'prev,next', center: 'title', right: '' }}
        initialDate={days[0]?.date}
        height="auto"
        dayCellDidMount={handleDayCellMount}
        dateClick={(info) => handleDateClick(info.dateStr)}
      />
    </div>
  )
}

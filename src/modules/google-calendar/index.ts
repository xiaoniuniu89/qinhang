import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import { google } from 'googleapis'
import { config } from '../../config/index.js'

let calendar: any = null

// Initialize Google Calendar client
function initializeCalendar() {
  if (!config.google?.credentials) {
    throw new Error('Google credentials not configured')
  }

  const auth = new google.auth.GoogleAuth({
    credentials: config.google.credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly']
  })

  calendar = google.calendar({ version: 'v3', auth })
  return calendar
}

// Check availability for a specific date range
export async function checkAvailability(
  startDate: Date,
  endDate: Date,
  calendarId: string = 'primary'
): Promise<{ start: Date; end: Date }[]> {
  if (!calendar) {
    initializeCalendar()
  }

  try {
    const response = await calendar.events.list({
      calendarId,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: 'Europe/Dublin' // Explicitly request times in Dublin timezone
    })

    const busySlots = response.data.items || []

    // Debug logging
    if (busySlots.length > 0) {
      console.log('Sample calendar event:', {
        summary: busySlots[0].summary,
        start: busySlots[0].start,
        end: busySlots[0].end
      })
    }

    // For now, return the busy slots - the caller can compute free slots
    return busySlots.map((event: any) => ({
      start: new Date(event.start.dateTime || event.start.date),
      end: new Date(event.end.dateTime || event.end.date)
    }))
  } catch (error: any) {
    throw new Error(`Failed to fetch calendar events: ${error.message}`)
  }
}

// Find available time slots with flexible duration
export async function findAvailableSlots(
  startDate: Date,
  endDate: Date,
  duration: number = 30, // Default 30 minutes (most common lesson length)
  calendarId: string = 'primary'
): Promise<{ start: Date; end: Date }[]> {
  const busySlots = await checkAvailability(startDate, endDate, calendarId)

  // Define working hours (9 AM - 8 PM)
  const workingHours = {
    start: 9, // 9 AM
    end: 20 // 8 PM
  }

  const availableSlots: { start: Date; end: Date }[] = []
  let currentTime = new Date(startDate)

  // Ensure we start at the beginning of a working hour
  if (currentTime.getHours() < workingHours.start) {
    currentTime.setHours(workingHours.start, 0, 0, 0)
  }

  while (currentTime < endDate) {
    // Skip if outside working hours
    if (currentTime.getHours() < workingHours.start) {
      currentTime.setHours(workingHours.start, 0, 0, 0)
    }
    if (currentTime.getHours() >= workingHours.end) {
      // Move to next day
      currentTime.setDate(currentTime.getDate() + 1)
      currentTime.setHours(workingHours.start, 0, 0, 0)
      continue
    }

    // Skip Saturdays only (Saturday = 6)
    // Sundays are included as teaching days
    if (currentTime.getDay() === 6) {
      currentTime.setDate(currentTime.getDate() + 1)
      currentTime.setHours(workingHours.start, 0, 0, 0)
      continue
    }

    const slotEnd = new Date(currentTime.getTime() + duration * 60000)

    // Check if this slot conflicts with any busy slot
    const isAvailable = !busySlots.some(busy => {
      const conflicts = (
        (currentTime >= busy.start && currentTime < busy.end) ||
        (slotEnd > busy.start && slotEnd <= busy.end) ||
        (currentTime <= busy.start && slotEnd >= busy.end)
      )

      // Debug logging for first busy slot on each day
      if (conflicts && currentTime.getHours() === 14 && currentTime.getMinutes() === 30) {
        console.log('Conflict detected:', {
          slot: `${currentTime.toISOString()} - ${slotEnd.toISOString()}`,
          slotLocal: `${currentTime.toLocaleString('en-IE')} - ${slotEnd.toLocaleString('en-IE')}`,
          busy: `${busy.start.toISOString()} - ${busy.end.toISOString()}`,
          busyLocal: `${busy.start.toLocaleString('en-IE')} - ${busy.end.toLocaleString('en-IE')}`
        })
      }

      return conflicts
    })

    if (isAvailable && slotEnd.getHours() <= workingHours.end) {
      availableSlots.push({
        start: new Date(currentTime),
        end: new Date(slotEnd)
      })
    }

    // Move to next potential slot (30-minute intervals)
    currentTime = new Date(currentTime.getTime() + 30 * 60000)
  }

  return availableSlots
}

// Format availability for the AI agent - shows specific available time slots
export async function getAvailabilitySummary(
  daysAhead: number = 7,
  calendarId?: string
): Promise<string> {
  const now = new Date()
  const futureDate = new Date()
  futureDate.setDate(now.getDate() + daysAhead)

  const calId = calendarId || config.google?.calendarId || 'primary'
  const slots = await findAvailableSlots(now, futureDate, 30, calId)

  if (slots.length === 0) {
    return `No available slots found in the next ${daysAhead} days.`
  }

  // Group by day
  const slotsByDay = new Map<string, { start: Date; end: Date }[]>()

  for (const slot of slots) {
    const dateKey = slot.start.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    })

    if (!slotsByDay.has(dateKey)) {
      slotsByDay.set(dateKey, [])
    }
    slotsByDay.get(dateKey)!.push(slot)
  }

  // Format with specific time slots
  let summary = `Available times in the next ${daysAhead} days:\n\n`

  for (const [day, daySlots] of slotsByDay) {
    // Sort slots by start time
    daySlots.sort((a, b) => a.start.getTime() - b.start.getTime())

    // Group consecutive 30-min slots into longer ranges
    const ranges: { start: Date; end: Date }[] = []
    let currentRange: { start: Date; end: Date } | null = null

    for (const slot of daySlots) {
      if (!currentRange) {
        currentRange = { start: slot.start, end: slot.end }
      } else if (slot.start.getTime() === currentRange.end.getTime()) {
        // Consecutive slot - extend the range
        currentRange.end = slot.end
      } else {
        // Gap found - save current range and start new one
        ranges.push(currentRange)
        currentRange = { start: slot.start, end: slot.end }
      }
    }
    if (currentRange) {
      ranges.push(currentRange)
    }

    // Format time ranges conversationally - always use "between" to avoid implying entire block is free
    if (ranges.length > 0) {
      const firstRange = ranges[0]
      const lastRange = ranges[ranges.length - 1]

      if (firstRange && lastRange) {
        const firstStart = firstRange.start.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: firstRange.start.getMinutes() === 0 ? undefined : '2-digit',
          hour12: true
        })
        const lastEnd = lastRange.end.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: lastRange.end.getMinutes() === 0 ? undefined : '2-digit',
          hour12: true
        })
        const timeDescription = `some slots between ${firstStart} and ${lastEnd}`

        summary += `**${day}:** ${timeDescription}\n`
      }
    }
  }

  summary += '\nNote: Final confirmation always done by CC based on location and lesson length (30-60 minutes).'

  return summary
}

// Check if a specific time slot is available
export async function isTimeAvailable(
  requestedTime: Date,
  duration: number = 30,
  calendarId?: string
): Promise<{ available: boolean; alternatives?: { start: Date; end: Date }[] }> {
  const calId = calendarId || config.google?.calendarId || 'primary'

  // Check a 2-hour window around the requested time
  const windowStart = new Date(requestedTime)
  windowStart.setHours(windowStart.getHours() - 1)
  const windowEnd = new Date(requestedTime)
  windowEnd.setHours(windowEnd.getHours() + 3)

  const slots = await findAvailableSlots(windowStart, windowEnd, duration, calId)

  // Check if requested time matches any available slot
  const isAvailable = slots.some(slot =>
    Math.abs(slot.start.getTime() - requestedTime.getTime()) < 60000 // Within 1 minute
  )

  if (isAvailable) {
    return { available: true }
  }

  // Find alternatives on the same day
  const sameDay = slots.filter(slot =>
    slot.start.getDate() === requestedTime.getDate() &&
    slot.start.getMonth() === requestedTime.getMonth()
  ).slice(0, 3) // Return up to 3 alternatives

  return { available: false, alternatives: sameDay }
}

const googleCalendarPlugin: FastifyPluginAsync = async (fastify, opts) => {
  fastify.log.info('Google Calendar module loaded')

  // Initialize calendar client if credentials are available
  if (config.google?.credentials) {
    try {
      initializeCalendar()
      fastify.log.info('Google Calendar client initialized')
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to initialize Google Calendar client')
    }
  } else {
    fastify.log.warn('Google Calendar credentials not configured')
  }

  // Debug endpoint to see raw calendar events
  fastify.get<{
    Querystring: {
      days?: string
    }
  }>('/calendar/debug', async (request, reply) => {
    if (!config.google?.credentials) {
      return reply.status(503).send({ error: 'Google Calendar not configured' })
    }

    const days = parseInt(request.query.days || '7', 10)

    try {
      const now = new Date()
      const futureDate = new Date()
      futureDate.setDate(now.getDate() + days)

      const calId = config.google.calendarId || 'primary'
      const busySlots = await checkAvailability(now, futureDate, calId)

      return {
        count: busySlots.length,
        events: busySlots.map(slot => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          startLocal: slot.start.toLocaleString('en-IE', { timeZone: 'Europe/Dublin' }),
          endLocal: slot.end.toLocaleString('en-IE', { timeZone: 'Europe/Dublin' })
        }))
      }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to debug calendar')
      return reply.status(500).send({
        error: 'Failed to fetch calendar events',
        details: error.message
      })
    }
  })

  // API endpoint to check availability
  fastify.get<{
    Querystring: {
      days?: string
    }
  }>('/calendar/availability', async (request, reply) => {
    if (!config.google?.credentials) {
      return reply.status(503).send({ error: 'Google Calendar not configured' })
    }

    const days = parseInt(request.query.days || '7', 10)

    try {
      const summary = await getAvailabilitySummary(days, config.google.calendarId)
      return { availability: summary }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get availability')
      return reply.status(500).send({
        error: 'Failed to fetch availability',
        details: error.message
      })
    }
  })

  // API endpoint to get available slots (JSON format)
  fastify.get<{
    Querystring: {
      days?: string
      duration?: string
    }
  }>('/calendar/slots', async (request, reply) => {
    if (!config.google?.credentials) {
      return reply.status(503).send({ error: 'Google Calendar not configured' })
    }

    const days = parseInt(request.query.days || '7', 10)
    const duration = parseInt(request.query.duration || '60', 10)

    try {
      const now = new Date()
      const futureDate = new Date()
      futureDate.setDate(now.getDate() + days)

      const calId = config.google.calendarId || 'primary'
      const slots = await findAvailableSlots(now, futureDate, duration, calId)

      return {
        slots: slots.map(slot => ({
          start: slot.start.toISOString(),
          end: slot.end.toISOString(),
          startFormatted: slot.start.toLocaleString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })
        }))
      }
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get slots')
      return reply.status(500).send({
        error: 'Failed to fetch slots',
        details: error.message
      })
    }
  })
}

export default fp(googleCalendarPlugin, {
  name: 'google-calendar-module',
  decorators: {
    fastify: []
  }
})

// Export functions for use by other modules
export { initializeCalendar }

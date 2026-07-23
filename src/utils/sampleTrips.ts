import { createDay, createItem, createTrip } from '../api/trips'
import type { NewItemInput } from '../api/trips'
import type { ActivityCategory, ItemType, Trip } from '../types/trip'

interface SampleItem {
  type: ItemType
  category: ActivityCategory | null
  dayOffset: number
  name: string
  notes: string | null
  lat: number
  lng: number
  locationLabel: string
  countryCode?: string
  lat2?: number
  lng2?: number
  location2Label?: string
  startTime?: string
  endTime?: string
  flightNumber?: string
  priceLabel?: string
  endOffset?: number
  roomType?: string
  guests?: number
  nightlyRate?: number
  taxesFees?: number
  confirmationNumber?: string
  rating?: number
}

interface SampleTrip {
  name: string
  description: string
  countryCode: string
  startDate: string
  days: string[]
  items: SampleItem[]
}

const SAMPLE_TRIPS: SampleTrip[] = [
  {
    name: 'Tokyo Food and Design Week',
    description: 'A four-day itinerary built around neighborhoods, food counters, galleries, and one easy day trip.',
    countryCode: 'JP',
    startDate: '2026-09-08',
    days: ['Arrival and Shinjuku', 'Tsukiji to Ginza', 'Kamakura day trip', 'Asakusa and departure'],
    items: [
      {
        type: 'flight',
        category: null,
        dayOffset: 0,
        name: 'JAL 5',
        flightNumber: 'JAL 5',
        notes: 'Arrive and clear customs before heading into the city.',
        lat: 37.6213,
        lng: -122.379,
        locationLabel: 'San Francisco International Airport, San Francisco, CA',
        countryCode: 'US',
        lat2: 35.772,
        lng2: 140.3929,
        location2Label: 'Narita International Airport, Chiba, Japan',
        startTime: '12:20',
        endTime: '15:10',
        priceLabel: 'Flight reservation',
      },
      {
        type: 'stay',
        category: null,
        dayOffset: 0,
        endOffset: 3,
        name: 'Hotel Groove Shinjuku',
        notes: 'Base near transit, food, and evening walks.',
        lat: 35.6958,
        lng: 139.7005,
        locationLabel: 'Hotel Groove Shinjuku, Tokyo, Japan',
        roomType: 'King room',
        guests: 2,
        nightlyRate: 280,
        taxesFees: 96,
        confirmationNumber: 'ATLAS-TYO-4812',
        rating: 4,
      },
      {
        type: 'activity',
        category: 'food',
        dayOffset: 0,
        name: 'Omoide Yokocho dinner walk',
        notes: 'Small counter restaurants near Shinjuku Station.',
        lat: 35.6939,
        lng: 139.7006,
        locationLabel: 'Omoide Yokocho, Tokyo, Japan',
        startTime: '19:00',
        priceLabel: 'Dinner reservation recommended',
      },
      {
        type: 'activity',
        category: 'food',
        dayOffset: 1,
        name: 'Tsukiji Outer Market breakfast',
        notes: 'Go early for seafood stalls and coffee before Ginza opens.',
        lat: 35.6654,
        lng: 139.7707,
        locationLabel: 'Tsukiji Outer Market, Tokyo, Japan',
        startTime: '08:30',
      },
      {
        type: 'activity',
        category: 'shopping',
        dayOffset: 1,
        name: 'Ginza design stores',
        notes: 'Stationery, tableware, and architecture stops along Chuo-dori.',
        lat: 35.6717,
        lng: 139.765,
        locationLabel: 'Ginza, Tokyo, Japan',
        startTime: '12:30',
      },
      {
        type: 'activity',
        category: 'nature',
        dayOffset: 2,
        name: 'Tsurugaoka Hachimangu and Komachi-dori',
        notes: 'Train to Kamakura, shrine grounds, snacks, and beach if weather holds.',
        lat: 35.3261,
        lng: 139.5564,
        locationLabel: 'Tsurugaoka Hachimangu, Kamakura, Japan',
        startTime: '10:00',
      },
      {
        type: 'activity',
        category: 'attraction',
        dayOffset: 3,
        name: 'Senso-ji morning visit',
        notes: 'Temple, Nakamise-dori, and Sumida River before departure.',
        lat: 35.7148,
        lng: 139.7967,
        locationLabel: 'Senso-ji, Tokyo, Japan',
        startTime: '09:30',
      },
    ],
  },
  {
    name: 'Reykjavik and South Coast',
    description: 'A five-day route for waterfalls, black sand beaches, geothermal soaking, and slower city nights.',
    countryCode: 'IS',
    startDate: '2026-10-03',
    days: ['Arrival and harbor', 'Golden Circle', 'South Coast', 'Blue Lagoon', 'Departure'],
    items: [
      {
        type: 'stay',
        category: null,
        dayOffset: 0,
        endOffset: 4,
        name: 'Exeter Hotel Reykjavik',
        notes: 'Central base near the harbor and restaurants.',
        lat: 64.1494,
        lng: -21.9426,
        locationLabel: 'Exeter Hotel, Reykjavik, Iceland',
        roomType: 'Standard double',
        guests: 2,
        nightlyRate: 245,
        taxesFees: 120,
        confirmationNumber: 'ATLAS-KEF-2049',
        rating: 4,
      },
      {
        type: 'activity',
        category: 'food',
        dayOffset: 0,
        name: 'Reykjavik harbor dinner',
        notes: 'Seafood dinner after checking in.',
        lat: 64.1511,
        lng: -21.9438,
        locationLabel: 'Old Harbour, Reykjavik, Iceland',
        startTime: '19:30',
      },
      {
        type: 'activity',
        category: 'nature',
        dayOffset: 1,
        name: 'Thingvellir National Park',
        notes: 'Start the Golden Circle with the rift valley walk.',
        lat: 64.2559,
        lng: -21.1295,
        locationLabel: 'Thingvellir National Park, Iceland',
        startTime: '09:00',
      },
      {
        type: 'activity',
        category: 'nature',
        dayOffset: 1,
        name: 'Gullfoss waterfall',
        notes: 'Layer up for wind and spray.',
        lat: 64.3271,
        lng: -20.1199,
        locationLabel: 'Gullfoss, Iceland',
        startTime: '14:30',
      },
      {
        type: 'activity',
        category: 'nature',
        dayOffset: 2,
        name: 'Seljalandsfoss',
        notes: 'Waterproof shell recommended for the path behind the falls.',
        lat: 63.6156,
        lng: -19.9886,
        locationLabel: 'Seljalandsfoss, Iceland',
        startTime: '10:00',
      },
      {
        type: 'activity',
        category: 'nature',
        dayOffset: 2,
        name: 'Reynisfjara black sand beach',
        notes: 'Stay far back from sneaker waves.',
        lat: 63.4043,
        lng: -19.0444,
        locationLabel: 'Reynisfjara Beach, Vik, Iceland',
        startTime: '15:30',
      },
      {
        type: 'activity',
        category: 'nature',
        dayOffset: 3,
        name: 'Blue Lagoon reservation',
        notes: 'Book timed entry and leave luggage in the car.',
        lat: 63.8804,
        lng: -22.4495,
        locationLabel: 'Blue Lagoon, Grindavik, Iceland',
        startTime: '11:00',
        priceLabel: 'Timed ticket required',
      },
    ],
  },
  {
    name: 'Mexico City Long Weekend',
    description: 'Museums, markets, parks, and a relaxed neighborhood rhythm over three full days.',
    countryCode: 'MX',
    startDate: '2026-11-12',
    days: ['Roma and Condesa', 'Chapultepec and Polanco', 'Coyoacan and Xochimilco'],
    items: [
      {
        type: 'stay',
        category: null,
        dayOffset: 0,
        endOffset: 2,
        name: 'Nima Local House Hotel',
        notes: 'Small hotel in Roma Norte.',
        lat: 19.4192,
        lng: -99.1629,
        locationLabel: 'Nima Local House Hotel, Mexico City, Mexico',
        roomType: 'Suite',
        guests: 2,
        nightlyRate: 220,
        taxesFees: 82,
        confirmationNumber: 'ATLAS-MEX-7731',
        rating: 5,
      },
      {
        type: 'activity',
        category: 'food',
        dayOffset: 0,
        name: 'Contramar lunch',
        notes: 'Reserve ahead for tuna tostadas and fish al pastor.',
        lat: 19.4199,
        lng: -99.1718,
        locationLabel: 'Contramar, Mexico City, Mexico',
        startTime: '14:00',
        priceLabel: 'Reservation recommended',
      },
      {
        type: 'activity',
        category: 'shopping',
        dayOffset: 0,
        name: 'Roma Norte gallery walk',
        notes: 'Bookshops, design stores, and coffee between Plaza Rio de Janeiro and Alvaro Obregon.',
        lat: 19.4209,
        lng: -99.1607,
        locationLabel: 'Plaza Rio de Janeiro, Roma Norte, Mexico City',
        startTime: '17:00',
      },
      {
        type: 'activity',
        category: 'attraction',
        dayOffset: 1,
        name: 'Museo Nacional de Antropologia',
        notes: 'Give this at least two hours.',
        lat: 19.426,
        lng: -99.1863,
        locationLabel: 'Museo Nacional de Antropologia, Mexico City, Mexico',
        startTime: '10:00',
        priceLabel: 'Museum ticket',
      },
      {
        type: 'activity',
        category: 'nature',
        dayOffset: 1,
        name: 'Chapultepec Park walk',
        notes: 'Lake path and castle views after the museum.',
        lat: 19.4204,
        lng: -99.1819,
        locationLabel: 'Bosque de Chapultepec, Mexico City, Mexico',
        startTime: '14:30',
      },
      {
        type: 'activity',
        category: 'attraction',
        dayOffset: 2,
        name: 'Frida Kahlo Museum',
        notes: 'Timed tickets sell out. Bring ID.',
        lat: 19.3552,
        lng: -99.1627,
        locationLabel: 'Frida Kahlo Museum, Mexico City, Mexico',
        startTime: '10:30',
        priceLabel: 'Timed ticket required',
      },
      {
        type: 'activity',
        category: 'nature',
        dayOffset: 2,
        name: 'Xochimilco trajinera ride',
        notes: 'Go late afternoon for softer light on the canals.',
        lat: 19.2576,
        lng: -99.1019,
        locationLabel: 'Embarcadero Nuevo Nativitas, Xochimilco, Mexico City',
        startTime: '16:00',
      },
    ],
  },
]

export async function createSampleTrips(ownerId: string, existingTripNames: string[] = []): Promise<Trip[]> {
  const created: Trip[] = []
  const existing = new Set(existingTripNames.map((name) => name.toLowerCase()))

  for (const sample of SAMPLE_TRIPS) {
    if (existing.has(sample.name.toLowerCase())) continue
    const trip = await createTrip({
      name: sample.name,
      description: sample.description,
      countryCode: sample.countryCode,
      startDate: sample.startDate,
      endDate: dateForOffset(sample.startDate, sample.days.length - 1),
      ownerId,
    })
    created.push(trip)

    const days = await Promise.all(
      sample.days.map((label, index) => createDay(trip.id, dateForOffset(sample.startDate, index), label)),
    )

    await Promise.all(
      sample.items.map((item, index) => {
        const startDate = dateForOffset(sample.startDate, item.dayOffset)
        const input: NewItemInput = {
          tripId: trip.id,
          dayId: days[item.dayOffset]?.id ?? days[0].id,
          type: item.type,
          category: item.type === 'activity' ? item.category : null,
          name: item.name,
          notes: item.notes,
          lat: item.lat,
          lng: item.lng,
          locationLabel: item.locationLabel,
          countryCode: item.countryCode ?? sample.countryCode,
          lat2: item.lat2 ?? null,
          lng2: item.lng2 ?? null,
          location2Label: item.location2Label ?? null,
          startDate,
          endDate: item.endOffset != null ? dateForOffset(sample.startDate, item.endOffset) : null,
          startTime: item.startTime ?? null,
          endTime: item.endTime ?? null,
          flightNumber: item.flightNumber ?? null,
          priceLabel: item.priceLabel ?? null,
          photoUrl: null,
          googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.locationLabel)}`,
          roomType: item.roomType ?? null,
          guests: item.guests ?? null,
          nightlyRate: item.nightlyRate ?? null,
          taxesFees: item.taxesFees ?? null,
          confirmationNumber: item.confirmationNumber ?? null,
          rating: item.rating ?? null,
          position: index,
        }
        return createItem(input)
      }),
    )
  }

  return created
}

function dateForOffset(startDate: string, offset: number): string {
  const date = new Date(`${startDate}T00:00:00`)
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

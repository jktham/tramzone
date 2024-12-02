import type { NextApiRequest, NextApiResponse } from 'next'
import fs from "node:fs/promises"
import "util/types"

type ResponseData = Tram[] | string

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	if (!(await fs.stat("data/parsed/tramTrips.json").catch((e) => false))) {
		res.status(500).send("no parsed tramTrips (npm run parse)")
		return
	}

	const test_key = "57c5dbbbf1fe4d000100001842c323fa9ff44fbba0b9b925f0c052d1"
	let gtfs_realtime = fetch("https://api.opentransportdata.swiss/gtfsrt2020?format=JSON", {
		headers: {
			"Authorization": test_key
		}
	}).then((res) => res.json())

	let weekday = (new Date().getDay() + 6) % 7 // mon=0
	let tramTrips: TramTrip[] = JSON.parse((await fs.readFile(`data/parsed/tramTrips${weekday}.json`)).toString()) // todo: next day
	// tramTrips = tramTrips.filter((t) => t.service_days[weekday] == 1)

	let timeRange = 600000
	tramTrips = tramTrips.filter((t) => {
		let times = t.stops.map((s) => (s.arrival) - new Date().getTime() + 10*timeRange) // todo: might lose trips with large delays
		times = times.filter((t) => t >= 0)
		return Math.min(...times) < 20*timeRange
	})

	let realtime = await gtfs_realtime

	let tripIds: Set<string> = new Set(tramTrips.map((t) => t.trip_id))
	let tripUpdates: TripUpdate[] = realtime["Entity"].filter((e) => tripIds.has(e["Id"])).map((t) => {
		return {
			trip_id: t["TripUpdate"]["Trip"]["TripId"],
			trip_time: t["TripUpdate"]["Trip"]["StartTime"],
			trip_date: t["TripUpdate"]["Trip"]["StartDate"],
			stops: t["TripUpdate"]["StopTimeUpdate"]?.map((u) => {
				return {
					stop_id: u["StopId"],
					stop_sequence: u["StopSequence"],
					arrival_delay: u["Arrival"] ? u["Arrival"]["Delay"] : 0,
					departure_delay: u["Departure"] ? u["Departure"]["Delay"] : 0
				}
			})
		}
	})
	let tripUpdatesMap: Map<string, TripUpdate> = new Map()
	tripUpdates.map((u) => {
		tripUpdatesMap.set(u.trip_id, u)
	})

	let stations: Station[] = JSON.parse((await fs.readFile("data/parsed/stations.json")).toString())
	let stationsMap: Map<number, Station> = new Map()
	stations.map((s) => {
		stationsMap.set(s.id, s)
	})

	let trams: Tram[] = tramTrips.map((t) => {
		let update: TripUpdate = tripUpdatesMap.get(t.trip_id)
		return {
			trip_id: t.trip_id,
			trip_name: t.trip_name,
			headsign: t.headsign,
			direction: t.direction,
			route_id: t.route_id,
			route_name: t.route_name,
			service_id: t.service_id,
			service_days: t.service_days,
			progress: 0,
			delay: 0,
			active: false,
			stops: t.stops.map((s) => {
				let station: Station = stationsMap.get(Number(s.stop_id.split(":")[0]))
				return {
					stop_id: s.stop_id,
					stop_diva: station.diva,
					stop_name: station.name,
					stop_sequence: s.stop_sequence,
					arrival: s.arrival,
					departure: s.departure,
					arrival_delay: update?.stops?.find((us) => us.stop_id == s.stop_id)?.arrival_delay || 0,
					departure_delay: update?.stops?.find((us) => us.stop_id == s.stop_id)?.departure_delay || 0,
					pred_arrival: 0,
					pred_departure: 0,
					arrived: false,
					departed: false
				}
			})
		}
	})

	trams = trams.map((t) => {
		let time = new Date().getTime()
		t.stops = t.stops.map((s) => {
			s.pred_arrival = s.arrival + s.arrival_delay*1000
			s.pred_departure = s.departure + s.departure_delay*1000
			s.arrived = s.pred_arrival <= time
			s.departed = s.pred_departure <= time
			
			if (s.arrived) {
				t.progress = Math.max(t.progress, s.stop_sequence)
			}
			return s
		})

		let prev_stop = t.stops.find((s) => s.stop_sequence == Math.floor(t.progress))
		let next_stop = t.stops.find((s) => s.stop_sequence == Math.floor(t.progress + 1))
		if (prev_stop && next_stop) {
			if (prev_stop.departed) {
				let p = prev_stop.pred_departure
				let n = next_stop.pred_arrival
				let frac = (time-p) / (n-p)
				t.progress += frac
			}
		}
		if (next_stop) {
			t.delay = next_stop.arrival_delay
		}
		if (t.progress > 0 && t.progress < t.stops.length) {
			t.active = true
		}

		return t
	})

	// only with stops in 10 min window
	trams = trams.filter((t) => {
		let times = t.stops.map((s) => (s.pred_arrival) - new Date().getTime() + timeRange)
		times = times.filter((t) => t >= 0)
		return Math.min(...times) < 2*timeRange
	})
	trams = trams.sort((a, b) => Number(a.trip_name) - Number(b.trip_name))

	res.status(200).json(trams)
}

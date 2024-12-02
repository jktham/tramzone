import type { NextApiRequest, NextApiResponse } from 'next'
import fs from "node:fs/promises"
import "util/types"

function getISO(time) {
	let h = time.split(":")[0]
	let m = time.split(":")[1]
	let s = time.split(":")[2]
	let d = new Date()
	d.setHours(h)
	d.setMinutes(m)
	d.setSeconds(s)
	d.setMilliseconds(0)
	return d.getTime()
}

type ResponseData = UpdatedTramTrip[] | string

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	if (!(await fs.stat("data/parsed/tramTrips.json").catch((e) => false))) {
		res.status(404).send("no parsed tramTrips (npm run parse)")
		return
	}
	let tramTrips: TramTrip[] = JSON.parse((await fs.readFile("data/parsed/tramTrips.json")).toString())
	let weekday = new Date().getDay()
	tramTrips = tramTrips.filter((t) => t.service_days[weekday] == 1)

	let tripIds: Set<string> = new Set(tramTrips.map((t) => t.trip_id))

	const test_key = "57c5dbbbf1fe4d000100001842c323fa9ff44fbba0b9b925f0c052d1"
	let gtfs_realtime = await fetch("https://api.opentransportdata.swiss/gtfsrt2020?format=JSON", {
		headers: {
			"Authorization": test_key
		}
	})
	let realtime = await gtfs_realtime.json()

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

	let updated: UpdatedTramTrip[] = tramTrips.map((t) => {
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
			stops: t.stops.map((s) => {
				let station: Station = stationsMap.get(Number(s.stop_id.split(":")[0]))
				return {
					stop_id: s.stop_id,
					stop_diva: station.diva,
					stop_name: station.name,
					stop_sequence: s.stop_sequence,
					arrival: getISO(s.arrival),
					departure: getISO(s.departure),
					arrival_delay: update?.stops?.find((us) => us.stop_id == s.stop_id)?.arrival_delay || 0,
					departure_delay: update?.stops?.find((us) => us.stop_id == s.stop_id)?.departure_delay || 0,
				}
			})
		}
	})

	// only with stops in next 30 min
	updated = updated.filter((t) => {
		let times = t.stops.map((s) => s.departure - new Date().getTime())
		times = times.filter((t) => t >= 0)
		return Math.min(...times) < 1800000
	})
	
	res.status(200).json(updated)
}

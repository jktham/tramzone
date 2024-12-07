import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs/promises";
import "../../utils/types";
import { parseData } from "../../utils/parseUtils"

type QueryParams = {
	active: boolean; // return only currently active trams
	line: string; // return only trams belonging to line (route_name)
	station: number; // return only trams with stops at station (diva_id)
	static: boolean; // dont add delays, much faster because no rt fetch
	timeOffset: number; // return trams with time offset by this (ms timestamp, -3600000 = one hour ago)
};

type ResponseData = Tram[] | string;

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	await parseData(false)

	let query: QueryParams = {
		active: req.query.active === "true" || false,
		line: (req.query.line && req.query.line.toString()) || "",
		station: Number(req.query.station) || 0,
		static: req.query.static === "true" || false,
		timeOffset: Number(req.query.timeOffset) || 0,
	};

	const test_key = "57c5dbbbf1fe4d000100001842c323fa9ff44fbba0b9b925f0c052d1";
	let gtfs_realtime = fetch("https://api.opentransportdata.swiss/gtfsrt2020?format=JSON", {
		headers: {
			Authorization: test_key,
			"Accept-Encoding": "gzip, deflate",
		},
	}).then((res) => res.json());

	let today = new Date(new Date().getTime() + query.timeOffset);
	today.setHours(0, 0, 0, 0);
	let weekday = (today.getDay() + 6) % 7; // mon=0

	let tramTrips: TramTrip[] = JSON.parse((await fs.readFile(`data/parsed/tramTrips${weekday}.json`)).toString());
	let services: Service[] = JSON.parse((await fs.readFile(`data/parsed/services.json`)).toString());
	let serviceExceptions: ServiceException[] = JSON.parse((await fs.readFile(`data/parsed/serviceExceptions.json`)).toString());

	let servicesMap: Map<string, Service> = new Map();
	services.map((s) => {
		servicesMap.set(s.service_id, s);
	});
	let exceptionsMap: Map<string, ServiceException[]> = new Map();
	serviceExceptions.map((s) => {
		if (exceptionsMap.has(s.service_id)) {
			exceptionsMap.set(s.service_id, [s, ...exceptionsMap.get(s.service_id)]);
		} else {
			exceptionsMap.set(s.service_id, [s]);
		}
	});
	tramTrips = tramTrips.filter((t) => {
		let exceptions = exceptionsMap.get(t.service_id);
		if (exceptions) {
			for (let e of exceptions) {
				if (today.getTime() == e.date && e.type == 2) {
					return false;
				}
				if (today.getTime() == e.date && e.type == 1) {
					return true;
				}
			}
		}

		let service = servicesMap.get(t.service_id);
		if (today.getTime() >= service.start && today.getTime() <= service.end) {
			if (service.days[weekday] == 1) {
				return true;
			}
		}
		return false;
	});

	let realtime = query.static ? {"Entity": []} : await gtfs_realtime;
	if (realtime?.error) {
		console.log(realtime)
		realtime = {"Entity": []}
	}

	let tripIds: Set<string> = new Set(tramTrips.map((t) => t.trip_id));
	let tripUpdates: TripUpdate[] = realtime["Entity"].filter((e) => tripIds.has(e["Id"])).map((t) => { // todo: ScheduleRelationship
		return {
			trip_id: t["TripUpdate"]["Trip"]["TripId"],
			trip_time: t["TripUpdate"]["Trip"]["StartTime"],
			trip_date: t["TripUpdate"]["Trip"]["StartDate"],
			stops: t["TripUpdate"]["StopTimeUpdate"]?.map((u) => {
				return {
					stop_id: u["StopId"],
					stop_sequence: u["StopSequence"],
					arrival_delay: u["Arrival"] ? u["Arrival"]["Delay"] : 0,
					departure_delay: u["Departure"] ? u["Departure"]["Delay"] : 0,
				};
			}),
		};
	});
	let tripUpdatesMap: Map<string, TripUpdate> = new Map();
	tripUpdates.map((u) => {
		tripUpdatesMap.set(u.trip_id, u);
	});

	let stations: Station[] = JSON.parse((await fs.readFile("data/parsed/stations.json")).toString());
	let stationsMap: Map<number, Station> = new Map();
	stations.map((s) => {
		stationsMap.set(s.id, s);
	});

	let trams: Tram[] = tramTrips.map((t) => {
		let update: TripUpdate = tripUpdatesMap.get(t.trip_id);
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
				let station: Station = stationsMap.get(Number(s.stop_id.split(":")[0]));
				return {
					stop_id: s.stop_id,
					stop_diva: station.diva,
					stop_name: station.name,
					stop_sequence: s.stop_sequence,
					arrival: today.getTime() + s.arrival,
					departure: today.getTime() + s.departure,
					arrival_delay: update?.stops?.find((us) => us.stop_id == s.stop_id)?.arrival_delay || 0,
					departure_delay: update?.stops?.find((us) => us.stop_id == s.stop_id)?.departure_delay || 0,
					pred_arrival: 0,
					pred_departure: 0,
					arrived: false,
					departed: false,
				};
			}),
		};
	});

	trams = trams.map((t) => {
		let time = new Date().getTime() + query.timeOffset;
		t.stops = t.stops.map((s) => {
			s.pred_arrival = s.arrival + s.arrival_delay * 1000;
			s.pred_departure = s.departure + s.departure_delay * 1000;
			s.arrived = s.pred_arrival <= time;
			s.departed = s.pred_departure <= time;

			if (s.arrived) {
				t.progress = Math.max(t.progress, s.stop_sequence);
			}
			return s;
		});

		let prev_stop = t.stops.find((s) => s.stop_sequence == Math.floor(t.progress));
		let next_stop = t.stops.find((s) => s.stop_sequence == Math.floor(t.progress + 1));
		if (prev_stop && next_stop) {
			if (prev_stop.departed) {
				let p = prev_stop.pred_departure;
				let n = next_stop.pred_arrival;
				let frac = (time - p) / (n - p);
				t.progress += frac;
			}
		}
		if (next_stop) {
			t.delay = next_stop.arrival_delay;
		}
		if (t.progress > 0 && t.progress < t.stops.length) {
			t.active = true;
		}

		return t;
	});

	if (query.active) {
		trams = trams.filter((t) => t.active);
	}
	if (query.line) {
		trams = trams.filter((t) => t.route_name == query.line);
	}
	if (query.station) {
		trams = trams.filter((t) => new Set(t.stops.map((s) => s.stop_diva)).has(query.station));
	}
	trams = trams.sort((a, b) => Number(a.trip_name) - Number(b.trip_name));

	res.status(200).json(trams);
}

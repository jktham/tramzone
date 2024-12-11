import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs/promises";
import { Service, ServiceException, Station, StopStatus, Tram, TramTrip, TripStatus, TripUpdate, Stop } from "../../utils/types";
import { parseData } from "../../utils/parseUtils"
import { existsSync } from "node:fs";

type QueryParams = {
	active: boolean; // return only currently active trams
	line: string; // return only trams belonging to line (route_name)
	station: number; // return only trams with stops at station (diva_id)
	static: boolean; // dont add delays, much faster because no rt fetch
	time: number; // return trams at this time (ms timestamp)
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
		time: Number(req.query.time) || 0,
		timeOffset: Number(req.query.timeOffset) || 0,
	};

	let gtfs_realtime = fetch("https://api.opentransportdata.swiss/gtfsrt2020?format=JSON", {
		headers: {
			Authorization: process.env.KEY_RT,
			"Accept-Encoding": "gzip, deflate",
		},
	}).then((res) => res.json());

	let time = query.time || new Date().getTime();
	time += query.timeOffset;

	let today = new Date(time);
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
		let offset = 0
		for (let s of t.stops) {
			if (s.arrival >= 86400000 || s.departure >= 86400000) { // only supports next day for now
				offset = 6;
				s.arrival = s.arrival % 86400000;
				s.departure = s.departure % 86400000;
			}
		}
		if (today.getTime() >= service.start && today.getTime() <= service.end) { // does not consider offset but eh
			return t.service_days[(weekday + offset) % 7] == 1
		}
		return false;
	});

	let realtime = query.static ? {"Entity": []} : await gtfs_realtime;
	
	// recover from rate limit
	if (!realtime || realtime.error) {
		console.log(realtime)
		if (existsSync("data/gtfs/realtime.json")) {
			realtime = JSON.parse((await fs.readFile("data/gtfs/realtime.json")).toString());
		} else {
			realtime = {"Entity": []};
		}
	} else { // todo: performance
		let tripIds: Set<string> = new Set(tramTrips.map((t) => t.trip_id));
		let rt = {"Entity": realtime["Entity"].filter((e) => tripIds.has(e["Id"]))};
		fs.writeFile("data/gtfs/realtime.json", JSON.stringify(rt));
	}

	let tripIds: Set<string> = new Set(tramTrips.map((t) => t.trip_id));
	let tripUpdates: TripUpdate[] = realtime["Entity"].filter((e) => tripIds.has(e["Id"])).map((t) => {
		return {
			trip_id: t["TripUpdate"]["Trip"]["TripId"],
			trip_time: t["TripUpdate"]["Trip"]["StartTime"],
			trip_date: t["TripUpdate"]["Trip"]["StartDate"],
			trip_status: String(t["TripUpdate"]["Trip"]["ScheduleRelationship"] || "scheduled").toLowerCase() as TripStatus,
			stops: t["TripUpdate"]["StopTimeUpdate"]?.map((u) => {
				return {
					stop_id: u["StopId"],
					stop_sequence: u["StopSequence"],
					stop_status: String(u["ScheduleRelationship"] || "scheduled").toLowerCase() as StopStatus,
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
			trip_status: update?.trip_status || TripStatus.Scheduled,
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
				let u = update?.stops?.find((us) => us.stop_id == s.stop_id);
				return {
					stop_id: s.stop_id,
					stop_diva: station.diva,
					stop_name: station.name,
					stop_sequence: s.stop_sequence,
					stop_status: u?.stop_status || StopStatus.Scheduled,
					arrival: today.getTime() + s.arrival,
					departure: today.getTime() + s.departure,
					arrival_delay: u?.arrival_delay || 0,
					departure_delay: u?.departure_delay || 0,
					pred_arrival: 0,
					pred_departure: 0,
					arrived: false,
					departed: false,
				};
			}),
		};
	});

	trams = trams.map((t) => {
		t.stops = t.stops.map((s) => {
			s.pred_arrival = s.arrival + s.arrival_delay * 1000;
			s.pred_departure = s.departure + s.departure_delay * 1000;
			if (s.pred_departure <= s.pred_arrival) {
				s.pred_departure = s.pred_arrival;
			}
			return s;
		});
		return t;
	});

	let arrivalsMap: Map<Number, {stop: Stop, line: string}[]> = new Map();
	trams.map((t) => {
		t.stops.map((s) => {
			if (arrivalsMap.has(s.stop_diva)) {
				arrivalsMap.set(s.stop_diva, [{stop: s, line: t.route_name}, ...arrivalsMap.get(s.stop_diva)]);
			} else {
				arrivalsMap.set(s.stop_diva, [{stop: s, line: t.route_name}]);
			}
		})
	});

	trams = trams.map((t) => {
		// make trams wait at first stop, todo: handle delay edge cases
		let arrivals = arrivalsMap.get(t.stops[0].stop_diva).filter((s) => s.line == t.route_name && s.stop.stop_sequence != t.stops[0].stop_sequence)
		let prev_arrivals = arrivals.filter((a) => a.stop.pred_arrival < t.stops[0].pred_arrival).sort((a, b) => b.stop.pred_arrival - a.stop.pred_arrival);
		if (prev_arrivals[0] && t.stops[0].pred_arrival - prev_arrivals[0].stop.pred_arrival <= 3600000) {
			t.stops[0].pred_arrival = prev_arrivals[0].stop.pred_departure + 1;
		}
		// quick fix for scuffed data, todo: handle skipped stops
		t.stops = t.stops.map((s) => {
			let ns = t.stops.find((s2) => s2.stop_sequence == s.stop_sequence + 1);
			if (s.pred_departure <= s.pred_arrival && s.stop_status != StopStatus.Skipped) {
				// if (s.stop_sequence != 0 && s.stop_sequence != t.stops.length) {
				// 	s.pred_departure = s.pred_arrival + 1; // add 1 to indicate modified
				// }
			}
			if (ns && s.pred_departure >= ns.pred_arrival && ns.stop_status != StopStatus.Skipped) { // try to interpolate inner stop times from 10% - 90%
				s.pred_departure = (s.pred_arrival*9 + ns.pred_departure*1) / 10 + 1;
				ns.pred_arrival = (s.pred_arrival*1 + ns.pred_departure*9) / 10 + 1;
			}
			return s;
		});
		// sequence progress
		t.stops = t.stops.map((s) => {
			s.arrived = s.pred_arrival <= time;
			s.departed = s.pred_departure <= time;

			if (s.arrived) {
				t.progress = Math.max(t.progress, s.stop_sequence);
			}
			return s;
		});
		// segment progress
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
		if (time >= t.stops[0].pred_arrival && time <= t.stops[t.stops.length-1].pred_departure) {
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

	console.log(process.memoryUsage().heapUsed / 1024 / 1024)
	res.status(200).json(trams);
}

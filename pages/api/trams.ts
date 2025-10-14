import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs/promises";
import { Service, ServiceException, Station, StopStatus, Tram, TramTrip, TripStatus, TripUpdate, Stop } from "../../utils/types";
import { getDatestring, parseData, ENDPOINT_RT, KEY_RT } from "../../utils/parseUtils"
import { existsSync } from "node:fs";
import { updateTramProgress } from "../../utils/dataUtils";

type QueryParams = {
	active: boolean; // return only currently active trams
	line: string; // return only trams belonging to line (route_name)
	station: number; // return only trams with stops at station (diva_id)
	static: boolean; // dont add delays, much faster because no rt fetch
	time: number; // return trams at this time (ms timestamp)
	timeOffset: number; // return trams with time offset by this (ms timestamp, -3600000 = one hour ago)
};

type ResponseData = Tram[] | string;

const updateCount = 4; // number of past updates to average
let updateIndex = 0;

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	let query: QueryParams = {
		active: req.query.active === "true" || false,
		line: (req.query.line && req.query.line.toString()) || "",
		station: Number(req.query.station) || 0,
		static: req.query.static === "true" || false,
		time: Number(req.query.time) || 0,
		timeOffset: Number(req.query.timeOffset) || 0,
	};

	let time = query.time || new Date().getTime();
	time += query.timeOffset;

	// todo: aaaaa night trams only work until 1 hour past midnight??????
	let today = new Date(time);

	let tramTrips: TramTrip[] = [];
	let date = getDatestring(today);

	if (today.getUTCHours() == 23) {
		date = getDatestring(new Date(today.getTime() + 3600000)); // (?)
	}
	if (today.getUTCHours() < 2) {
		today.setUTCHours(-24, 0, 0, 0);
	}
	today.setUTCHours(0, 0, 0, 0); // midnight UTC

	if (existsSync(`data/parsed/tramTrips_${date}.json`)) {
		tramTrips = JSON.parse(await fs.readFile(`data/parsed/tramTrips_${date}.json`, "utf-8"));
	} else {
		console.log(`no baked trips for ${date}`)
		await parseData(false);
		if (existsSync(`data/parsed/tramTrips_${date}.json`)) {
			tramTrips = JSON.parse(await fs.readFile(`data/parsed/tramTrips_${date}.json`, "utf-8"));
		} else {
			await parseData(true);
			if (existsSync(`data/parsed/tramTrips_${date}.json`)) {
				tramTrips = JSON.parse(await fs.readFile(`data/parsed/tramTrips_${date}.json`, "utf-8"));
			}
		}
	}

	let realtime: any = query.static ? {"entity": []} : null;

	// check for recent cached rt
	if (!realtime) {
		if (existsSync("data/gtfs/realtime.json")) {
			let cachedRealtime = JSON.parse(await fs.readFile("data/gtfs/realtime.json", "utf-8"));
			if (cachedRealtime.time && Math.abs(time - cachedRealtime.time) < 10 * 1000) {
				console.log("using cached rt");
				realtime = cachedRealtime.data;
			}
		}
	}

	// get fresh rt
	if (!realtime) {
		try {
			console.log("getting fresh rt");
			let gtfs_realtime = fetch(ENDPOINT_RT, {
				headers: {
					Authorization: KEY_RT,
					"Accept-Encoding": "gzip, deflate",
				},
				signal: AbortSignal.timeout(30 * 1000),
			}).then((res) => res.json());
			realtime = await gtfs_realtime;

			if (realtime && !realtime?.error) {
				let tripIds: Set<string> = new Set(tramTrips.map((t) => t.trip_id));
				let rt = {"entity": realtime["entity"].filter((e) => tripIds.has(e["id"]))};
				await fs.writeFile("data/gtfs/realtime.json", JSON.stringify({"time": time, "data": rt}));
			}
		} catch(e) {
			console.log("rt timed out: ", realtime, e);
			realtime = null;
		}
	}
	
	// recover from rate limit
	if (!realtime || realtime.error) {
		console.log("rt failed: ", realtime)
		if (existsSync("data/gtfs/realtime.json")) {
			let cachedRealtime = JSON.parse(await fs.readFile("data/gtfs/realtime.json", "utf-8"));
			realtime = cachedRealtime.data;

			// one more for good measure
			if (!realtime) {
				realtime = {"entity": []};
				await fs.rm("data/gtfs/realtime.json"); // get rid of broken file
			}
		} else {
			realtime = {"entity": []};
		}
	}

	let tripIds: Set<string> = new Set(tramTrips.map((t) => t.trip_id));
	let tripUpdates: TripUpdate[] = realtime["entity"].filter((e) => tripIds.has(e["id"])).map((t) => {
		return {
			trip_id: t["tripUpdate"]["trip"]["tripId"],
			trip_time: t["tripUpdate"]["trip"]["startTime"],
			trip_date: t["tripUpdate"]["trip"]["startDate"],
			trip_status: String(t["tripUpdate"]["trip"]["scheduleRelationship"] || "scheduled").toLowerCase(),
			stops: t["tripUpdate"]["stopTimeUpdate"]?.map((u) => {
				return {
					stop_id: u["stopId"],
					stop_sequence: u["stopSequence"],
					stop_status: String(u["scheduleRelationship"] || "scheduled").toLowerCase(),
					arrival_delay: u["arrival"] ? u["arrival"]["delay"] : 0,
					departure_delay: u["departure"] ? u["departure"]["delay"] : 0,
				};
			}),
		};
	});
	let tripUpdatesMap: Map<string, TripUpdate> = new Map();
	tripUpdates.map((u) => {
		tripUpdatesMap.set(u.trip_id, u);
	});

	// avg updates
	let pastUpdates: Map<string, TripUpdate>[] = [];
	for (let i=0; i<updateCount; i++) {
		if (existsSync(`data/parsed/pastUpdates${i}.json`)) {
			let {time, update} = JSON.parse(await fs.readFile(`data/parsed/pastUpdates${i}.json`, "utf-8"))
			if (new Date().getTime() - time < 30000) { // only valid if less than 30s old
				pastUpdates.push(new Map(update));
			}
		}
	}

	updateIndex = (updateIndex+1) % updateCount;
	await fs.writeFile(`data/parsed/pastUpdates${updateIndex}.json`, JSON.stringify({time: new Date().getTime(), update: Array.from(tripUpdatesMap.entries())}));

	tripUpdatesMap.forEach((v, k) => {
		if (!v.stops) {
			return;
		}
		for (let stop of v.stops) {
			let count = 1;
			for (let pastUpdate of pastUpdates) {
				let found = pastUpdate.get(k)?.stops?.find((s) => s.stop_id == stop.stop_id);
				if (found) {
					count++;
					stop.arrival_delay += found.arrival_delay;
					stop.departure_delay += found.departure_delay;
				}
			}
			stop.arrival_delay /= count;
			stop.departure_delay /= count;
		}
	});


	let stations: Station[] = JSON.parse(await fs.readFile("data/parsed/stations.json", "utf-8"));
	let stationsMap: Map<number, Station> = new Map();
	stations.map((s) => {
		stationsMap.set(s.id, s);
	});

	let trams: Tram[] = tramTrips.map((t) => {
		let update: TripUpdate = tripUpdatesMap.get(t.trip_id);
		return {
			trip_id: t.trip_id,
			trip_name: t.trip_name,
			trip_status: update?.trip_status || "scheduled",
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
				let station: Station | undefined = stationsMap.get(Number(s.stop_id.split(":")[0]));
				let u = update?.stops?.find((us) => us.stop_id == s.stop_id);
				let offset = 2 * 3600000; // todo: switch to cest automatically
				return {
					stop_id: s.stop_id,
					stop_diva: station?.diva || 0,
					stop_name: station?.name || "not in dataset",
					stop_sequence: s.stop_sequence,
					stop_status: u?.stop_status || "scheduled",
					arrival: today.getTime() + s.arrival - offset, // convert to CET
					departure: today.getTime() + s.departure - offset,
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
			if (s.pred_departure <= s.pred_arrival && s.stop_status != "skipped") {
				// if (s.stop_sequence != 0 && s.stop_sequence != t.stops.length) {
				// 	s.pred_departure = s.pred_arrival + 1; // add 1 to indicate modified
				// }
			}
			if (ns && s.pred_departure >= ns.pred_arrival && ns.stop_status != "skipped") { // try to interpolate inner stop times from 10% - 90%
				s.pred_departure = (s.pred_arrival*9 + ns.pred_departure*1) / 10 + 1;
				ns.pred_arrival = (s.pred_arrival*1 + ns.pred_departure*9) / 10 + 1;
			}
			return s;
		});

		if (time >= t.stops[0].pred_arrival && time <= t.stops[t.stops.length-1].pred_departure) {
			t.active = true;
		}

		return t;
	});

	updateTramProgress(trams, time);

	trams = trams.map((t) => {
        let prev_stop = t.stops.find((s) => s.stop_sequence == Math.floor(t.progress));
        let next_stop = t.stops.find((s) => s.stop_sequence == Math.floor(t.progress + 1));
		if (next_stop) {
			t.delay = next_stop.arrival_delay;
		} else if (prev_stop) {
			t.delay = prev_stop.departure_delay;
		}
		return t;
	});


	if (query.active) {
		trams = trams.filter((t) => t.active);
		trams = trams.filter((t) => t.trip_status != "canceled" && t.trip_status != "deleted")
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

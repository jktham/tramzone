import {getTramLocation} from "./mapUtils";
import {Station, Line, Tram, Disruption, Filter} from "./types";

export function getStationData(data: Station[]) {
	let geoJson = {type: "FeatureCollection", features: []};
	let additionalContent = {type: "station"};
	for (let station of data) {
		let feature = {
			type: "Feature",
			geometry: {type: "Point", coordinates: station.coords},
			properties: {...station, ...additionalContent},
		};
		geoJson.features.push(feature);
	}
	return geoJson;
};

export function getLineData(data: Line[]) {
	let geoJSON = {type: "FeatureCollection", features: []};
	for (let line of data) {
		for (let segment of line.segments) {
			let additionalContent = {type: "line"};
			let feature = {
				type: "Feature",
				geometry: segment.geometry,
				properties: {...line, ...additionalContent},
			};
			geoJSON.features.push(feature);
		}
	}
	return geoJSON;
};

export function getTramData(data: Tram[], lineData: Line[]) {
	let geoJSON = {type: "FeatureCollection", features: []};
	for (let tram of data) {
		let additionalContent = {type: "tram", color: lineData.find((l) => l.name == tram.route_name)?.color, name: tram.route_name}
		let feature = {
			type: "Feature",
			geometry: {
				type: "Point",
				coordinates: getTramLocation(tram, lineData),
			},
			properties: {...tram, ...additionalContent},
		};
		geoJSON.features.push(feature);
	}
	return geoJSON;
};

// let jumpCount = 0;
// todo: figure out how to actually smooth out sudden delay changes, just prevents backwards jumps for now
export function updateTramProgressInterpolated(trams: Tram[], prevTrams: Tram[], time: number): Tram[] {
	trams = updateTramProgress(trams, time);
	if (!prevTrams) {
		return trams;
	}
	let prevTramsMap: Map<string, Tram> = new Map();
	prevTrams.map((t) => {
		prevTramsMap.set(t.trip_name, t);
	});
	for (let tram of trams) {
		let prev = prevTramsMap.get(tram.trip_name);
		if (prev) {
			// if (Math.abs(prev.progress - tram.progress) > 0.2) {
			// 	console.warn("tram jumped: ", jumpCount++, prev.progress - tram.progress, tram, prev)
			// }
			tram.progress = Math.max(prev.progress, tram.progress); // dejumpinate
		}
	}
	return trams;
}

export function updateTramProgress(trams: Tram[], time: number): Tram[] {
	for (let tram of trams) {
		tram.progress = 0;
		// sequence progress
		tram.stops = tram.stops.map((s) => {
			s.arrived = s.pred_arrival <= time;
			s.departed = s.pred_departure <= time;

			if (s.arrived) {
				tram.progress = Math.max(tram.progress, s.stop_sequence);
			}
			return s;
		});
		// segment progress
		let prev_stop = tram.stops.find((s) => s.stop_sequence == Math.floor(tram.progress));
		let next_stop = tram.stops.find((s) => s.stop_sequence == Math.floor(tram.progress + 1));
		if (prev_stop && next_stop) {
			if (prev_stop.departed) {
				let p = prev_stop.pred_departure;
				let n = next_stop.pred_arrival;
				let frac = (time - p) / (n - p);
				tram.progress += frac;
			}
		}
	}
	return trams;
}

export function getDisruptions(trams: Tram[]): Disruption[] {
	let disruptions: Disruption[] = [];
	for (let t of trams) {
		if (t.trip_status != "scheduled") {
			disruptions.push({
				tram: t,
				stop: undefined,
				message: `Tram ${t.route_name} ${t.trip_name} is ${t.trip_status}`
			});
		}
		for (let s of t.stops) {
			if (s.stop_status != "scheduled") {
				disruptions.push({
					tram: t,
					stop: s,
					message: `Stop "${s.stop_name}" of tram ${t.route_name} ${t.trip_name} is ${s.stop_status}`
				});
			}
		}
	}
	return disruptions
}

export function getAverageDelay(trams: Tram[]): number {
	let sum = 0;
	let count = 0;
	for (let t of trams) {
		if (Math.abs(t.delay) < 86400) { // ignore completely lost trams lol
			sum += Math.abs(t.delay);
			count++;
		}
	}
	return sum / count;
}

export function containedInFilter<T>(object : T, filter : Filter<T>): boolean {
	return filter === "ALL" || filter === object || filter instanceof Array && filter.includes(object);
}
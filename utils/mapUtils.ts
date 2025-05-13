import {Tram, Line, Filter, Segment} from "./types";
import Style from "ol/style/Style";
import {Circle, Fill, Stroke} from "ol/style";
import {Feature} from "ol";
import * as Extent from "ol/extent";
import * as OlProj from "ol/proj";
import {Coordinate} from "ol/coordinate";
import {containedInFilter} from "./dataUtils";
import {FeatureLike} from "ol/Feature";

export function grayscaleLayer(context) {
	let canvas = context.canvas;
	let width = canvas.width;
	let height = canvas.height;
	let imageData = context.getImageData(0, 0, width, height);
	let data = imageData.data;
	for (let i = 0; i < data.length; i += 4) {
		let r = data[i];
		let g = data[i + 1];
		let b = data[i + 2];
		// CIE luminance for the RGB
		let v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		// Show white color instead of black color while loading new tiles:
		if (v === 0.0) v = 255.0;
		v = 255 - (255 - v) * 0.6;
		data[i] = v; // Red
		data[i + 1] = v; // Green
		data[i + 2] = v; // Blue
		data[i + 3] = 255; // Alpha
	}
	context.putImageData(imageData, 0, 0);
}

export function convertLV95toWGS84(coords) {
	let x1 = (coords[1] - 1200000) / 1000000;
	let y1 = (coords[0] - 2600000) / 1000000;
	let eastCoord1 =
		2.6779094 +
		4.728982 * y1 +
		0.791484 * y1 * x1 +
		0.1306 * y1 * x1 ** 2 -
		0.0436 * y1 ** 3;
	let northCoord1 =
		16.9023892 +
		3.238272 * x1 -
		0.270978 * y1 ** 2 -
		0.002528 * x1 ** 2 -
		0.0447 * y1 ** 2 * x1 -
		0.014 * x1 ** 3;
	let eastCoord = (eastCoord1 * 100) / 36;
	let northCoord = (northCoord1 * 100) / 36;
	return [eastCoord, northCoord];
}

// todo: CLEANUP! & select correct service (not just [0])
export function getTramLocation(tram: Tram, lines: Line[]) {

	let debugInfo = `(${tram.route_name} : ${tram.trip_name})`

	let prev_stop = tram.stops.find((s) => s.stop_sequence == Math.floor(tram.progress));
	let next_stop = tram.stops.find((s) => s.stop_sequence == Math.floor(tram.progress + 1));

	// current line
	let segments = lines.find((l) => l.name == tram.route_name)?.services[0]?.segments;
	let current_segment = segments?.find((s) => s.from == prev_stop?.stop_diva && s.to == next_stop?.stop_diva);

	if (!next_stop) { // last stop?
		let try_prev = segments?.find((s) => s.from == prev_stop?.stop_diva)?.geometry.coordinates[0];
		if (try_prev) {
			return try_prev;
		}
	}

	// TODO: ugly temp forchbahn limbo solution
	if (!current_segment && segments && prev_stop && next_stop) { // try skipping stop using sequence numbers
		const MAX_SKIPPED = 5;
		let startSegments = segments.filter((s) => s.from == prev_stop?.stop_diva);
		let count = null;
		startSegments.forEach(s => {
			let candidate = [s]
			for (let i = 0; i < MAX_SKIPPED; i++) {
				let nextSegment = segments.find(s => s.from === candidate[0].to && s.sequence === candidate[0].sequence + 1);
				if (!nextSegment) break; // failed
				candidate.unshift(nextSegment)
				if (candidate[0].to === next_stop?.stop_diva) { // found goal
					if (count && count < candidate.length) break; // more direct solution exists
					count = candidate.length;
					current_segment = combineSegments(candidate.reverse())
				}
			}
		})
		//if (current_segment) console.log(`${debugInfo} is skipping ${count - 1} stop${count > 2 ? "s" : ""} between ${prev_stop?.stop_name} and ${next_stop?.stop_name}`)
	}

	if (!current_segment) { // any line
		segments = lines.flatMap((l) => l.services[0].segments);
		current_segment = segments?.find((s) => s.from == prev_stop?.stop_diva && s.to == next_stop?.stop_diva);
	}

	if (!next_stop) { // last stop any line
		let try_prev = segments?.find((s) => s.from == prev_stop?.stop_diva)?.geometry.coordinates[0];
		if (try_prev) {
			return try_prev;
		}
	}

	if (!current_segment) { // give up, use prev station
		console.warn(`${debugInfo} missing line segment from ${prev_stop?.stop_diva} to ${next_stop?.stop_diva}`, prev_stop, next_stop);
		let try_prev = segments?.find((s) => s.from == prev_stop?.stop_diva)?.geometry.coordinates[0];
		return try_prev || [0, 0]; // haha null island tram
	}

	let total_length = 0;
	let subsegments = [];
	for (let i = 0; i < current_segment.geometry.coordinates.length - 1; i++) {
		let a = current_segment.geometry.coordinates[i];
		let b = current_segment.geometry.coordinates[i + 1];
		let l = Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);

		subsegments.push({
			a: a,
			b: b,
			length: l,
			start: total_length,
			end: total_length + l,
		});
		total_length += l;
	}

	for (let s of subsegments) {
		s.p_start = s.start / total_length;
		s.p_end = s.end / total_length;
	}

	let p = tram.progress % 1;
	for (let s of subsegments) {
		if (p >= s.p_start && p < s.p_end) {
			let p_dist = p - s.p_start;
			let p_scaled = p_dist / (s.p_end - s.p_start);

			let coords = [
				s.a[0] * (1 - p_scaled) + s.b[0] * p_scaled,
				s.a[1] * (1 - p_scaled) + s.b[1] * p_scaled,
			];
			return coords;
		}
	}

	console.warn("couldnt find tram location", tram);
	let try_prev = segments.find((s) => s.from == prev_stop?.stop_diva)?.geometry.coordinates[0];
	return try_prev || [0, 0];
}

function combineSegments(segments: Segment[]) : Segment {
	if (!segments || segments.length === 0) return null;

	let segment : Segment = {
		from: segments[0].from,
		to: segments[0].to,
		direction: segments[0].direction,
		sequence: segments[0].sequence,
		geometry: {
			type: segments[0].geometry.type,
			coordinates: segments[0].geometry.coordinates,
		}
	}

	for (let i = 1; i < segments.length; i++) {
		let coordinates = segments[i].geometry.coordinates.slice();
		if (segment.geometry.coordinates[segment.geometry.coordinates.length - 1] == coordinates[0]) {
			coordinates.shift()
		}
		segment.geometry.coordinates = segment.geometry.coordinates.concat(coordinates)
		segment.to = segments[i].to
	}

	return segment;
}

export function userInZurich(userLocation : Coordinate) {
	return Extent.containsCoordinate(OlProj.fromLonLat([8.5417-0.15, 47.3769-0.08]).concat(OlProj.fromLonLat([8.5417+0.15, 47.3769+0.08])), userLocation)
}

// STYLES

export const tramStyle = (filter : Filter<string>)=> (feature: Feature) => containedInFilter(feature.getProperties().name, filter) ? [
	new Style({
		image: new Circle({
			radius: 8,
			fill: new Fill({
				color: feature.get("color"),
			}),
			stroke: new Stroke({
				width: 3,
				color: getComputedStyle(document.documentElement).getPropertyValue('--BG2')
			})
		})
	}),
	new Style({
		image: new Circle({
			radius: 20,
			fill: new Fill({
				color: "transparent"
			}),
		}),
	}),
] : []

export const stationStyle = (filter : Filter<string>)=> (feature: Feature) => containedInFilter(feature.getProperties().name, filter) ? [
	new Style({
		image: new Circle({
			radius: 5,
			fill: new Fill({
				color: getComputedStyle(document.documentElement).getPropertyValue('--BG2')
			}),
			stroke: new Stroke({
				width: 3,
				color: getComputedStyle(document.documentElement).getPropertyValue('--FG2')
			})
		})
	}),
	new Style({
		image: new Circle({
			radius: 20,
			fill: new Fill({
				color: "transparent"
			}),
		})
	})
] : []

export const lineStyle = (filter : Filter<string>, focus : FeatureLike)=> (feature: Feature) => {

	return containedInFilter(feature.getProperties().name, filter) ? ((feature === focus) ? [
		new Style({
			stroke: new Stroke({
				width: 9,
				color: getComputedStyle(document.documentElement).getPropertyValue('--BG4'),
			}),
		}),
		new Style({
			stroke: new Stroke({
				width: 3,
				color: feature.get("color"),
			}),
		}),

		new Style({
			stroke: new Stroke({
				width: 10,
				color: "transparent",
			}),
		})
	] : [
		new Style({
			stroke: new Stroke({
				width: 3,
				color: feature.get("color"),
			}),
		}),
		new Style({
			stroke: new Stroke({
				width: 10,
				color: "transparent",
			}),
		})
	]) : []
}

export const locationStyle = (feature: Feature) => [
	new Style({
		image: new Circle({
			radius: 6.5,
			fill: new Fill({
				color: "rgba(45,110,133,1)",
			})
		})
	}),
	new Style({
		image: new Circle({
			radius: 19.5,
			fill: new Fill({
				color: "rgba(45,110,133,0.3)",
			})
		})
	})
]
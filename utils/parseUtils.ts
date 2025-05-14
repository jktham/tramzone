import { promises as fs, createReadStream, createWriteStream, existsSync } from "node:fs";
import stream from "node:stream";
import unzipper from "unzipper";
let shapefile = require("shapefile");
import csv from "csv-parser";
import readline from "node:readline";
import { convertLV95toWGS84 } from "./mapUtils";
import {Route, Trip, StopTime, Service, ServiceException, Station, Line, Segment, TramTrip, Tram, TripStatus, StopStatus, HistStop} from "./types";
import {Extent} from "ol/extent";
let AsyncLock = require("async-lock");

export const KEY_RT = process.env.KEY_RT || "57c5dbbbf1fe4d000100001842c323fa9ff44fbba0b9b925f0c052d1"; // public default key dw
export const KEY_SA = process.env.KEY_SA;

export const ENDPOINT_GTFS = "https://data.opentransportdata.swiss/dataset/timetable-2026-gtfs2020/permalink";
export const ENDPOINT_HIST = "https://data.opentransportdata.swiss/en/dataset/istdaten";
export const ENDPOINT_RT = "https://api.opentransportdata.swiss/la/gtfs-rt?format=JSON";
export const ENDPOINT_SA = "https://api.opentransportdata.swiss/la/gtfs-sa?format=JSON";

async function getUpdateDate() {
	// new gtfs data every monday and thursday (static at 10:00, rt at 15:00)
	let updateTime = new Date();
	updateTime.setHours(15, 0, 0, 0);

	let monday = new Date();
	monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
	let thursday = new Date();
	thursday.setDate(thursday.getDate() - ((thursday.getDay() + 3) % 7));

	if (monday.getDate() == updateTime.getDate() && monday.getTime() < updateTime.getTime()) {
		monday.setDate(monday.getDate() - 7);
	}
	if (thursday.getDate() == updateTime.getDate() && thursday.getTime() < updateTime.getTime()) {
		thursday.setDate(thursday.getDate() - 7);
	}

	let date = new Date(Math.max(monday.getTime(), thursday.getTime()));
	let dateString = `${date.getFullYear()}-${("0" + (date.getMonth()+1)).slice(-2)}-${("0" + date.getDate()).slice(-2)}`;
	return dateString;
}

function getTimeFromString(timeString: string) {
	let h = Number(timeString?.split(":")[0] || "0");
	let m = Number(timeString?.split(":")[1] || "0");
	let s = Number(timeString?.split(":")[2] || "0");

	let date = new Date(0);
	date.setUTCHours(h, m, s, 0); // no idea what timezone this should be
	return date.getTime();
}

function getDateFromString(dateString: string) {
	let y = Number(dateString.slice(0, 4));
	let m = Number(dateString.slice(4, 6));
	let d = Number(dateString.slice(6, 8));

	let date = new Date(0);
	date.setUTCFullYear(y, m-1, d); // todo: check this is actually correct
	date.setUTCHours(0, 0, 0, 0); // midnight UTC
	return date.getTime();
}

async function parseCSV(path: string) {
	let csv = await fs.readFile(path);
	let raw = [];
	for (let line of csv.toString().split("\r\n")) {
		let r = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
		raw.push(r);
	}
	raw.shift(); // column names
	return raw;
}

async function parseStations() {
	console.log("parsing dataset stations");

	let stationsRaw = await parseCSV("data/datasets/stations.csv");
	let stations: Station[] = stationsRaw.map((s) => {
		return {
			id: Number(s[0]),
			diva: Number(s[1]),
			name: s[4]?.replace(/['"]+/g, ""),
			type: s[6]?.replace(/['"]+/g, ""),
			lines: s[13]?.replace(/['"]+/g, ""),
			coords: convertLV95toWGS84([Number(s[14]), Number(s[15])]),
		};
	});
	stations = stations.filter((s) => s.type && (s.type.toLowerCase().includes("tram") || s.type.toLowerCase().includes("s-bahn") && s.lines && s.lines.toLowerCase().includes("s18")));

	let ignoredStations = JSON.parse(await fs.readFile(`data/datasets/ignoredStations.json`, "utf-8"));
	stations = stations.filter((s) => !ignoredStations.includes(s.id));

	await fs.writeFile("data/parsed/stations.json", JSON.stringify(stations));
}

async function parseLines() {
	console.log("parsing dataset lines");

	let lineColors = JSON.parse(await fs.readFile(`data/datasets/lineColors.json`, "utf-8"));
	let geojson = await shapefile.read("data/datasets/lines.shp", "data/datasets/lines.dbf");

	let lines: Line[] = [];
	for (let feature of geojson.features) {
		if (["VBZ-Tram", "Forchbahn"].some(c => feature.properties["BETRIEBS00"]?.includes(c))) {

			// TODO: improve, temporary fix for now
			if (["12417_", "12419_"].some(id => feature.properties["LINIENSCHL"] === id)) continue;

			let segment: Segment = {
				from: feature.properties["VONHALTEST"],
				to: feature.properties["BISHALTEST"],
				direction: feature.properties["RICHTUNG"],
				sequence: feature.properties["SEQUENZNR"],
				geometry: feature.geometry,
			};
			segment.geometry.coordinates = segment.geometry.coordinates.map((c) => convertLV95toWGS84(c));

			let name = feature.properties["LINIENNUMM"].replace(/\D/g,'')

			let line = lines.find((l) => l.id === feature.properties["LINIENSCHL"]);
			if (!line) {
				line = {
					id: feature.properties["LINIENSCHL"],
					name: name,
					color: lineColors.find((l) => l.name == name)?.color || "#888888",
					start: feature.properties["ANFANGSHAL"],
					end: feature.properties["ENDHALTEST"],
					segments: [],
				}
				lines.push(line)
			}
			line.segments.push(segment);
		}
	}

	let lineSegmentOverrides = JSON.parse(await fs.readFile(`data/datasets/lineSegments.json`, "utf-8"));

	for (let override of lineSegmentOverrides) {
		let segments = lines.find(l => l.name == override.name).segments;
		let segment = segments.find((s) => s.from == override.segment.from && s.to == override.segment.to);
		if (segment) {
			segments[segments.indexOf(segment)] = override.segment;
		} else {
			segments.push(override.segment);
		}
	}

	lines.sort((a, b) => Number(a.id.replace("_", "")) - Number(b.id.replace("_", "")));
	for (let line of lines) {
		line.segments.sort((a, b) => a.sequence - b.sequence);
		line.segments.sort((a, b) => a.direction - b.direction);
	}

	let extraLine: Line = {
		id: "01099_",
		name: "E",
		color: lineColors.find((l) => l.name == "E")?.color || "#000000",
		start: "Extra",
		end: "Extra",
		segments: [],
	};
	lines.push(extraLine);
	
	await fs.writeFile("data/parsed/lines.json", JSON.stringify(lines));
}

async function getGtfs(date: string) {
	// get static data
	if (!(await fs.readdir("data/gtfs/")).includes(`${date}`)) {
		let old = await fs.readdir("data/gtfs/");
		for (let f of old) {
			await fs.rm(`data/gtfs/${f}`, {recursive: true, force: true});
		}

		console.log("getting new gtfs data: ", date);
		let gtfs_static = await fetch(ENDPOINT_GTFS); // oh wow the redirect actually works now
		// @ts-ignore: dumb error
		let str = stream.Readable.fromWeb(gtfs_static.body);

		await fs.writeFile(`data/gtfs/${date}.zip`, str);
		console.log("unzipping");
		await createReadStream(`data/gtfs/${date}.zip`).pipe(unzipper.Extract({path: `data/gtfs/${date}`})).promise();
		await fs.rm(`data/gtfs/${date}.zip`);
		console.log("done");
	} else {
		console.log("using old gtfs data: ", date);
	}

	// // get realtime data (test)
	// console.log("getting gtfs-rt data");
	// let gtfs_realtime = await fetch(ENDPOINT_RT, {
	// 	headers: {
	// 		Authorization: KEY_RT,
	// 		"Accept-Encoding": "gzip, deflate",
	// 	},
	// });
	// await fs.writeFile(`data/gtfs/realtime.json`, await gtfs_realtime.text());
}

async function parseRoutes(date: string) {
	console.log("parsing gtfs routes");
	let routesRaw = await parseCSV(`data/gtfs/${date}/routes.txt`);
	let routes: Route[] = routesRaw.map((r) => {
		return {
			route_id: r[0]?.replace(/['"]+/g, ""),
			name: r[2]?.replace(/['"]+/g, ""),
			type: r[5]?.replace(/['"]+/g, ""),
			agency: r[1]?.replace(/['"]+/g, ""),
		};
	});
	routes = routes.filter((s) => s.type == "900" && (s.agency == "3849" || s.agency == "46")); // VBZ-tram || forchbahn
	await fs.writeFile("data/parsed/routes.json", JSON.stringify(routes));
}

async function filterTrips(date: string) {
	console.log("filtering gtfs trips");

	let first = true;
	let routes: Route[] = JSON.parse(await fs.readFile("data/parsed/routes.json", "utf-8"));
	let routeIds = new Set(routes.map((r) => r.route_id));
	let writeStream = createWriteStream("data/parsed/tripsFiltered.csv");
	await new Promise<void>((resolve) => {
		let rd = readline.createInterface({
			input: createReadStream(`data/gtfs/${date}/trips.txt`),
			terminal: false,
		});

		rd.on("line", function (line) {
			let route_id = line.split(",")[0].replace(/['"]+/g, "");
			if (first || routeIds.has(route_id)) {
				writeStream.write(line + "\r\n"); // ew
			}
			first = false;
		});

		rd.on("close", function () {
			resolve();
		});
	});
}

async function parseTrips(date: string) {
	console.log("parsing gtfs trips");
	let tripsRaw = await parseCSV("data/parsed/tripsFiltered.csv");
	tripsRaw.pop(); // weird empty last line
	let trips: Trip[] = tripsRaw.map((t) => {
		return {
			trip_id: t[2]?.replace(/['"]+/g, ""),
			route_id: t[0]?.replace(/['"]+/g, ""),
			service_id: t[1]?.replace(/['"]+/g, ""),
			headsign: t[3]?.replace(/['"]+/g, ""),
			name: t[4]?.replace(/['"]+/g, ""),
			direction: Number(t[5]?.replace(/['"]+/g, "")),
		};
	});
	await fs.writeFile("data/parsed/trips.json", JSON.stringify(trips));
}

async function filterStopTimes(date: string) {
	console.log("filtering gtfs stop times");

	let first = true;
	let trips: Trip[] = JSON.parse(await fs.readFile("data/parsed/trips.json", "utf-8"));
	let tripIds = new Set(trips.map((t) => t.trip_id));
	let writeStream = createWriteStream("data/parsed/stopTimesFiltered.csv");
	await new Promise<void>((resolve) => {
		let rd = readline.createInterface({
			input: createReadStream(`data/gtfs/${date}/stop_times.txt`), // big ass file
			terminal: false,
		});

		rd.on("line", function (line) {
			let trip_id = line.split(",")[0].replace(/['"]+/g, "");
			if (first || tripIds.has(trip_id)) {
				writeStream.write(line + "\r\n");
			}
			first = false;
		});

		rd.on("close", function () {
			resolve();
		});
	});
}

async function parseStopTimes(date: string) {
	console.log("parsing gtfs stop times");

	let readStream = createReadStream("data/parsed/stopTimesFiltered.csv");
	let writeStream = createWriteStream("data/parsed/stopTimes.json");

	writeStream.on("drain", () => {
		readStream.resume();
	});
	writeStream.write("[");

	let sep = "";
	await new Promise<void>((resolve) => {
		readStream
		.pipe(csv())
		.on("data", (row) => {
			let station: StopTime = {
				trip_id: String(Object.values(row)[0])?.replace(/['"]+/g, ""), // for some reason using the key doesnt work
				arrival: getTimeFromString(row["arrival_time"]?.replace(/['"]+/g, "")),
				departure: getTimeFromString(row["departure_time"]?.replace(/['"]+/g, "")),
				stop_id: row["stop_id"]?.replace(/['"]+/g, ""),
				stop_sequence: Number(row["stop_sequence"]?.replace(/['"]+/g, "")),
			};
			if (!writeStream.write(sep + JSON.stringify(station))) {
				readStream.pause();
			}
			sep = ",";
		})
		.on("end", () => {
			resolve();
		});
	});
	writeStream.write("]");
}

async function parseServices(date: string) {
	console.log("parsing gtfs services");

	let servicesRaw = await parseCSV(`data/gtfs/${date}/calendar.txt`);
	if (!servicesRaw[servicesRaw.length-1][0]) {
		servicesRaw.pop(); // trailing newline sometimes?
	}
	let services: Service[] = servicesRaw.map((s) => {
		return {
			service_id: s[0]?.replace(/['"]+/g, ""),
			days: [
				Number(s[1]?.replace(/['"]+/g, "")),
				Number(s[2]?.replace(/['"]+/g, "")),
				Number(s[3]?.replace(/['"]+/g, "")),
				Number(s[4]?.replace(/['"]+/g, "")),
				Number(s[5]?.replace(/['"]+/g, "")),
				Number(s[6]?.replace(/['"]+/g, "")),
				Number(s[7]?.replace(/['"]+/g, "")),
			],
			start: getDateFromString(s[8]?.replace(/['"]+/g, "")),
			end: getDateFromString(s[9]?.replace(/['"]+/g, "")),
		};
	});
	await fs.writeFile("data/parsed/services.json", JSON.stringify(services));
}

async function filterServiceExceptions(date: string) {
	console.log("filtering gtfs service exceptions");

	let first = true;
	let trips: Trip[] = JSON.parse(await fs.readFile("data/parsed/trips.json", "utf-8"));
	let serviceIds = new Set(trips.map((t) => t.service_id));
	let writeStream = createWriteStream("data/parsed/serviceExceptionsFiltered.csv");
	await new Promise<void>((resolve) => {
		let rd = readline.createInterface({
			input: createReadStream(`data/gtfs/${date}/calendar_dates.txt`),
			terminal: false,
		});

		rd.on("line", function (line) {
			let service_id = line.split(",")[0].replace(/['"]+/g, "");
			if (first || serviceIds.has(service_id)) {
				writeStream.write(line + "\r\n");
			}
			first = false;
		});

		rd.on("close", function () {
			resolve();
		});
	});
}

async function parseServiceExceptions(date: string) {
	console.log("parsing gtfs service exceptions")
	let readStream = createReadStream("data/parsed/serviceExceptionsFiltered.csv");
	let writeStream = createWriteStream("data/parsed/serviceExceptions.json");

	writeStream.on("drain", () => {
		readStream.resume();
	});
	writeStream.write("[");

	let sep = "";
	await new Promise<void>((resolve) => {
		readStream
		.pipe(csv())
		.on("data", (row) => {
			let serviceException: ServiceException = {
				service_id: String(Object.values(row)[0])?.replace(/['"]+/g, ""),
				date: getDateFromString(row["date"]?.replace(/['"]+/g, "")),
				type: Number(row["exception_type"]?.replace(/['"]+/g, "")),
			};
			if (!writeStream.write(sep + JSON.stringify(serviceException))) {
				readStream.pause();
			}
			sep = ",";
		})
		.on("end", () => {
			resolve();
		});
	});
	writeStream.write("]");
}

async function mapStopTimes() {
	console.log("mapping stop times");
	
	let stopTimes: StopTime[] = JSON.parse(await fs.readFile(`data/parsed/stopTimes.json`, "utf-8"));

	let stopTimesMap: Map<string, StopTime[]> = new Map();
	stopTimes.map((s) => {
		if (stopTimesMap.has(s.trip_id)) {
			stopTimesMap.set(s.trip_id, [s, ...stopTimesMap.get(s.trip_id)]);
		} else {
			stopTimesMap.set(s.trip_id, [s]);
		}
	});
	stopTimesMap.forEach((v, k) => {
		stopTimesMap.set(k, v.sort((a, b) => a.stop_sequence - b.stop_sequence));
	});

	await fs.writeFile(`data/parsed/stopTimesMap.json`, JSON.stringify(Array.from(stopTimesMap.entries())));
}

async function generateTramTrips() {
	console.log("generating tram trips");

	let routes: Route[] = JSON.parse(await fs.readFile("data/parsed/routes.json", "utf-8"));
	let trips: Trip[] = JSON.parse(await fs.readFile("data/parsed/trips.json", "utf-8"));
	let services: Service[] = JSON.parse(await fs.readFile("data/parsed/services.json", "utf-8"));

	let servicesMap: Map<string, number[]> = new Map();
	services.map((s) => {
		servicesMap.set(s.service_id, s.days);
	});

	let stopTimesMap: Map<string, StopTime[]> = new Map(JSON.parse(await fs.readFile(`data/parsed/stopTimesMap.json`, "utf-8")));

	// todo: aaaa
	let tramTrips: TramTrip[] = trips.map((t) => {
		let r: Route = routes.find((r) => r.route_id == t.route_id);
		let s: StopTime[] = stopTimesMap.get(t.trip_id);
		return {
			trip_id: t.trip_id,
			trip_name: t.name,
			headsign: t.headsign,
			direction: t.direction,
			route_id: r.route_id,
			route_name: r.name,
			service_id: t.service_id,
			service_days: servicesMap.get(t.service_id),
			stops: s.map((s) => {
				return {
					stop_id: s.stop_id,
					stop_sequence: s.stop_sequence,
					arrival: s.arrival,
					departure: s.departure,
				};
			}),
		};
	})
	.filter((t) => t != null)
	.sort((a, b) => a.direction - b.direction)
	.sort((a, b) => a.trip_id.localeCompare(b.trip_id))

	await fs.writeFile(`data/parsed/tramTrips.json`, JSON.stringify(tramTrips));
}

export function getDatestring(date: Date) {
	return `${date.getUTCFullYear()}-${("0" + (date.getUTCMonth()+1)).slice(-2)}-${("0" + date.getUTCDate()).slice(-2)}`;
}

async function bakeTramTrips() {
	console.log("baking tram trips")

	let today = new Date();
	today.setUTCHours(0, 0, 0, 0);

	let tramTrips: TramTrip[] = JSON.parse(await fs.readFile("data/parsed/tramTrips.json", "utf-8"));
	let services: Service[] = JSON.parse(await fs.readFile(`data/parsed/services.json`, "utf-8"));
	let serviceExceptions: ServiceException[] = JSON.parse(await fs.readFile(`data/parsed/serviceExceptions.json`, "utf-8"));

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

	for (let i=0; i<5; i++) {
		let date = getDatestring(today);
		let weekday = (today.getUTCDay() + 6) % 7;

		let tramTripsToday = tramTrips.filter((t) => {
			let exceptions = exceptionsMap.get(t.service_id);
			if (exceptions) {
				for (let e of exceptions) {
					if (today.getTime() == e.date && e.type == 2) {
						return false;
					}
					if (today.getTime() == e.date && e.type == 1) { // this actually works now yay
						return true;
					}
				}
			}

			let service = servicesMap.get(t.service_id);
			let offset = 0
			for (let s of t.stops) { // todo: keep overlap on both days
				if (s.arrival >= 86400000 || s.departure >= 86400000) { // only supports next day for now
					offset = -1;
					// s.arrival = s.arrival -= 86400000;
					// s.departure = s.departure -= 86400000;
				}
			}
			if (today.getTime() >= service.start && today.getTime() <= service.end) { // does not consider offset but eh
				return t.service_days[(weekday + offset + 7) % 7] == 1;
			}
			return false;
		});

		await fs.writeFile(`data/parsed/tramTrips_${date}.json`, JSON.stringify(tramTripsToday));

		today.setDate(today.getDate()+1);
	}

}

const version = 3;
let lock = new AsyncLock();
export async function parseData(force: boolean) {
	// console.log("acquiring parse lock")
	await lock.acquire("parseKey", async () => { // prevent interleaved parsing caused by simultaneous api calls
		if (force || !existsSync("data/parsed/lastUpdate.json") || (await fs.readFile("data/parsed/lastUpdate.json", "utf-8")) != JSON.stringify({date: await getUpdateDate(), version: version})) {
			let t0 = new Date().getTime();
			console.log("parsing data");
	
			if (!existsSync("data/gtfs/")) {
				await fs.mkdir("data/gtfs/");
			}
			if (!existsSync("data/parsed/")) {
				await fs.mkdir("data/parsed/");
			}

			let old = await fs.readdir("data/parsed/");
			for (let f of old) {
				await fs.rm(`data/parsed/${f}`, {recursive: true, force: true});
			}
		
			let date = await getUpdateDate();

			await parseLines();
			await parseStations();
			await getGtfs(date);
			await parseRoutes(date);
			await filterTrips(date);
			await parseTrips(date);
			await filterStopTimes(date);
			await parseStopTimes(date);
			await parseServices(date);
			await filterServiceExceptions(date);
			await parseServiceExceptions(date);
			await mapStopTimes();
			await generateTramTrips();
			await bakeTramTrips();
		
			await fs.writeFile(`data/parsed/lastUpdate.json`, JSON.stringify({date: await getUpdateDate(), version: version}));
		
			let t1 = new Date().getTime();
			console.log(`done, ${(t1 - t0) / 1000}s`);
		}
	});
	// console.log("releasing parse lock")
}


function getDateTimeFromStringHist(dateTimeString: string) {
	if (!dateTimeString || dateTimeString == "") {
		return 0;
	}
	let dateString = dateTimeString?.split(" ")[0];
	let timeString = dateTimeString?.split(" ")[1];

	let y = Number(dateString?.slice(6, 10));
	let M = Number(dateString?.slice(3, 5));
	let d = Number(dateString?.slice(0, 2));

	let h = Number(timeString?.split(":")[0] || "0");
	let m = Number(timeString?.split(":")[1] || "0");
	let s = Number(timeString?.split(":")[2] || "0");

	let date = new Date(0);
	date.setUTCFullYear(y, M-1, d);
	date.setUTCHours(h, m, s, 0); // no idea what timezone this should be
	return date.getTime();
}

export async function getHist(date: string) {
	console.log("getting historical data: ", date);
	let hist = await fetch(`${ENDPOINT_HIST}/resource_permalink/${date}_istdaten.csv`);
	// @ts-ignore: dumb error
	let str = stream.Readable.fromWeb(hist.body);
	await fs.writeFile(`data/hist/${date}.csv`, str);
	console.log("done");
}

export async function parseHist(date: string) {
	console.log("parsing historical data: ", date);

	let histStops = [];
	let first = true;
	await new Promise<void>((resolve) => {
		let rd = readline.createInterface({
			input: createReadStream(`data/hist/${date}.csv`),
			terminal: false,
		});

		rd.on("line", function (line) {
			if (first) {
				first = false;
				return;
			}

			let row = line.split(";");
			if (row[5] == "Tram" && row[2] == "85:3849") {
				let histStop: HistStop = {
					trip_id: row[1],
					route_id: row[6].trim(),
					route_name: row[7],
					trip_name: row[8],
					added: row[10] == "true",
					canceled: row[11] == "true",
					stop_id: row[12],
					stop_name: row[13],
					arrival: getDateTimeFromStringHist(row[14]),
					arrival_actual: getDateTimeFromStringHist(row[15]),
					departure: getDateTimeFromStringHist(row[17]),
					departure_actual: getDateTimeFromStringHist(row[18]),
				}
				histStops.push(histStop);
			}
		});

		rd.on("close", function () {
			resolve();
		});
	});

	let histStopsMap: Map<string, HistStop[]> = new Map();
	histStops.map((s) => {
		if (histStopsMap.has(s.trip_id)) {
			histStopsMap.set(s.trip_id, [s, ...histStopsMap.get(s.trip_id)]);
		} else {
			histStopsMap.set(s.trip_id, [s]);
		}
	});

	let stations: Station[] = JSON.parse(await fs.readFile("data/parsed/stations.json", "utf-8"));
	let stationsMap: Map<string, Station> = new Map();
	stations.map((s) => {
		stationsMap.set(s.id.toString(), s);
	});

	let trams = [];
	histStopsMap.forEach((v, k) => {
		let tram: Tram = {
			trip_id: v[0].trip_id,
			trip_name: v[0].trip_name,
			trip_status: "scheduled",
			headsign: "",
			direction: 0,
			route_id: v[0].route_id,
			route_name: v[0].route_name,
			service_id: "",
			service_days: [],
			progress: 0,
			delay: 0,
			active: false,
			stops: v.map((s) => {
				let station = stationsMap.get(s.stop_id);
				return {
					stop_id: s.stop_id,
					stop_diva: station?.diva || 0,
					stop_name: station?.name || s.stop_name,
					stop_sequence: 0,
					stop_status: "scheduled",
					arrival: s.arrival,
					departure: s.departure,
					arrival_delay: (s.arrival_actual - s.arrival) / 1000,
					departure_delay: (s.departure_actual - s.departure) / 1000,
					pred_arrival: s.arrival_actual || s.departure_actual,
					pred_departure: s.departure_actual || s.arrival_actual,
					arrived: false,
					departed: false,
				};
			}),
		};
		tram.stops.sort((a, b) => a.arrival - b.arrival);
		for (let i = 0; i < tram.stops.length; i++) {
			tram.stops[i].stop_sequence = i+1;
		}

		trams.push(tram);
	});

	await fs.writeFile(`data/hist/${date}.json`, JSON.stringify(trams));

	console.log("done");
}

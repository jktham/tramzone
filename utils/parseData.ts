import {
	promises as fs,
	createReadStream,
	createWriteStream 
} from "node:fs";
import stream from "node:stream";
import unzipper from "unzipper";
import "../utils/types";
let shapefile = require("shapefile");
import csv from "csv-parser";
import readline from "node:readline";
import { convertLV95toWGS84 } from "../utils/mapUtils";

function getUpdateDate() {
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
	let h = Number(timeString.split(":")[0]);
	let m = Number(timeString.split(":")[1]);
	let s = Number(timeString.split(":")[2]);

	let date = new Date(0);
	date.setHours(h, m, s, 0);
	return date.getTime();
}

function getDateFromString(dateString: string) {
	let y = Number(dateString.slice(0, 4));
	let m = Number(dateString.slice(4, 6));
	let d = Number(dateString.slice(6, 8));

	let date = new Date(0);
	date.setFullYear(y, m-1, d);
	date.setHours(0, 0, 0, 0);
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

async function getGtfs() {
	let date = getUpdateDate();

	// get static data
	if (!(await fs.readdir("data/gtfs/")).includes(`${date}`)) {
		console.log("getting new gtfs data: ", date);
		let gtfs_static = await fetch(`https://opentransportdata.swiss/de/dataset/timetable-2024-gtfs2020/resource_permalink/gtfs_fp2024_${date}.zip`);
		// @ts-ignore: dumb error
		let str = stream.Readable.fromWeb(gtfs_static.body);

		await fs.writeFile(`data/gtfs/${date}.zip`, str);
		console.log("unzipping");
		await createReadStream(`data/gtfs/${date}.zip`).pipe(unzipper.Extract({path: `data/gtfs/${date}`})).promise();
		await fs.unlink(`data/gtfs/${date}.zip`);
		console.log("done");
	} else {
		console.log("using old gtfs data: ", date);
	}

	// get realtime data (test)
	console.log("getting gtfs-rt data");
	const test_key = "57c5dbbbf1fe4d000100001842c323fa9ff44fbba0b9b925f0c052d1";
	let gtfs_realtime = await fetch("https://api.opentransportdata.swiss/gtfsrt2020?format=JSON", {
		headers: {
			Authorization: test_key,
		},
	});
	await fs.writeFile(`data/gtfs/realtime.json`, await gtfs_realtime.text());
}

async function parseGtfs() {
	let date = getUpdateDate();

	// routes
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
	routes = routes.filter((s) => s.type == "900" && s.agency == "3849"); // tram && VBZ
	await fs.writeFile("data/parsed/routes.json", JSON.stringify(routes));

	// trips
	console.log("parsing gtfs trips");
	let tripsRaw = await parseCSV(`data/gtfs/${date}/trips.txt`);
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
	let routeIds = new Set(routes.map((r) => r.route_id));
	trips = trips.filter((t) => routeIds.has(t.route_id));
	await fs.writeFile("data/parsed/trips.json", JSON.stringify(trips));

	// stop_times
	console.log("filtering gtfs stop times");

	let first = true;
	let tripIds = new Set(trips.map((t) => t.trip_id));
	let stopTimesFilteredWriteStream = createWriteStream("data/parsed/stopTimesFiltered.csv");
	await new Promise<void>((resolve) => {
		let rd = readline.createInterface({
			input: createReadStream(`data/gtfs/${date}/stop_times.txt`), // big ass file
			terminal: false,
		});

		rd.on("line", function (line) {
			let trip_id = line.split(",")[0].replace(/['"]+/g, "");
			if (first || tripIds.has(trip_id)) {
				stopTimesFilteredWriteStream.write(line + "\n");
			}
			first = false;
		});

		rd.on("close", function () {
			resolve();
		});
	});

	console.log("parsing gtfs stop times");

	let stopTimesReadStream = createReadStream("data/parsed/stopTimesFiltered.csv");
	let stopTimesWriteStream = createWriteStream("data/parsed/stopTimes.json");

	stopTimesWriteStream.on("drain", () => {
		stopTimesReadStream.resume();
	});
	stopTimesWriteStream.write("[");

	let sep = "";
	await new Promise<void>((resolve) => {
		stopTimesReadStream
		.pipe(csv())
		.on("data", (row) => {
			let station: StopTime = {
				trip_id: String(Object.values(row)[0])?.replace(/['"]+/g, ""), // for some reason using the key doesnt work
				arrival: getTimeFromString(row["arrival_time"]?.replace(/['"]+/g, "")),
				departure: getTimeFromString(row["departure_time"]?.replace(/['"]+/g, "")),
				stop_id: row["stop_id"]?.replace(/['"]+/g, ""),
				stop_sequence: Number(row["stop_sequence"]?.replace(/['"]+/g, "")),
			};
			if (!stopTimesWriteStream.write(sep + JSON.stringify(station))) {
				stopTimesReadStream.pause();
			}
			if (sep == "") {
				sep = ",";
			}
		})
		.on("end", () => {
			resolve();
		});
	});
	stopTimesWriteStream.write("]");

	// calendar
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

	// calendar_dates
	console.log("filtering gtfs service exceptions");

	first = true;
	let serviceIds = new Set(trips.map((t) => t.service_id));
	let ServiceExceptionsfilteredWriteStream = createWriteStream("data/parsed/serviceExceptionsFiltered.csv");
	await new Promise<void>((resolve) => {
		let rd = readline.createInterface({
			input: createReadStream(`data/gtfs/${date}/calendar_dates.txt`),
			terminal: false,
		});

		rd.on("line", function (line) {
			let service_id = line.split(",")[0].replace(/['"]+/g, "");
			if (first || serviceIds.has(service_id)) {
				ServiceExceptionsfilteredWriteStream.write(line + "\n");
			}
			first = false;
		});

		rd.on("close", function () {
			resolve();
		});
	});

	console.log("parsing gtfs service exceptions")
	let serviceExceptionsReadStream = createReadStream("data/parsed/serviceExceptionsFiltered.csv");
	let serviceExceptionsWriteStream = createWriteStream("data/parsed/serviceExceptions.json");

	serviceExceptionsWriteStream.on("drain", () => {
		serviceExceptionsReadStream.resume();
	});
	serviceExceptionsWriteStream.write("[");

	sep = "";
	await new Promise<void>((resolve) => {
		serviceExceptionsReadStream
		.pipe(csv())
		.on("data", (row) => {
			let serviceException: ServiceException = {
				service_id: String(Object.values(row)[0])?.replace(/['"]+/g, ""),
				date: getDateFromString(row["date"]?.replace(/['"]+/g, "")),
				type: Number(row["exception_type"]?.replace(/['"]+/g, "")),
			};
			if (!serviceExceptionsWriteStream.write(sep + JSON.stringify(serviceException))) {
				serviceExceptionsReadStream.pause();
			}
			if (sep == "") {
				sep = ",";
			}
		})
		.on("end", () => {
			resolve();
		});
	});
	serviceExceptionsWriteStream.write("]");
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
	stations = stations.filter((s) => s.type && s.type.toLowerCase().includes("tram"));

	let ignoredStations = JSON.parse((await fs.readFile(`data/datasets/ignoredStations.json`)).toString());
	stations = stations.filter((s) => !ignoredStations.includes(s.id));

	fs.writeFile("data/parsed/stations.json", JSON.stringify(stations));
}

async function parseLines() {
	console.log("parsing dataset lines");

	let lineColors = JSON.parse((await fs.readFile(`data/datasets/lineColors.json`)).toString());
	let geojson = await shapefile.read("data/datasets/lines.shp", "data/datasets/lines.dbf");

	let lines: Line[] = [];
	for (let feature of geojson.features) {
		if (feature.properties["BETRIEBS00"]?.includes("VBZ-Tram")) {
			let segment: Segment = {
				from: feature.properties["VONHALTEST"],
				to: feature.properties["BISHALTEST"],
				direction: feature.properties["RICHTUNG"],
				sequence: feature.properties["SEQUENZNR"],
				geometry: feature.geometry,
			};
			segment.geometry.coordinates = segment.geometry.coordinates.map((c) => convertLV95toWGS84(c));

			let found = lines.find((l) => l.id === feature.properties["LINIENSCHL"]);
			if (found) {
				found.segments.push(segment);
			} else {
				let line: Line = {
					id: feature.properties["LINIENSCHL"],
					name: feature.properties["LINIENNUMM"],
					color: lineColors.find((l) => l.name == feature.properties["LINIENNUMM"])?.color || "#000000",
					start: feature.properties["ANFANGSHAL"],
					end: feature.properties["ENDHALTEST"],
					segments: [segment],
				};
				lines.push(line);
			}
		}
	}
	lines.find((l) => l.name == "10").start = "Zürich, Bahnhofplatz/HB";
	lines.sort((a, b) => Number(a.name) - Number(b.name));
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
	
	fs.writeFile("data/parsed/lines.json", JSON.stringify(lines));
}

async function generateTramTrips() {
	console.log("generating tramTrips");

	let routes: Route[] = JSON.parse((await fs.readFile("data/parsed/routes.json")).toString());
	let trips: Trip[] = JSON.parse((await fs.readFile("data/parsed/trips.json")).toString());
	let stopTimes: StopTime[] = JSON.parse((await fs.readFile("data/parsed/stopTimes.json")).toString());
	let services: Service[] = JSON.parse((await fs.readFile("data/parsed/services.json")).toString());

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

	let servicesMap: Map<string, number[]> = new Map();
	services.map((s) => {
		servicesMap.set(s.service_id, s.days);
	});

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
	.sort((a, b) => a.direction - b.direction)
	.sort((a, b) => a.trip_id.localeCompare(b.trip_id))
	.sort((a, b) => Number(a.route_name) - Number(b.route_name));

	fs.writeFile("data/parsed/tramTrips.json", JSON.stringify(tramTrips));

	for (let i = 0; i < 7; i++) {
		let tramTrips_day = tramTrips.filter((t) => t.service_days[i] == 1);
		fs.writeFile(`data/parsed/tramTrips${i}.json`, JSON.stringify(tramTrips_day));
	}
}

async function parseData() {
	if (!(await fs.stat("data/gtfs/").catch((e) => false))) {
		await fs.mkdir("data/gtfs/");
	}
	if (!(await fs.stat("data/parsed/").catch((e) => false))) {
		await fs.mkdir("data/parsed/");
	}

	await parseLines();
	await parseStations();
	await getGtfs();
	await parseGtfs();
	await generateTramTrips();

	console.log("done");
}

parseData();

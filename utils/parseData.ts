import {promises as fs, createReadStream, createWriteStream, write} from "node:fs"
import stream from "node:stream"
import unzipper from "unzipper"
import "util/types"
let shapefile = require("shapefile")
import csv from "csv-parser"
import readline from "node:readline"

function getDate() {
	// new gtfs data every monday and thursday (todo: static at 10:00, rt at 15:00)
	let monday = new Date()
	monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
	let thursday = new Date()
	thursday.setDate(thursday.getDate() - (thursday.getDay() + 3) % 7)

	let date = new Date(Math.max(monday.getTime(), thursday.getTime())).toISOString().substring(0, 10)
	return date
}

function getISO(time: string) {
	let h = Number(time.split(":")[0])
	let m = Number(time.split(":")[1])
	let s = Number(time.split(":")[2])
	let d = new Date()
	d.setHours(h)
	d.setMinutes(m)
	d.setSeconds(s)
	d.setMilliseconds(0)
	return d.getTime()
}

async function getGtfs() {
	let date = getDate()

	// get static data
	if (!(await fs.readdir("data/gtfs/")).includes(`${date}`)) {
		console.log("getting new gtfs data: ", date)
		let gtfs_static = await fetch(`https://opentransportdata.swiss/de/dataset/timetable-2024-gtfs2020/resource_permalink/gtfs_fp2024_${date}.zip`)
		// @ts-ignore: dumb error
		let str = stream.Readable.fromWeb(gtfs_static.body)

		await fs.writeFile(`data/gtfs/${date}.zip`, str)
		console.log("unzipping")
		await createReadStream(`data/gtfs/${date}.zip`).pipe(unzipper.Extract({path: `data/gtfs/${date}`})).promise()
		await fs.unlink(`data/gtfs/${date}.zip`)
		console.log("done")

	} else {
		console.log("using old gtfs data: ", date)
	}

	// get realtime data (test)
	console.log("getting gtfs-rt data")
	const test_key = "57c5dbbbf1fe4d000100001842c323fa9ff44fbba0b9b925f0c052d1"
	let gtfs_realtime = await fetch("https://api.opentransportdata.swiss/gtfsrt2020?format=JSON", {
		headers: {
			"Authorization": test_key
		}
	})
	await fs.writeFile(`data/gtfs/realtime.json`, await gtfs_realtime.text())
}

async function parseGtfs() {
	let date = getDate()

	// routes
	console.log("parsing gtfs routes")
	let routesCsv = await fs.readFile(`data/gtfs/${date}/routes.txt`)
	let routesRaw = []
	for (let line of routesCsv.toString().split("\r\n")) {
		let r = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
		routesRaw.push(r)
	}
	routesRaw.shift()

	let routes: Route[] = routesRaw.map((r) => {
		return {
			route_id: r[0]?.replace(/['"]+/g, ""),
			name: r[2]?.replace(/['"]+/g, ""),
			type: r[5]?.replace(/['"]+/g, ""),
			agency: r[1]?.replace(/['"]+/g, "")
		}
	})
	routes = routes.filter((s) => s.type == "900" && s.agency == "3849") // tram && VBZ
	await fs.writeFile("data/parsed/routes.json", JSON.stringify(routes))

	// trips
	console.log("parsing gtfs trips")
	let tripsCsv = await fs.readFile(`data/gtfs/${date}/trips.txt`)
	let tripsRaw = []
	for (let line of tripsCsv.toString().split("\r\n")) {
		let t = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
		tripsRaw.push(t)
	}
	tripsRaw.shift()

	let trips: Trip[] = tripsRaw.map((t) => {
		return {
			trip_id: t[2]?.replace(/['"]+/g, ""),
			route_id: t[0]?.replace(/['"]+/g, ""),
			service_id: t[1]?.replace(/['"]+/g, ""),
			headsign: t[3]?.replace(/['"]+/g, ""),
			name: t[4]?.replace(/['"]+/g, ""),
			direction: Number(t[5]?.replace(/['"]+/g, ""))
		}
	})
	let routeIds = new Set(routes.map((r) => r.route_id))
	trips = trips.filter((t) => routeIds.has(t.route_id))
	await fs.writeFile("data/parsed/trips.json", JSON.stringify(trips))

	// stop_times
	console.log("filtering gtfs stop times")

	let first = true
	let tripIds = new Set(trips.map((t) => t.trip_id))
	let filteredWriteStream = createWriteStream("data/parsed/stopTimesFiltered.csv")
	await new Promise<void>((resolve) => {
		let rd = readline.createInterface({
			input: createReadStream(`data/gtfs/${date}/stop_times.txt`), // big ass file
			terminal: false
		})
	
		rd.on('line', function(line) {
			let trip_id = line.split(",")[0].replace(/['"]+/g, "")
			if (first || tripIds.has(trip_id)) {
				filteredWriteStream.write(line + "\n");
			}
			first = false
		})
		
		rd.on('close', function() {
			resolve()
		})
	})

	console.log("parsing gtfs stop times")

	let readStream = createReadStream("data/parsed/stopTimesFiltered.csv")
	let writeStream = createWriteStream("data/parsed/stopTimes.json")

	writeStream.on("drain", () => {
		readStream.resume()
	})
	writeStream.write("[")

	let sep = ""
	await new Promise<void>((resolve) => {
		readStream
			.pipe(csv())
			.on("data", (row) => {
				let station: StopTime = {
					trip_id: String(Object.values(row)[0])?.replace(/['"]+/g, ""), // for some reason using the key doesnt work
					arrival: getISO(row["arrival_time"]?.replace(/['"]+/g, "")),
					departure: getISO(row["departure_time"]?.replace(/['"]+/g, "")),
					stop_id: row["stop_id"]?.replace(/['"]+/g, ""),
					stop_sequence: Number(row["stop_sequence"]?.replace(/['"]+/g, ""))
				}
				if (!writeStream.write(sep + JSON.stringify(station))) {
					readStream.pause()
				}
				if (sep == "") {
					sep = ","
				}
			})
			.on("end", () => {
				resolve()
			})
		}
	)
	writeStream.write("]")

	// calendar
	console.log("parsing services")

	let servicesCsv = await fs.readFile(`data/gtfs/${date}/calendar.txt`)
	let servicesRaw = []
	for (let line of servicesCsv.toString().split("\r\n")) {
		let s = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
		servicesRaw.push(s)
	}
	servicesRaw.shift()

	// todo: consider calendar_dates
	let services: Service[] = servicesRaw.map((s) => {
		return {
			service_id: s[0]?.replace(/['"]+/g, ""),
			days: [Number(s[1]?.replace(/['"]+/g, "")), 
				Number(s[2]?.replace(/['"]+/g, "")), 
				Number(s[3]?.replace(/['"]+/g, "")), 
				Number(s[4]?.replace(/['"]+/g, "")), 
				Number(s[5]?.replace(/['"]+/g, "")), 
				Number(s[6]?.replace(/['"]+/g, "")), 
				Number(s[7]?.replace(/['"]+/g, ""))
			]
		}
	})
	await fs.writeFile("data/parsed/services.json", JSON.stringify(services))
}

async function parseStations() {
	console.log("parsing dataset stations")

	let csv = await fs.readFile("data/datasets/stations.csv")
	let lines = csv.toString().split("\n")
	let stationsRaw = []
	for (let line of lines) {
		let s = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
		stationsRaw.push(s)
	}
	stationsRaw.shift()

	let stations: Station[] = stationsRaw.map((s) => {
		return {
			id: Number(s[0]),
			diva: Number(s[1]),
			name: s[4]?.replace(/['"]+/g, ""),
			type: s[6]?.replace(/['"]+/g, ""),
			lines: s[13]?.replace(/['"]+/g, ""),
			coords: [Number(s[14]), Number(s[15])]
		}
	})
	stations = stations.filter((s) => s.type && s.type.toLowerCase().includes("tram"))

	fs.writeFile("data/parsed/stations.json", JSON.stringify(stations))
}

async function parseLines() {
	console.log("parsing dataset lines")

	let geojson = await shapefile.read("data/datasets/lines.shp", "data/datasets/lines.dbf")
	let lines: Line[] = []
	for (let feature of geojson.features) {
		if (feature.properties["BETRIEBS00"]?.includes("VBZ-Tram")) {
			let segment: Segment = {
				from: feature.properties["VONHALTEST"],
				to: feature.properties["BISHALTEST"],
				direction: feature.properties["RICHTUNG"],
				sequence: feature.properties["SEQUENZNR"],
				geometry: feature.geometry
			}
			
			let found = lines.find((l) => l.id === feature.properties["LINIENSCHL"])
			if (found) {
				found.segments.push(segment)
			} else {
				let line: Line = {
					id: feature.properties["LINIENSCHL"],
					name: feature.properties["LINIENNUMM"],
					start: feature.properties["ANFANGSHAL"],
					end: feature.properties["ENDHALTEST"],
					segments: [segment]
				}
				lines.push(line)
			}
		}
	}
	lines.sort((a, b) => Number(a.name) - Number(b.name))
	for (let line of lines) {
		line.segments.sort((a, b) => a.sequence - b.sequence)
		line.segments.sort((a, b) => a.direction - b.direction)
	}

	fs.writeFile("data/parsed/lines.json", JSON.stringify(lines))
}

async function generateTramTrips() {
	console.log("generating tramTrips")

	let routes: Route[] = JSON.parse((await fs.readFile("data/parsed/routes.json")).toString())
	let trips: Trip[] = JSON.parse((await fs.readFile("data/parsed/trips.json")).toString())
	let stopTimes: StopTime[] = JSON.parse((await fs.readFile("data/parsed/stopTimes.json")).toString())
	let services: Service[] = JSON.parse((await fs.readFile("data/parsed/services.json")).toString())

	let stopTimesMap: Map<string, StopTime[]> = new Map()
	stopTimes.map((s) => {
		if (stopTimesMap.has(s.trip_id)) {
			stopTimesMap.set(s.trip_id, [s, ...stopTimesMap.get(s.trip_id)])
		} else {
			stopTimesMap.set(s.trip_id, [s])
		}
	})
	stopTimesMap.forEach((v, k) => {
		stopTimesMap.set(k, v.sort((a, b) => a.stop_sequence - b.stop_sequence))
	})

	let servicesMap: Map<string, number[]> = new Map()
	services.map((s) => {
		servicesMap.set(s.service_id, s.days)
	})

	// todo: aaaa
	let tramTrips: TramTrip[] = trips.map((t) => {
		let r: Route = routes.find((r) => r.route_id == t.route_id)
		let s: StopTime[] = stopTimesMap.get(t.trip_id)
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
					departure: s.departure
				}
			})
		}
	})
	.sort((a, b) => a.direction - b.direction)
	.sort((a, b) => a.trip_id.localeCompare(b.trip_id))
	.sort((a, b) => Number(a.route_name) - Number(b.route_name))

	fs.writeFile("data/parsed/tramTrips.json", JSON.stringify(tramTrips))

	for (let i=0; i<7; i++) {
		let tramTrips_day = tramTrips.filter((t) => t.service_days[i] == 1)
		fs.writeFile(`data/parsed/tramTrips${i}.json`, JSON.stringify(tramTrips_day))
	}
}

async function main() {
	if (!(await fs.stat("data/gtfs/").catch((e) => false))) {
		await fs.mkdir("data/gtfs/")
	}
	if (!(await fs.stat("data/parsed/").catch((e) => false))) {
		await fs.mkdir("data/parsed/")
	}

	await parseLines()
	await parseStations()
	await getGtfs()
	await parseGtfs()
	await generateTramTrips()

	console.log("done")
}

main()

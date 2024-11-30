import {promises as fs, createReadStream} from "node:fs"
import stream from "node:stream"
import unzipper from "unzipper"
import util from "node:util"
import {exec} from "node:child_process"
import "util/types"
let shapefile = require("shapefile")

function getDate() {
	// new gtfs data every monday and thursday
	let monday = new Date()
	monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
	let thursday = new Date()
	thursday.setDate(thursday.getDate() - (thursday.getDay() + 3) % 7)

	let date = new Date(Math.max(monday.getTime(), thursday.getTime())).toISOString().substring(0, 10)
	return date
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

	let routes = routesRaw.map((r) => {
		return {
			route_id: r[0]?.replace(/['"]+/g, ""),
			name: r[2]?.replace(/['"]+/g, ""),
			type: r[5]?.replace(/['"]+/g, ""),
			agency: r[1]?.replace(/['"]+/g, "")
		}
	})
	routes = routes.filter((s) => s.type == "900" && s.agency == "3849")
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

	let trips = tripsRaw.map((t) => {
		return {
			trip_id: t[2]?.replace(/['"]+/g, ""),
			route_id: t[0]?.replace(/['"]+/g, ""),
			headsign: t[3]?.replace(/['"]+/g, ""),
			name: t[4]?.replace(/['"]+/g, ""),
			direction: Number(t[5]?.replace(/['"]+/g, ""))
		}
	})
	let routeIds = [... new Set(routes.map((r) => r.route_id))]
	trips = trips.filter((t) => routeIds.includes(t.route_id))
	await fs.writeFile("data/parsed/trips.json", JSON.stringify(trips))

	// stop_times
	console.log("parsing gtfs stop times")
	let stopTimesRaw = []
	try {
		await util.promisify(exec)(`sed -n '1,10000p' data/gtfs/${date}/stop_times.txt > data/gtfs/${date}/stop_times_short.txt`)
		let stopTimesCsv = await fs.readFile(`data/gtfs/${date}/stop_times_short.txt`) // full file too big, todo: figure something out
		for (let line of stopTimesCsv.toString().split("\r\n")) {
			let s = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
			stopTimesRaw.push(s)
		}
	} catch(e) {
		console.log(e, "skipping gtfs stop times")
	}
	stopTimesRaw.shift()

	let stopTimes = stopTimesRaw.map((s) => {
		return {
			trip_id: s[0]?.replace(/['"]+/g, ""),
			arrival: s[1]?.replace(/['"]+/g, ""),
			departure: s[2]?.replace(/['"]+/g, ""),
			stop_id: s[3]?.replace(/['"]+/g, ""),
			stop_sequence: Number(s[4]?.replace(/['"]+/g, ""))
		}
	})
	let tripIds = [... new Set(trips.map((t) => t.trip_id))]
	stopTimes = stopTimes.filter((s) => tripIds.includes(s.trip_id))
	await fs.writeFile("data/parsed/stopTimes.json", JSON.stringify(stopTimes))

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

	// todo: aaaa
	let tramTrips: TramTrip[] = trips.map((t) => {
		let r: Route = routes.find((r) => r.route_id == t.route_id)
		let s: StopTime[] = stopTimes.filter((s) => s.trip_id == t.trip_id).sort((a, b) => a.stop_sequence - b.stop_sequence)
		return {
			trip_id: t.trip_id,
			trip_name: t.name,
			headsign: t.headsign,
			direction: t.direction,
			route_id: r.route_id,
			route_name: r.name,
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
}

async function main() {
	if (!(await fs.stat("data/gtfs/").catch((e) => false))) {
		await fs.mkdir("data/gtfs/")
	}
	if (!(await fs.stat("data/parsed/").catch((e) => false))) {
		await fs.mkdir("data/parsed/")
	}

	await getGtfs()
	await parseGtfs()
	await parseLines()
	await parseStations()
	await generateTramTrips()
}

main()

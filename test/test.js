import {promises as fs, createReadStream} from "node:fs"
import stream from "node:stream"
import unzipper from "unzipper"

// new gtfs data every monday and thursday
let monday = new Date()
monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
let thursday = new Date()
thursday.setDate(thursday.getDate() - (thursday.getDay() + 3) % 7)

let date = new Date(Math.max(monday.getTime(), thursday.getTime())).toISOString().substring(0, 10)
console.log(date)

// get static data
if (!(await fs.stat("data/").catch((e) => false))) {
	await fs.mkdir("data/")
}
if (!(await fs.readdir("data/")).includes(`gtfs_${date}`)) {
	let gtfs_static = await fetch(`https://opentransportdata.swiss/de/dataset/timetable-2024-gtfs2020/resource_permalink/gtfs_fp2024_${date}.zip`)
	let str = stream.Readable.fromWeb(gtfs_static.body)

	await fs.writeFile(`data/gtfs_${date}.zip`, str)
	await createReadStream(`data/gtfs_${date}.zip`).pipe(unzipper.Extract({path: `data/gtfs_${date}`})).promise()
	await fs.unlink(`data/gtfs_${date}.zip`)
}

// get realtime data
const test_key = "57c5dbbbf1fe4d000100001842c323fa9ff44fbba0b9b925f0c052d1"
let gtfs_realtime = await fetch("https://api.opentransportdata.swiss/gtfsrt2020?format=JSON", {
	headers: {
		"Authorization": test_key
	}
})
await fs.writeFile(`data/realtime.json`, gtfs_realtime.body)

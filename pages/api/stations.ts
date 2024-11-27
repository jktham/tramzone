import type { NextApiRequest, NextApiResponse } from 'next'
import fs from "node:fs/promises"

type Station = {
	id: number,
	name: string,
	type: string,
	lines: string,
	coords: number[]
}

type ResponseData = Station[]

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	if (await fs.stat("data/stations.json").catch((e) => false)) {
		let stations = JSON.parse((await fs.readFile("data/stations.json")).toString())
		res.status(200).json(stations)
	}

	let csv = await fs.readFile("data/stations.csv")

	let lines = csv.toString().split("\n")
	let stationsRaw = []
	for (let line of lines) {
		let s = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
		stationsRaw.push(s)
	}
	stationsRaw.shift()

	let stations: Station[] = stationsRaw.map((s) => {
		return {
			id: Number(s[1]),
			name: s[4]?.replace(/['"]+/g, ""),
			type: s[6]?.replace(/['"]+/g, ""),
			lines: s[13]?.replace(/['"]+/g, ""),
			coords: [Number(s[14]), Number(s[15])]
		}
	})
	stations = stations.filter((s) => s.type && s.type.toLowerCase().includes("tram"))

	fs.writeFile("data/stations.json", JSON.stringify(stations))

	res.status(200).json(stations)
}

import type { NextApiRequest, NextApiResponse } from 'next'
import fs from "node:fs/promises"
let shapefile = require("shapefile")

type Segment = {
	from: number,
	to: number,
	direction: number,
	sequence: number,
	geometry: object
}

type Line = {
	id: string,
	name: string,
	start: string,
	end: string,
	segments: Segment[]
}

type ResponseData = Line[]

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	if (await fs.stat("data/lines.json").catch((e) => false)) {
		let lines = JSON.parse((await fs.readFile("data/lines.json")).toString())
		res.status(200).json(lines)
	}

	let geojson = await shapefile.read("data/lines.shp", "data/lines.dbf")

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

	fs.writeFile("data/lines.json", JSON.stringify(lines))

	res.status(200).json(lines)
}

import type { NextApiRequest, NextApiResponse } from 'next'
import fs from "node:fs/promises"
import "util/types"

type ResponseData = Station[] | string

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	if (!(await fs.stat("data/parsed/stations.json").catch((e) => false))) {
		res.status(404).send("no parsed stations (npm run parse)")
		return
	}
	let stations: Station[] = JSON.parse((await fs.readFile("data/parsed/stations.json")).toString())
	res.status(200).json(stations)
}

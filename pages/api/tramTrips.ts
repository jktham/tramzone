import type { NextApiRequest, NextApiResponse } from 'next'
import fs from "node:fs/promises"
import "util/types"

type ResponseData = TramTrip[] | string

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	if (!(await fs.stat("data/parsed/tramTrips.json").catch((e) => false))) {
		res.status(404).send("no parsed tramTrips (npm run parse)")
		return
	}
	let tramTrips: TramTrip[] = JSON.parse((await fs.readFile("data/parsed/tramTrips.json")).toString())
	res.status(200).json(tramTrips)
}

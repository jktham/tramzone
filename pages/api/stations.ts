import type { NextApiRequest, NextApiResponse } from 'next'
import fs from "node:fs/promises"
import "../../utils/types"
import { parseData } from "../../utils/parseUtils"

type ResponseData = Station[] | string

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	await parseData(false)
	let stations: Station[] = JSON.parse((await fs.readFile("data/parsed/stations.json")).toString())
	res.status(200).json(stations)
}

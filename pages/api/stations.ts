import type { NextApiRequest, NextApiResponse } from 'next'
import fs from "node:fs/promises"
import { parseData } from "../../utils/parseUtils"
import { Station } from '../../utils/types'
import { existsSync } from 'node:fs'

type ResponseData = Station[] | string

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	if (!existsSync("data/parsed/stations.json")) {
		await parseData(false)
	}
	let stations: Station[] = JSON.parse(await fs.readFile("data/parsed/stations.json", "utf-8"))
	res.status(200).json(stations)
}

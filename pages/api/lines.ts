import type { NextApiRequest, NextApiResponse } from 'next'
import fs from "node:fs/promises"
import { parseData } from "../../utils/parseUtils"
import { Line } from '../../utils/types'
import { existsSync } from 'node:fs'

type ResponseData = Line[] | string

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	if (!existsSync("data/parsed/lines.json")) {
		await parseData(false)
	}
	let lines: Line[] = JSON.parse(await fs.readFile("data/parsed/lines.json", "utf-8"))
	res.status(200).json(lines)
}

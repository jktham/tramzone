import type { NextApiRequest, NextApiResponse } from 'next'
import fs from "node:fs/promises"
import "../../utils/types"
import { parseData } from "../../utils/parseUtils"

type ResponseData = Line[] | string

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	await parseData(false)
	let lines: Line[] = JSON.parse((await fs.readFile("data/parsed/lines.json")).toString())
	res.status(200).json(lines)
}

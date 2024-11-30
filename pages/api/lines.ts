import type { NextApiRequest, NextApiResponse } from 'next'
import fs from "node:fs/promises"
import "util/types"

type ResponseData = Line[] | string

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	if (!(await fs.stat("data/parsed/lines.json").catch((e) => false))) {
		res.status(404).send("no parsed lines (npm run parse)")
		return
	}
	let lines: Line[] = JSON.parse((await fs.readFile("data/parsed/lines.json")).toString())
	res.status(200).json(lines)
}

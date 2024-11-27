import type { NextApiRequest, NextApiResponse } from 'next'

type Station = {
	name: string,
	x: number,
	y: number
}

type ResponseData = {
	stations: Station[]
}

export default function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	let stations: Station[] = [
		{name: "test1", x: 0, y: 0},
		{name: "test2", x: 10, y: 20},
	]
	res.status(200).json({stations})
}

import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs/promises";
import { Stop, Tram } from "../../utils/types";
import { getHist, parseData, parseHist } from "../../utils/parseUtils"
import { existsSync } from "node:fs";
import { updateTramProgress } from "../../utils/dataUtils";

type QueryParams = {
	date: string; // get historical data from this day (iso string: 2024-12-31)
	active: boolean;
	time: number; // must be timestamp on given date
	timeOffset: number;
}

type ResponseData = Tram[] | string;

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	await parseData(false)
	
	let query: QueryParams = {
		date: (req.query.date && req.query.date.toString()) || "2024-12-01",
		active: req.query.active === "true" || false,
		time: Number(req.query.time) || 0,
		timeOffset: Number(req.query.timeOffset) || 0,
	}

	if (!existsSync("data/hist/")) {
		await fs.mkdir("data/hist/");
	}
	if (!existsSync(`data/hist/${query.date}.csv`)) {
		await getHist(query.date);
	}
	if (!existsSync(`data/hist/${query.date}.json`)) {
		await parseHist(query.date);
	}

	let trams = JSON.parse(await fs.readFile(`data/hist/${query.date}.json`, "utf-8"))

	let time = query.time || new Date().getTime();
	time += query.timeOffset;

	updateTramProgress(trams, time);

	trams = trams.map((t) => {
        let prev_stop = t.stops.find((s) => s.stop_sequence == Math.floor(t.progress));
        let next_stop = t.stops.find((s) => s.stop_sequence == Math.floor(t.progress + 1));
		if (next_stop) {
			t.delay = next_stop.arrival_delay;
		}
		if (time >= t.stops[0].pred_arrival && time <= t.stops[t.stops.length-1].pred_departure) {
			t.active = true;
		}

		return t;
	});

	if (query.active) {
		trams = trams.filter((t) => t.active);
	}
	trams = trams.sort((a, b) => b.progress - a.progress);

	res.status(200).json(trams)
}
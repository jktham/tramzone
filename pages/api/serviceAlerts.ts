import type { NextApiRequest, NextApiResponse } from 'next'
import fs from "node:fs/promises"
import "../../utils/types"
import { parseData } from "../../utils/parseUtils"
import { existsSync } from 'node:fs'

type ResponseData = ServiceAlert[] | string

export default async function handler(req: NextApiRequest, res: NextApiResponse<ResponseData>) {
	await parseData(false);

	let gtfs_serviceAlerts = fetch("https://api.opentransportdata.swiss/gtfs-sa?format=JSON", {
		headers: {
			Authorization: process.env.KEY_SA,
			"Accept-Encoding": "gzip, deflate",
		},
	}).then((res) => res.json());
	let serviceAlerts = await gtfs_serviceAlerts;

	if (!serviceAlerts || serviceAlerts.error) {
		console.log(serviceAlerts)
		if (existsSync("data/gtfs/serviceAlerts.json")) {
			serviceAlerts = JSON.parse((await fs.readFile("data/gtfs/serviceAlerts.json")).toString());
		} else {
			serviceAlerts = {"entity": []};
		}
	} else {
		fs.writeFile("data/gtfs/serviceAlerts.json", JSON.stringify(serviceAlerts));
	}

	let alerts: ServiceAlert[] = serviceAlerts["entity"].map((s) => {
		return {
			alert_id: s.id,
			agencies: s.alert?.informedEntity?.map((e) => e.agencyId),
			start: (s.alert?.activePeriod[0]?.start * 1000) || 0,
			end: (s.alert?.activePeriod[0]?.end * 1000) || 1800000000000,
			cause: s.alert?.cause,
			effect: s.alert?.effect,
			header: s.alert?.headerText?.translation[1]?.text,
			description: s.alert?.descriptionText?.translation[1]?.text,
		}
	});

	let time = new Date().getTime()
	alerts = alerts.filter((s) => {
		return s.start <= time && s.end >= time;
	});

	let agencyIds = new Set(["3849", "838", "849", "165", "78", "7251", "194", "196"]);
	alerts = alerts.filter((s) => {
		for (let a of s.agencies) {
			if (agencyIds.has(a)) {
				return true;
			}
		}
		return false;
	});

	res.status(200).json(alerts)
}

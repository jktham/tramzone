export type Station = {
	id: number;
	diva: number;
	name: string;
	type: string;
	lines: string;
	coords: number[];
}

export type Segment = {
	from: number;
	to: number;
	direction: number;
	sequence: number;
	geometry: { // geojson LineString
		type: string;
		coordinates: number[][];
	};
}

export type Line = {
	name: string;
	color: string;
	services: LineService[];
}

// TODO: come up with better name for line/lineService ...
export type LineService = {
	id: string;
	full_name: string;
	start: string;
	end: string;
	segments: Segment[];
}

export type Route = {
	route_id: string;
	name: string;
	type: string;
	agency: string;
}

export type Trip = {
	trip_id: string;
	route_id: string;
	service_id: string;
	headsign: string;
	name: string;
	direction: number;
}

export type StopTime = {
	trip_id: string;
	arrival: number;
	departure: number;
	stop_id: string;
	stop_sequence: number;
}

export type TramTrip = {
	trip_id: string;
	trip_name: string;
	headsign: string;
	direction: number;
	route_id: string;
	route_name: string;
	service_id: string;
	service_days: number[];
	stops: {
		stop_id: string;
		stop_sequence: number;
		arrival: number; // timestamp (time on 1970-01-01)
		departure: number;
	}[];
}

export type Service = {
	service_id: string;
	days: number[];
	start: number;
	end: number;
}

export type ServiceException = {
	service_id: string;
	date: number;
	type: number; // 1: added; 2: deleted
}

export type TripStatus = // https://gtfs.org/documentation/realtime/reference/#enum-schedulerelationship_1
	| "scheduled"
	| "added"
	| "unscheduled"
	| "canceled"
	| "duplicated"
	| "deleted"


export type StopStatus = // https://gtfs.org/documentation/realtime/reference/#enum-schedulerelationship
	| "scheduled"
	| "skipped"
	| "no_data"
	| "unscheduled"

export type TripUpdate = {
	trip_id: string;
	trip_time: string;
	trip_date: string;
	trip_status: TripStatus;
	stops: {
		stop_id: string;
		stop_sequence: number;
		stop_status: StopStatus;
		arrival_delay: number;
		departure_delay: number;
	}[];
}

export type Stop = {
	stop_id: string;
	stop_diva: number;
	stop_name: string;
	stop_sequence: number;
	stop_status: StopStatus;
	arrival: number; // timestamp (today)
	departure: number;
	arrival_delay: number; // delay in seconds
	departure_delay: number;
	pred_arrival: number;
	pred_departure: number;
	arrived: boolean;
	departed: boolean;
}

export type Tram = {
	trip_id: string;
	trip_name: string;
	trip_status: TripStatus;
	headsign: string;
	direction: number;
	route_id: string;
	route_name: string;
	service_id: string;
	service_days: number[];
	progress: number; // progress as float corresponding to stop sequence
	delay: number; // current delay to next stop
	active: boolean; // arrived at first stop and hasnt departed last stop
	stops: Stop[];
}

export type ServiceAlert = {
	alert_id: string;
	agencies: string[];
	start: number;
	end: number;
	cause: string;
	effect: string;
	header: string;
	description: string;
}

export type HistStop = {
	trip_id: string;
	route_id: string;
	route_name: string;
	trip_name: string;
	added: boolean;
	canceled: boolean;
	stop_id: string;
	stop_name: string;
	arrival: number;
	arrival_actual: number;
	departure: number;
	departure_actual: number;
}

export type Disruption = {
	tram: Tram;
	stop: Stop | undefined;
	message: string;
}

export type Filter<t> = "ALL" | "NONE" | t | t[];

declare module "react" {
	interface CSSProperties {
		[key: `--${string}`]: string | number;
	}
}
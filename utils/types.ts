type Station = {
	id: number,
	diva: number,
	name: string,
	type: string,
	lines: string,
	coords: number[]
}

type Segment = {
	from: number,
	to: number,
	direction: number,
	sequence: number,
	geometry: object // geojson LineString
}

type Line = {
	id: string,
	name: string,
	color: string,
	start: string,
	end: string,
	segments: Segment[]
}

type Route = {
	route_id: string,
	name: string,
	type: string,
	agency: string
}

type Trip = {
	trip_id: string,
	route_id: string,
	service_id: string,
	headsign: string,
	name: string,
	direction: number
}

type StopTime = {
	trip_id: string,
	arrival: number,
	departure: number,
	stop_id: string,
	stop_sequence: number
}

type TramTrip = {
	trip_id: string,
	trip_name: string,
	headsign: string,
	direction: number,
	route_id: string,
	route_name: string,
	service_id: string,
	service_days: number[],
	stops: {
		stop_id: string,
		stop_sequence: number,
		arrival: number, // timestamp (time on 1970-01-01)
		departure: number
	}[]
}

type Service = {
	service_id: string,
	days: number[],
}

type TripUpdate = {
	trip_id: string,
	trip_time: string,
	trip_date: string,
	stops: {
		stop_id: string,
		stop_sequence: number,
		arrival_delay: number,
		departure_delay: number,
	}[]
}

type Tram = {
	trip_id: string,
	trip_name: string,
	headsign: string,
	direction: number,
	route_id: string,
	route_name: string,
	service_id: string,
	service_days: number[],
	progress: number, // progress as float corresponding to stop sequence
	delay: number, // current delay to next stop
	active: boolean, // departed first stop and hasnt arrived at last stop
	stops: {
		stop_id: string,
		stop_diva: number,
		stop_name: string,
		stop_sequence: number,
		arrival: number, // timestamp (today)
		departure: number,
		arrival_delay: number, // delay in seconds
		departure_delay: number,
		pred_arrival: number,
		pred_departure: number,
		arrived: boolean,
		departed: boolean,
	}[]
}

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
	geometry: object
}

type Line = {
	id: string,
	name: string,
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
	headsign: string,
	name: string,
	direction: number
}

type StopTime = {
	trip_id: string,
	arrival: string,
	departure: string,
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
	stops: {
		stop_id: string,
		stop_sequence: number,
		arrival: string,
		departure: string
	}[]
}

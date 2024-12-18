import styles from "../styles/symbols.module.css"

export function LineSymbol({data}: { data: any }) {

	return <>
		<span style={{background: data.color}} className={styles.lineSymbol}>{data.route_name || data.name}</span>
	</>
}

export function StationSymbol({data}: { data: any }) {

	return <>
		<span className={styles.stationSymbol}>
			<span className={styles.line}></span>
			<span className={styles.circle}></span>
			<span className={styles.line}></span>
		</span>
	</>
}

export function TramDot({data}: { data: any }) {

	return (
		<span className={styles.tramDot}><span style={{background: data.color}}></span></span>
	)
}

export function StationDot({data}: { data: any }) {

	return (
		<span className={styles.stationDot}><span></span></span>
	)
}

export function FocusOverlay({data}: { data: any }) {


	const type = data.type
	const isTram = type === "tram";
	const isStation = type === "station";

	const title = data.trip_name || data.name.split(",").pop().trim()

	return <>
		<div className={styles.focusOverlay}>
			<div className={styles.text}>{title}</div>
			{isTram && <TramDot data={data}></TramDot>}
			{isStation && <StationDot data={data}></StationDot>}
		</div>
	</>
}
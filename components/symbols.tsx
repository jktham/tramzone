import styles from "../styles/symbols.module.css"
import {Target, Line, Segment, Station, Tram} from "../utils/types";
import {FeatureLike} from "ol/Feature";
import {memo} from "react";
import {isLine, isStation, isTram} from "../pages";

export function LineSymbol({target}: { target: Target }) {

	return <>
		<span style={{background: isLine(target)?.color || isTram(target)?.color}} className={styles.lineSymbol}>{isTram(target)?.route_name || isLine(target)?.name}</span>
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

export function TramDot({tram}: { tram: Tram }) {

	return (
		<span className={styles.tramDot}><span style={{background: tram.color}}></span></span>
	)
}

export function StationDot({station}: { station: Station }) {

	return (
		<span className={styles.stationDot}><span></span></span>
	)
}

export const TargetOverlay = memo(({target}: { target: Target }) => {
	const title = (isTram(target)?.trip_name) || (isStation(target)?.name?.split(",")?.pop()?.trim())

	return <>
		<div className={styles.targetOverlay}>
			<div className={styles.text}>{title}</div>
			{isTram(target) && <TramDot tram={isTram(target)}></TramDot>}
			{isStation(target) && <StationDot station={isStation(target)}></StationDot>}
		</div>
	</>
})
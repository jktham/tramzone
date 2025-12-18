import styles from "../styles/info.module.css"
import {LineSymbol, StationSymbol} from "./symbols";
import Tag from "./tag";
import {LineString} from "ol/geom";
import {getLength} from "ol/sphere";
import {Target} from "../utils/types";
import {Coordinate} from "ol/coordinate";
import {isLine, isSegment, isStation, isTram} from "../pages";
import {userInZurich} from "../utils/mapUtils";

// TODO type of data
export default function Info({target, targetLocation, userLocation}: { target: Target; targetLocation: Coordinate, userLocation: Coordinate }) {

	const station = isStation(target)
	const line = isLine(target)
	const segment = isSegment(target)
	const tram = isTram(target)

	const meters = targetLocation && userLocation && userInZurich(userLocation) && getLength(new LineString([userLocation, targetLocation]))

	const title =
		tram && (tram.route_name === "18" ? "S18 / Forchbahn" : "Tram " + tram.route_name) ||
		station && (station.name.replaceAll("/", "/\u200B")?.replaceAll(",", ",\u200D")) ||
		line && ("Line " + line.name) ||
		segment && ("Segment " + segment.sequence);
	const distance = meters && (meters > 999 ? Math.round(meters/100)/10 + "km" : Math.round(meters) + "m")
	const delay = tram && (tram.delay !== 0) && ((tram.delay > 0 ? "+" : "") + Math.round(tram.delay) + "s")

	isLine(target)?.color || isTram(target)?.color

	return <>
		<div className={styles.info}>
			<span className={styles.symbol}>{station && <StationSymbol data={station}></StationSymbol> || <LineSymbol color={line?.color || tram?.color} name={line?.name || tram?.route_name}></LineSymbol>}</span>
			<div className={styles.content}>
				<h1 className={styles.title}>{title}</h1>
				<div className={styles.tags}>
					{distance && <Tag fill={"rgba(45,110,133,1)"} stroke={"rgba(45,110,133,0.3)"} type={"white"}>{distance}</Tag>}
					{delay && <Tag fill={tram.delay > 0 ? "var(--DEL1)" : "var(--DEL2)"} type={"white"}>{delay}</Tag>}
					{/*tram && <Tag type={"white"}>{tram.progress}</Tag>*/}
				</div>
			</div>
		</div>
	</>
}
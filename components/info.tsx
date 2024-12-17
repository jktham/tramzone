import styles from "../styles/info.module.css"
import {LineSymbol, StationSymbol} from "./symbols";
import Tag from "./tag";
import {Geolocation} from "ol";
import {LineString} from "ol/geom";
import {getLength} from "ol/sphere";

// TODO type of data
export default function Info({data, userLocation} : {data : any; userLocation : Geolocation}) {

	const type = data.type
	const isTram = type === "tram";
	const isLine = type === "line";
	const isStation = type === "station";

	const meters = getLength(new LineString([userLocation.getPosition(), data.geometry.flatCoordinates]))

	const title = (isTram ? ("Tram " + data.route_name + " " + data.trip_name) : isStation ? data.name : "Line " + data.name).replaceAll("/", "/\u200B").replaceAll(",", ",\u200D");
	const distance = meters > 999 ? Math.round(meters/100)/10 + "km" : Math.round(meters) + "m";
	const delay = isTram/* && (data.delay > 0)*/ && ("+" + data.delay + "s")

	return <>
		<div className={styles.info}>
			<span className={styles.symbol}>{isStation ? <StationSymbol data={data}></StationSymbol> : <LineSymbol data={data}></LineSymbol>}</span>
			<div className={styles.content}>
				<h1 className={styles.title}>{title}</h1>
				<div className={styles.tags}>{distance && <Tag fill={"rgba(45,110,133,1)"} stroke={"rgba(45,110,133,0.3)"} type={"white"}>{distance}</Tag>}{delay && <Tag fill={"var(--DEL)"} type={"white"}>{delay}</Tag>}</div>
			</div>
		</div>
	</>
}
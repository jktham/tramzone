import styles from "../styles/overlay.module.css"
import Info from "./info";
import {Geolocation} from "ol";

export default function Overlay({data, userLocation} : {data : any; userLocation : Geolocation}) {

	const type = data.type
	const isTram = type === "tram";
	const isLine = type === "line";
	const isStation = type === "station";

    const title = isTram ? ("Tram " + data.route_name + " " + data.trip_name) : isStation ? data.name : "Line " + data.name;

	return <>
        <div className={styles.overlay}>
			<div className={styles.content}>
            	<Info data={data} userLocation={userLocation}></Info>
			</div>
        </div>
    </>
}
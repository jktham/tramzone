import styles from "../styles/overlay.module.css"
import Info from "./info";
import {Coordinate} from "ol/coordinate";
import {Target} from "../utils/types";
import {memo} from "react";

const Overlay = memo(({target, targetLocation, userLocation}: { target: Target; targetLocation: Coordinate, userLocation: Coordinate }) => {

	return <>
		<div className={styles.overlay}>
			<div className={styles.content}>
				<Info target={target} targetLocation={targetLocation} userLocation={userLocation}></Info>
			</div>
		</div>
	</>
})

export default Overlay
import styles from "../styles/controls.module.css"
import {PropsWithChildren} from "react";

export function ControlButton({children, onClick, fillColor} : {fillColor? : string, onClick? : () => void} & PropsWithChildren) {

	return <>
		<button style={{"--fill2": fillColor}} onClick={onClick} className={styles.control}>{children}</button>
    </>
}

export function ControlGroup({children, fillColor} : {fillColor? : string} & PropsWithChildren) {

	return <>
		<div style={{"--fill1": fillColor}} className={styles.group}>{children}</div>
	</>
}

export function ControlBar({children}: PropsWithChildren) {

	return <>
		<div className={styles.bar}>{children}</div>
	</>
}
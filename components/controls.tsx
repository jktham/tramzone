import styles from "../styles/controls.module.css"
import {CSSProperties, PropsWithChildren} from "react";
import clsx from "clsx";

export function MapControl({children, onClick, fillColor}: { fillColor?: string, onClick?: () => void } & PropsWithChildren) {

	return <>
		<button style={{"--fill2": fillColor}} onClick={onClick} className={styles.mapControl}>{children}</button>
	</>
}

export function MapControlGroup({children, fillColor}: { fillColor?: string } & PropsWithChildren) {

	return <>
		<div style={{"--fill1": fillColor}} className={styles.group}>{children}</div>
	</>
}

export function MapControlBar({children, style}: { style?: CSSProperties } & PropsWithChildren) {

	return <>
		<div style={style} className={styles.bar}>{children}</div>
	</>
}

export function FancyControlBox({children, state, title, onClick}: { title: string, state?: boolean, onClick?: () => void } & PropsWithChildren) {

	return <button onClick={onClick} className={clsx(styles.fancy, state && styles.toggled)}>{children}
		<span className={styles.knob}><span></span></span>
		<h2>{title}</h2>
	</button>
}
import styles from "../styles/controls.module.css"
import {CSSProperties, PropsWithChildren} from "react";
import clsx from "clsx";
import { LineSymbol } from "./symbols";

export function ToolbarButton({children, onClick, fillColor, hidden}: { fillColor?: string, onClick?: () => void, hidden?: boolean } & PropsWithChildren) {

	const animStyles : CSSProperties = {
		...{"--fill2": fillColor, transitionProperty: "height, margin-top, opacity", transitionDuration: ".3s, .3s, .1s"},
		...(hidden ? {transitionDelay: ".1s, .1s, 0s", height: 0, marginTop: "calc(-1 * var(--gaps))", pointerEvents: "none", opacity: 0} : {transitionDelay: "0s, 0s, .3s"})
	}

	return <>
		<button style={{...{"--fill2": fillColor}, ...animStyles}} onClick={onClick} className={styles.mapControl}>{children}</button>
	</>
}

export function ToolbarGroup({children, fillColor}: { fillColor?: string } & PropsWithChildren) {

	return <>
		<div style={{"--fill1": fillColor}} className={styles.group}>{children}</div>
	</>
}

export function Toolbar({children, style}: { style?: CSSProperties } & PropsWithChildren) {

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

export function TramButton({state, color, name, onClick}: { state?: boolean, color: string, name: string, onClick?: () => void  }) {

	return <button onClick={onClick} className={"p-1 rounded-[10px] bg-bg2 cursor-pointer"}>
		<LineSymbol color={state ? color : "var(--color-bg1)"} name={name}></LineSymbol>
	</button>
}
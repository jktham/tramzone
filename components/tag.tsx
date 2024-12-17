import styles from "../styles/symbols.module.css"
import {PropsWithChildren} from "react";
import clsx from "clsx";

export default function Tag({children, type, fill, stroke} : {type? : "auto" | "inverse" | "white" | "black", fill? : string, stroke? : string} & PropsWithChildren) {

	return <>
		<span style={{"--fill" : fill, "--stroke" : stroke}} className={clsx(styles.tag, styles[type])}>
			{children}
		</span>
	</>
}
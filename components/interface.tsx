import styles from "../styles/interface.module.css"
import {PropsWithChildren} from "react";

export default function Interface({children} : {} & PropsWithChildren) {

	return <>
		<div className={styles.grid}>
			{children}
		</div>
	</>
}
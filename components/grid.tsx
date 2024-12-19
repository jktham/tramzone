import styles from "../styles/grid.module.css"
import {PropsWithChildren, useContext} from "react";
import {MediaQueryContext} from "../pages/_app";

export default function Grid({children} : {} & PropsWithChildren) {

	const { mobile } = useContext(MediaQueryContext);

	return <>
		<div className={styles.grid}>
			{children}
		</div>
	</>
}
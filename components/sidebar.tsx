import styles from "../styles/grid.module.css"
import {PropsWithChildren, useContext} from "react";
import {MediaQueryContext} from "../pages/_app";

export function Sidebar({children} : {} & PropsWithChildren) {

	const { mobile } = useContext(MediaQueryContext);

	return <>
		<div className={styles.sidebar}>
			<div className={styles.content}>
			{children}
			</div>
		</div>
	</>
}

export function LayerControlScreen() {

	return <></>
}
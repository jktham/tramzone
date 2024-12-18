import styles from "../styles/symbols.module.css"

export function LineSymbol({data} : {data : any}) {

	return <>
		 <span style={{background: data.color}} className={styles.lineSymbol}>{data.route_name || data.name}</span>
	</>
}

export function StationSymbol({data} : {data : any}) {

	return <>
		<span className={styles.stationSymbol}>
			<span className={styles.line}></span>
			<span className={styles.circle}></span>
			<span className={styles.line}></span>
		</span>
	</>
}
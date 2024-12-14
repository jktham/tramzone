import styles from "../styles/symbols.module.css"

export default function LineSymbol({data} : {data : any}) {

	return <>
		 <span style={{background: data.color}} className={styles.lineSymbol}>{data.route_name || data.name}</span>
	</>
}
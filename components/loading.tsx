import styles from "../styles/loading.module.css"

export default function Loading() {
	return (
		<div className={styles.loading}>
			<span className={styles.line}></span>
			<span className={styles.station}><span></span></span>
			<span className={styles.tram}><span></span></span>
		</div>
	)
}

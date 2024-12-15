import styles from "../styles/overlay.module.css"
import LineSymbol from "./lineSymbol";

export default function Overlay({data} : any) {

	//console.log(data)

    const type = data.type

    const isTram = type === "tram";
    const isLine = type === "line";
    const isStation = type === "station";


    const title = isTram ? ("Tram " + data.route_name + " " + data.trip_name) : isStation ? data.name : "Line " + data.name;

	return <>
        <div className={styles.overlay}>
            <div className={styles.titleBar}>
                {isStation ? <></> : <LineSymbol data={data}></LineSymbol>}
                <h1>{title}</h1>
            </div>
        </div>
    </>
}
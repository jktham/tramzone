import styles from "../styles/overlay.module.css"

export default function Overlay({data} : any) {

    const type = data.type

    const isTram = type === "tram";
    const isLine = type === "line";
    const isStation = type === "station";


    const title = isTram ? ("Tram " + data.route_name + " " + data.trip_name) : isStation ? data.name : "Line " + data.name;

    console.log(data)

    return <>
        <div className={styles.overlay}>
            <div className={styles.titleBar}>
                {isStation ? <></> : <span style={{background: data.color}} className={styles.lineIcon}>{isLine ? data.name : data.route_name}</span>}
                <h1>{title}</h1>
            </div>
        </div>
    </>
}
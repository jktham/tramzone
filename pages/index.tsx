
import Map from "../Components/tramMap";

export default function Home() {

	const lineData = {};
	const stationData = {};
	const tramData = {};

	return (
		<>
			<Map lineData={lineData} stationData={stationData} tramData={tramData}></Map>
		</>
	)
}
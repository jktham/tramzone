import useSWR from "swr";
import TramMap from "../components/tramMap";
import {useState} from "react";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Home() {
	const {data: lineData, error: linesError, isLoading: linesLoading} = useSWR("/api/lines", fetcher);
	const {data: stationData, error: stationsError, isLoading: stationsLoading} = useSWR("/api/stations", fetcher);
	const {data: tramData, error: tramsError, isLoading: tramsLoading} = useSWR("/api/trams?active=true", fetcher, {refreshInterval: 1000}); // refresh for testing

	const [focus, setFocus] = useState<any>(null);


	const onClick = (target : any) => {

	}


	if (linesLoading || stationsLoading || tramsLoading)
		return <div>Is Loading...</div>

	return (
		<>
			<TramMap onClick={onClick} focus={focus} lineData={lineData} stationData={stationData} tramData={tramData}></TramMap>
		</>
	);
}

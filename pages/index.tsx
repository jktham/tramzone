import useSWR from "swr";
import TramMap from "../components/tramMap";
import {ReactElement, useState} from "react";
import Overlay from "../components/overlay";
import SEO from "../components/SEO";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Home() {
	const {data: lineData, error: linesError, isLoading: linesLoading} = useSWR("/api/lines", fetcher);
	const {data: stationData, error: stationsError, isLoading: stationsLoading} = useSWR("/api/stations", fetcher);
	const {data: tramData, error: tramsError, isLoading: tramsLoading} = useSWR("/api/trams?active=true", fetcher, {refreshInterval: 1000});
	// const {data: tramData, error: tramsError, isLoading: tramsLoading} = useSWR(`/api/tramsHist?date=2024-12-11&active=true&timeOffset=${-86400000 * 2}`, fetcher, {refreshInterval: 1000});

	const [focus, setFocus] = useState<any>(null);
	const [overlay, setOverlay] = useState<ReactElement>(null);

	const onClick = (target : any) => {
		if (target === undefined)
			return setOverlay(null);

		const overlay = (<><Overlay data={target.values_}></Overlay></>)

		setFocus(target);
		setOverlay(overlay);
	}

	return (
		<>
			<SEO />
			{!(linesLoading || stationsLoading || tramsLoading) && <TramMap onClick={onClick} filter={{}} focus={focus} lineData={lineData} stationData={stationData} tramData={tramData} overlay={overlay}></TramMap>}
		</>
	);
}

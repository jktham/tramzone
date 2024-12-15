import useSWR from "swr";
import TramMap from "../components/tramMap";
import {ReactElement, useState} from "react";
import Overlay from "../components/overlay";
import SEO from "../components/SEO";
import Loading from "../components/loading";
import { timeOffset, histDate } from "../components/tramMap";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Home() {
	const {data: lineData, error: linesError, isLoading: linesLoading} = useSWR("/api/lines", fetcher);
	const {data: stationData, error: stationsError, isLoading: stationsLoading} = useSWR("/api/stations", fetcher);

	const tramUrl = !histDate ? `/api/trams?active=true&timeOffset=${timeOffset}` : `/api/tramsHist?active=true&date=${histDate}&timeOffset=${timeOffset}`;
	const {data: tramData, error: tramsError, isLoading: tramsLoading} = useSWR(tramUrl, fetcher, {refreshInterval: 1000});

	const [focus, setFocus] = useState<any>(null);
	const [overlay, setOverlay] = useState<ReactElement>(null);

	const onClick = (target : any) => {
		if (target === undefined)
			return setOverlay(null);

		const overlay = (<><Overlay data={target.values_}></Overlay></>)

		setFocus(target);
		setOverlay(overlay);
	}

	if (linesLoading || stationsLoading || tramsLoading)
		return <>
			<SEO/>
			<Loading></Loading>
		</>

	return (
		<>
			<SEO />
			<TramMap onClick={onClick} filter={{}} focus={focus} lineData={lineData} stationData={stationData} tramData={tramData} overlay={overlay}></TramMap>
		</>
	);
}

import useSWR from "swr";
import TramMap from "../components/tramMap";
import {ReactElement, useContext, useState} from "react";
import Overlay from "../components/overlay";
import SEO from "../components/SEO";
import Loading from "../components/loading";
import { timeOffset, histDate } from "../components/tramMap";
import {useTheme} from "next-themes";
import Interface from "../components/interface";
import {Geolocation} from "ol";
import {MediaQueryContext} from "./_app";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Home() {
	const {data: lineData, error: linesError, isLoading: linesLoading} = useSWR("/api/lines", fetcher);
	const {data: stationData, error: stationsError, isLoading: stationsLoading} = useSWR("/api/stations", fetcher);

	const tramUrl = !histDate ? `/api/trams?active=true&timeOffset=${timeOffset}` : `/api/tramsHist?active=true&date=${histDate}&timeOffset=${timeOffset}`;
	const {data: tramData, error: tramsError, isLoading: tramsLoading} = useSWR(tramUrl, fetcher, {refreshInterval: 4000});

	const { mobile } = useContext(MediaQueryContext);

	const { theme, setTheme } = useTheme();

	const [overlay, setOverlay] = useState<ReactElement>(null);
	const [clickFilter, setClickFilter] = useState<number>(0);

	const onClick = (target : any, userLocation : Geolocation) => {
		if (!target) {
			setClickFilter(0);
			setOverlay(null);
			return;
		}

		const overlay = (<><Overlay data={target.getProperties()} userLocation={userLocation}></Overlay></>)
		setOverlay(overlay);
		setClickFilter(target.getProperties().type === "tram" ? Number(target.getProperties().name) : 0);
	}

	if (linesLoading || stationsLoading || tramsLoading)
		return <>
			<SEO/>
			<Loading></Loading>
		</>

	return (
		<>
			<SEO />
			<Interface>{mobile && overlay}</Interface>
			{/*<button style={{position: "absolute", zIndex: 1000}} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>Mode</button>*/} {/* DEBUG */}
			<TramMap onClick={onClick} filter={{trams: clickFilter ?? "ALL", lines: clickFilter ?? "ALL", stations: "ALL"}} lineData={lineData} stationData={stationData} tramData={tramData} overlay={!mobile && overlay}></TramMap>
		</>
	);
}

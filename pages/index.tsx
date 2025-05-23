import useSWR from "swr";
import TramMap from "../components/tramMap";
import {ReactElement, useContext, useEffect, useState} from "react";
import Overlay from "../components/overlay";
import SEO from "../components/SEO";
import Loading from "../components/loading";
import {timeOffset, histDate} from "../components/tramMap";
import {useTheme} from "next-themes";
import Grid from "../components/grid";
import {Geolocation} from "ol";
import {MediaQueryContext} from "./_app";
import {MapControlBar, MapControl, FancyControlBox} from "../components/controls";
import {StackSimple, X} from "@phosphor-icons/react";
import {Sidebar} from "../components/sidebar";
import {Filter, Line} from "../utils/types";
import {useSearchParams} from "next/navigation";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Home() {
	const {data: lineData, error: linesError, isLoading: linesLoading} = useSWR("/api/lines", fetcher);
	const {data: stationData, error: stationsError, isLoading: stationsLoading} = useSWR("/api/stations", fetcher);

	const tramUrl = !histDate ? `/api/trams?active=true&timeOffset=${timeOffset}` : `/api/tramsHist?active=true&date=${histDate}&timeOffset=${timeOffset}`;
	const {data: tramData, error: tramsError, isLoading: tramsLoading} = useSWR(tramUrl, fetcher, {refreshInterval: 4000});

	const searchParams = useSearchParams()

	const {mobile} = useContext(MediaQueryContext);

	const {theme, setTheme} = useTheme();

	const [overlay, setOverlay] = useState<ReactElement>(null);
	const [sidebar, setSidebar] = useState<boolean>(false);
	const [showLines, setShowLines] = useState<boolean>(false);
	const [showStations, setShowStations] = useState<boolean>(true);
	//const [showTrams, setShowTrams] = useState<boolean>(true);
	//const [lineFilter, setLineFilter] = useState<string[]>([]);
	const [clickFilter, setClickFilter] = useState<string[]>(null);

	const onClick = (target: any, userLocation: Geolocation) => {
		if (!target) {
			setClickFilter(null);
			setOverlay(null);
			return;
		}

		const overlay = (<><Overlay data={target.getProperties()} userLocation={userLocation}></Overlay></>)
		setOverlay(overlay);
		setClickFilter(target.getProperties().type === "tram" ? target.getProperties().name : null);
	}


	/*const onOptChange = (e) => {
		if (e.target.checked) setLineFilter(lineFilter.concat([e.target.value]))
		else setLineFilter(lineFilter.filter(s => s !== e.target.value));
	}*/

	if (linesLoading || stationsLoading || tramsLoading)
		return <>
			<SEO/>
			<Loading></Loading>
		</>

	return (
		<>
			<SEO/>
			<Grid>
				<MapControlBar style={{gridArea: "controlsL"}}><MapControl onClick={() => setSidebar(!sidebar)}><StackSimple color={"var(--FG1)"} weight={"bold"} size={16}></StackSimple></MapControl></MapControlBar>
				{sidebar && <Sidebar>
					<h1>Tramz.one <MapControl onClick={() => setSidebar(false)}><X color={"var(--FG1)"} weight={"bold"} size={16}></X></MapControl></h1>
					<FancyControlBox state={showLines} title={"Lines"} onClick={() => setShowLines(!showLines)}>
						<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio={"xMidYMid slice"} viewBox="0 0 158 183" fill="none">
							<g mask="url(#mask0_252_301)">
								<path vectorEffect="non-scaling-stroke" d="M117.671 -3.99994V24.5001C117.671 49.0001 117.671 48.6083 92.5 73.7797C68.2796 98.0001 68.5 98.0001 30 98.0001H-2" stroke="#EE3897" strokeWidth="3"/>
								<path vectorEffect="non-scaling-stroke" d="M-2.5 111.5L44.5 111.5C74.5 111.5 74.5001 111.5 98.5001 87.5001C118.056 67.944 118 67.944 141 67.944L160 67.944" stroke="#49479D" strokeWidth="3"/>
							</g>
						</svg>
					</FancyControlBox>
					<FancyControlBox state={showStations} title={"Stations"} onClick={() => setShowStations(!showStations)}>
						<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio={"xMidYMid slice"} viewBox="0 0 159 183" fill="none">
							<g mask="url(#mask0_252_284)">
								<path vectorEffect="non-scaling-stroke" d="M166 56.0004L129.5 56.0004C115.5 56.0004 115.5 56.0004 92.0002 79.5004C67.0006 104.5 67.0002 104.5 45.5002 104.5L-3.5 104.5" stroke="#49479D" strokeWidth="3"/>
								<path vectorEffect="non-scaling-stroke" d="M98 78.5C98 81.2614 95.7614 83.5 93 83.5C90.2386 83.5 88 81.2614 88 78.5C88 75.7386 90.2386 73.5 93 73.5C95.7614 73.5 98 75.7386 98 78.5Z" fill="var(--BG2)" stroke="var(--FG2)" strokeWidth="3"/>
								<path vectorEffect="non-scaling-stroke" d="M35.5 104.5C35.5 107.261 33.2614 109.5 30.5 109.5C27.7386 109.5 25.5 107.261 25.5 104.5C25.5 101.739 27.7386 99.5 30.5 99.5C33.2614 99.5 35.5 101.739 35.5 104.5Z" fill="var(--BG2)" stroke="var(--FG2)" strokeWidth="3"/>
							</g>
						</svg>
					</FancyControlBox>
					{/*<form style={{overflowY: "scroll"}} onChange={onOptChange}>
						{lineData.map((l : Line) => l.services.map(s => <>
							<input type="checkbox" id={s.id} name={s.id} value={s.id}></input>
							<label style={{color: "var(--FG1)"}} htmlFor={s.id}>{s.id} // {s.full_name}</label>
							<br></br>
						</>))}
					</form>*/}
				</Sidebar>}
				{mobile && overlay}
			</Grid>
			{/*<button style={{position: "absolute", zIndex: 1000}} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>Mode</button>*/} {/* DEBUG */}
			<TramMap debug={!!searchParams.get('debug')} onClick={onClick} filter={{trams: clickFilter || "ALL", lines: clickFilter || (showLines ? "ALL" : "NONE"), stations: showStations ? "ALL" : "NONE"}} lineData={lineData} stationData={stationData} tramData={tramData} overlay={!mobile && overlay}></TramMap>
			{/*<TramMap debug={!!searchParams.get('debug')} onClick={onClick} filter={{trams: "ALL", lines: showLines ? lineFilter : "NONE", stations: showStations ? "ALL" : "NONE"}} lineData={lineData} stationData={stationData} tramData={tramData} overlay={!mobile && overlay}></TramMap>*/}
		</>
	);
}

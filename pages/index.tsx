import useSWR from "swr";
import Map, {ClickTarget} from "../components/map";
import {useContext, useEffect, useState} from "react";
import SEO from "../components/SEO";
import Loading from "../components/loading";
import Grid from "../components/grid";
import {MediaQueryContext} from "./_app";
import {MapControlBar, MapControl, FancyControlBox} from "../components/controls";
import {StackSimple, X} from "@phosphor-icons/react";
import {Sidebar} from "../components/sidebar";
import {Line, Segment, Station, Target, Tram} from "../utils/types";
import {useSearchParams} from "next/navigation";
import {updateTramProgressInterpolated} from "../utils/dataUtils";
import {Coordinate} from "ol/coordinate";
import Overlay from "../components/overlay";

const fetcher = (url) => fetch(url).then((res) => res.json());

// todo: integrate these somehow, types??
const timeOffset = 0;
const histDate = ""; // ex: 2024-12-01 -> set offset to n days ago
const pollingInterval = 5000;
const fps = 10;

export default function Home() {

	const stationURL = "/api/stations";
	const lineURL = "/api/lines";
	const tramURL = !histDate ? `/api/trams?active=true&timeOffset=${timeOffset}` : `/api/tramsHist?active=true&date=${histDate}&timeOffset=${timeOffset}`;

	const {data: stations, isLoading: stationsLoading} = useSWR(stationURL, fetcher);
	const {data: lines, isLoading: linesLoading} = useSWR(lineURL, fetcher);
	const {data: trams, isLoading: tramsLoading} = useSWR(tramURL, fetcher, {refreshInterval: pollingInterval});
	const [tramsInterpolated, setTramsInterpolated] = useState<Tram[]>([]);

	const searchParams = useSearchParams()
	const {mobile} = useContext(MediaQueryContext);

	const [sidebar, setSidebar] = useState<boolean>(false);
	const [showLines, setShowLines] = useState<boolean>(false);
	const [showStations, setShowStations] = useState<boolean>(true);
	//const [showTrams, setShowTrams] = useState<boolean>(true);
	//const [lineFilter, setLineFilter] = useState<string[]>([]);
	const [clickFilter, setClickFilter] = useState<string[]>(null);

	const [target, setTarget] = useState<Target>();
	const [targetLocation, setTargetLocation] = useState<Coordinate>();
	const [userLocation, setUserLocation] = useState<Coordinate>();

	const overlay = <Overlay target={target} targetLocation={targetLocation} userLocation={userLocation}></Overlay>

	const resetTarget = () => {
		setTarget(null)
		setTargetLocation(null)
		setClickFilter(null)
	}

	const onClick = (target: Target, location: Coordinate) => {
		if (!target) return resetTarget();
		setTarget(target)
		setTargetLocation(location)
		setClickFilter(null)
		if (isTram(target)) setClickFilter([isTram(target).route_name])
		if (isLine(target)) setClickFilter([isLine(target).name])
	}

	const onTargetLocation = (location: Coordinate) => {
		if (target && location) setTargetLocation(location);
		else resetTarget();
	}

	// interpolate trams
	useEffect(() => {
		if (tramsLoading) return;
		const interval = setInterval(() => {
			setTramsInterpolated(updateTramProgressInterpolated(trams, tramsInterpolated, new Date().getTime() + timeOffset));
		}, 1000 / fps);
		return () => {
			clearInterval(interval)
		};
	}, [trams]);

	// update target tram
	useEffect(() => {
		if (!isTram(target)) return;
		let tram = tramsInterpolated.find(t => t.trip_id === isTram(target).trip_id)
		if (!tram) resetTarget();
		setTarget({type: "tram", data: tram})
	}, [tramsInterpolated]);

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
				</Sidebar>}
				{mobile && target && overlay}
			</Grid>
			{/*<button style={{position: "absolute", zIndex: 1000}} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>Mode</button>*/} {/* DEBUG */}
			<Map data={{stations, lines, trams: tramsInterpolated}} onClick={onClick} onUserLocation={setUserLocation} onTargetLocation={onTargetLocation} target={target} options={{stationFilter: showStations ? "ALL" : "NONE", lineFilter: clickFilter || (showLines ? "ALL" : "NONE"), tramFilter: clickFilter || "ALL"}} overlay={!mobile && target && overlay} debug={!!searchParams.get('debug')}></Map>
		</>
	);
}

export function isStation(target: Target) {
	return target?.type === "station" && (target.data as Station);
}

export function isLine(target: Target) {
	return target?.type === "line" && (target.data as Line);
}

export function isSegment(target: Target) {
	return target?.type === "segment" && (target.data as Segment);
}

export function isTram(target: Target) {
	return target?.type === "tram" && (target.data as Tram);
}
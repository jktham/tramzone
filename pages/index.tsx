import useSWR from "swr";
import Map, {ClickTarget} from "../components/map";
import {useContext, useEffect, useState} from "react";
import SEO from "../components/SEO";
import Loading from "../components/loading";
import Grid from "../components/grid";
import {MediaQueryContext} from "./_app";
import {Toolbar, ToolbarButton, FancyControlBox} from "../components/controls";
import { StackSimpleIcon } from "@phosphor-icons/react";
import { LayerControlScreen, Sidebar } from "../components/sidebar";
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
	const [lineFilter, setLineFilter] = useState<string[]>([]);
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

	const toggleLine = (line: string) => {
		if (lineFilter.includes(line))
			setLineFilter(lineFilter.filter(l => l != line));
		else
			setLineFilter([...lineFilter, line]);
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
				<Toolbar style={{gridArea: "controlsL"}}><ToolbarButton onClick={() => setSidebar(!sidebar)}><StackSimpleIcon color={"var(--FG1)"} weight={"bold"} size={16}></StackSimpleIcon></ToolbarButton></Toolbar>
				{sidebar && <Sidebar Icon={StackSimpleIcon} title={"Layers"} onClose={() => setSidebar(false)}>
					<LayerControlScreen lines={lines} lineFilter={lineFilter} toggleLine={toggleLine} showLines={showLines} setShowLines={setShowLines} showStations={showStations} setShowStations={setShowStations}></LayerControlScreen>
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
import styles from "../styles/grid.module.css"
import { PropsWithChildren, useContext, useMemo } from "react";
import {MediaQueryContext} from "../pages/_app";
import { FancyControlBox, ToolbarButton, TramButton } from "./controls";
import { XIcon, Icon } from "@phosphor-icons/react";
import { cn } from "../utils/cn";
import { Line } from "../utils/types";

export function Sidebar({
	children,
	title,
	onClose,
	Icon,
} : {
	title: string,
	onClose: () => void;
	Icon: Icon;
} & PropsWithChildren) {

	const { mobile } = useContext(MediaQueryContext);

	return (
		<div className={cn("flex flex-col gap-6", styles.sidebar)}>
			<div className={"flex flex-row gap-3 w-full h-9 items-center"}>
				<span className={"size-9 flex justify-center items-center"}><Icon className={"fill-fg1"} weight={"bold"} size={16}></Icon></span>
				<h1 className={"grow text-lg font-bold text-fg1"}>{title}</h1>
				<ToolbarButton onClick={onClose}><XIcon className={"fill-fg1"} weight={"bold"} size={16}></XIcon></ToolbarButton>
			</div>
			<div className={cn("w-72")}>
				{children}
			</div>
		</div>
	)
}

export function LayerControlScreen({
	lines,
	lineFilter,
	toggleLine,
	showLines,
	setShowLines,
	showStations,
	setShowStations,
} : {
	lines: Line[];
	lineFilter: string[];
	toggleLine: (line: string) => void;
	showLines: boolean;
	setShowLines: (state: boolean) => void;
	showStations: boolean;
	setShowStations: (state: boolean) => void;
}) {

	return (
		<div className={"flex flex-col gap-6"}>
			<div className={"flex flex-row gap-3"}>
				<FancyControlBox state={showLines} title={"Lines"} onClick={() => setShowLines(!showLines)}>
					<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio={"xMidYMid slice"} viewBox="0 0 158 183" fill="none">
						<g>
							<path vectorEffect="non-scaling-stroke" d="M117.671 -3.99994V24.5001C117.671 49.0001 117.671 48.6083 92.5 73.7797C68.2796 98.0001 68.5 98.0001 30 98.0001H-2" stroke="#EE3897" strokeWidth="3"/>
							<path vectorEffect="non-scaling-stroke" d="M-2.5 111.5L44.5 111.5C74.5 111.5 74.5001 111.5 98.5001 87.5001C118.056 67.944 118 67.944 141 67.944L160 67.944" stroke="#49479D" strokeWidth="3"/>
						</g>
					</svg>
				</FancyControlBox>
				<FancyControlBox state={showStations} title={"Stations"} onClick={() => setShowStations(!showStations)}>
					<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio={"xMidYMid slice"} viewBox="0 0 159 183" fill="none">
						<g>
							<path vectorEffect="non-scaling-stroke" d="M166 56.0004L129.5 56.0004C115.5 56.0004 115.5 56.0004 92.0002 79.5004C67.0006 104.5 67.0002 104.5 45.5002 104.5L-3.5 104.5" stroke="#49479D" strokeWidth="3"/>
							<path vectorEffect="non-scaling-stroke" d="M98 78.5C98 81.2614 95.7614 83.5 93 83.5C90.2386 83.5 88 81.2614 88 78.5C88 75.7386 90.2386 73.5 93 73.5C95.7614 73.5 98 75.7386 98 78.5Z" fill="var(--BG2)" stroke="var(--FG2)" strokeWidth="3"/>
							<path vectorEffect="non-scaling-stroke" d="M35.5 104.5C35.5 107.261 33.2614 109.5 30.5 109.5C27.7386 109.5 25.5 107.261 25.5 104.5C25.5 101.739 27.7386 99.5 30.5 99.5C33.2614 99.5 35.5 101.739 35.5 104.5Z" fill="var(--BG2)" stroke="var(--FG2)" strokeWidth="3"/>
						</g>
					</svg>
				</FancyControlBox>
			</div>

			<div className={"flex flex-row flex-wrap gap-3"}>
				{lines.map((line, i) => (
					<TramButton key={i} state={lineFilter.includes(line.name)} onClick={() => toggleLine(line.name)} color={line.color} name={line.name}/>
				))}
			</div>
		</div>
	)
}
import styles from "../styles/interface.module.css"
import {PropsWithChildren, useContext} from "react";
import {ControlBar, ControlButton} from "./controls";
import {MediaQueryContext} from "../pages/_app";
import {StackSimple} from "@phosphor-icons/react";

export default function Interface({children} : {} & PropsWithChildren) {

	const { mobile } = useContext(MediaQueryContext);

	return <>
		<div className={styles.interface}>
			<ControlBar style={{gridArea: "controlsL"}}><ControlButton><StackSimple color={"var(--FG1)"} weight={"bold"} size={16}></StackSimple></ControlButton></ControlBar>
			{children}
		</div>
	</>
}
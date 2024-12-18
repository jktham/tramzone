import "/styles/globals.css";
import "/styles/main.css";
import {ThemeProvider, useTheme} from "next-themes";
import {createContext, useEffect, useState} from "react";


export const MediaQueryContext = createContext(null);

export default function App({Component, pageProps}) {

	const [mobile, setMobile] = useState(null);
	const [tablet, setTablet] = useState(null);

	const updateQueries = (window : Window) => {
		setMobile(window.matchMedia("screen and (max-width: 50rem)").matches);
		setTablet(window.matchMedia("screen and (max-width: 86rem)").matches);
	};

	useEffect(() => {
		window.addEventListener("resize", () => updateQueries(window));
		updateQueries(window);
		return () => window.removeEventListener("resize", () => updateQueries(window));
	}, []);

	return (
		<>
			<ThemeProvider>
				<ThemeController/>
				<MediaQueryContext.Provider value={{mobile: mobile, tablet: tablet}}>
					<Component {...pageProps} />
				</MediaQueryContext.Provider>
			</ThemeProvider>
		</>
	);
}

function ThemeController({}) {

	const {theme, setTheme} = useTheme();

	const updateTheme = () => {
		const s = new Date()
		const hours = s.getHours()
		//console.log(hours)
		if (hours >= 20 || hours <= 6 ) {
			setTheme("dark")
			//console.log("it is night")
		} else {
			setTheme("light")
			//console.log("it is day")
		}
	}

	useEffect(() => {
		updateTheme();
		const interval = setInterval(updateTheme, 60000);
		return () => clearInterval(interval);
	}, []);

	return <></>
}
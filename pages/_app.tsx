import "/styles/globals.css";
import "/styles/main.css";
import {ThemeProvider, useTheme} from "next-themes";
import {useEffect} from "react";

export default function App({Component, pageProps}) {

	return (
		<>
			<ThemeProvider>
				<ThemeController/>
				<Component {...pageProps} />
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
import "/styles/globals.css";
import "/styles/main.css";

export default function App({Component, pageProps}) {

	return (
		<>
			<Component {...pageProps} />
		</>
	);
}

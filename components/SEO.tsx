import Head from "next/head"
import Script from "next/script"

export default function SEO() {
	return (
		<>
		<Head>
			<meta name="viewport" content="width=device-width, initial-scale=1"/>
			<meta name="description" content="Ech weiss wo dis tram wohnt"/>
			<title>Tramz &lt;3</title>

			<link rel="shortcut icon" href=""/>
			<link rel="manifest" href="manifest.json"/>
		</Head>
		<Script src="/pwacompat.js"/>
		</>
	)
}

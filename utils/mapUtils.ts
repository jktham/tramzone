export function grayscaleLayer(context) {
	let canvas = context.canvas;
	let width = canvas.width;
	let height = canvas.height;
	let imageData = context.getImageData(0, 0, width, height);
	let data = imageData.data;
	for(let i = 0; i < data.length; i += 4){
		let r = data[i];
		let g = data[i + 1];
		let b = data[i + 2];
		// CIE luminance for the RGB
		let v = 0.2126 * r + 0.7152 * g + 0.0722 * b;
		// Show white color instead of black color while loading new tiles:
		if(v === 0.0)
			v=255.0;
		v = 255 - ((255 - v) * 0.6)
		data[i] = v; // Red
		data[i+1] = v; // Green
		data[i+2] = v; // Blue
		data[i+3] = 255; // Alpha
	}
	context.putImageData(imageData,0,0);
}
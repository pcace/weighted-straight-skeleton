# weighted-straight-skeleton

![](https://i.imgur.com/usIo8zU.png)

This is a TypeScript library that wraps the basic functionality of CGAL's [weighted straight skeleton implementation](https://www.cgal.org/2023/05/09/improved_straight_skeleton/) using Wasm (WebAssembly).
You can use this library to generate weighted straight skeletons of polygons with or without holes.

## Installation

`npm i weighted-straight-skeleton`


## Usage

This library supports both arrays of points (`SkeletonBuilder.buildFromPolygon`) and [GeoJSON polygons](https://datatracker.ietf.org/doc/html/rfc7946#autoid-15) (`SkeletonBuilder.buildFromGeoJSON`).

### Input requirements

- Input polygon must have at least one ring.
- The first ring is always the outer ring, and the rest are inner rings.
- Outer rings must be counter-clockwise oriented and inner rings must be clockwise oriented.
- All rings must be weakly simple.
- Each ring must have a duplicate of the first vertex at the end.
- If weights or angles are provided, the number of weights or angles must match the number of vertices in the polygon.

### Example

add to your package.json
```json
	"weighted-straight-skeleton": "github:pcace/weighted-straight-skeleton#main"
``` 
then run `npm install`

#### Using Weights

```typescript
import { SkeletonBuilder, Skeleton } from 'weighted-straight-skeleton'

// Contains two rings: outer and inner.
const polygon = [
	[
		[-1, -1],
		[0, -12],
		[1, -1],
		[12, 0],
		[1, 1],
		[0, 12],
		[-1, 1],
		[-12, 0],
		[-1, -1]
	], [
		[-1, 0],
		[0, 1],
		[1, 0],
		[0, -1],
		[-1, 0]
	]
];

// optionally send weights for each polygon vertex
const weights = [
	[1.5, 1.0, 1.5, 1.8, 1.5, 1.8, 1.5, 1.8, 1.5],
	[1.5, 1.8, 1.5, 1.5, 1.5]
];

// Initialize the Wasm module by calling init() once.
SkeletonBuilder.init().then(() => {
	const result = SkeletonBuilder.buildFromPolygonWithWeights(polygon, weights);
	
	// Check if the skeleton was successfully constructed
	if (result !== null) {
		for (const vertex of result.vertices) {
			// Do something with vertices
		}

		for (const polygon of result.polygons) {
			// Do something with polygons
		}
	}
});
```

#### Using Angles

```typescript
import { SkeletonBuilder, Skeleton } from 'weighted-straight-skeleton'

// Contains two rings: outer and inner.
const polygon = [
	[
		[-1, -1],
		[0, -12],
		[1, -1],
		[12, 0],
		[1, 1],
		[0, 12],
		[-1, 1],
		[-12, 0],
		[-1, -1]
	], [
		[-1, 0],
		[0, 1],
		[1, 0],
		[0, -1],
		[-1, 0]
	]
];

// optionally send angles for each polygon vertex
const angles = [
	[45, 90, 45, 60, 45, 60, 45, 60, 45],
	[45, 60, 45, 45, 45]
];

// Initialize the Wasm module by calling init() once.
SkeletonBuilder.init().then(() => {
	const result = SkeletonBuilder.buildFromPolygonWithAngles(polygon, angles);
	
	// Check if the skeleton was successfully constructed
	if (result !== null) {
		for (const vertex of result.vertices) {
			// Do something with vertices
		}

		for (const polygon of result.polygons) {
			// Do something with polygons
		}
	}
});
```

## Development

Note: Tested with emscripten version 3.1.16

1. Clone this repository.
2. Run `npm i` to install dependencies.
3. Optionally, rebuild the Wasm module:
   1. Install [Emscripten](https://emscripten.org/docs/getting_started/downloads.html) and make sure that it's in your PATH.
   2. `cd src/core`, then `sh ./install_libraries.sh` to download and unpack all dependencies.
   3. `mkdir build && cd build` to create a build directory.
   4. `emcmake cmake ..` to generate the build files.
   5. `emmake make` to build the Wasm module. Rerun this whenever your .cpp files change.
4. Run `npm run build` to build the library or `npm run dev` to start a development server that watches for changes.

## References

* [CGAL straight skeleton user manual](https://doc.cgal.org/latest/Straight_skeleton_2/index.html)

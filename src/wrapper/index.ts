//@ts-ignore
import Module from '../core/build/main.js';

interface WasmModule {
	HEAPU8: Uint8Array;
	HEAPU32: Uint32Array;
	HEAPF32: Float32Array;
	_malloc(size: number): number;
	_free(ptr: number): void;
	_create_weighted_straight_skeleton(ptr: number, weightsPtr: number, rowSizePtr: number, rowCount: number): number;
}

/**
 * Each skeleton vertex is represented by x, y and time. Time can be used to calculate z coordinate.
 */
export type Vertex = [number, number, number];

/**
 * Each polygon is represented by an array of vertex indices.
 */
export type Polygon = number[];

/**
 * Straight skeleton calculation result.
 */
export interface Skeleton {
	vertices: Vertex[];
	polygons: Polygon[];
}

export class SkeletonBuilder {
	private static module: WasmModule = null;

	/**
	 * Initializes the WebAssembly module. Must be called before any other method.
	 */
	public static async init(): Promise<void> {
		return Module().then((library: WasmModule) => {
			this.module = library;
		});
	}

	/**
	 * Builds a skeleton from a GeoJSON polygon.
	 * The polygon must have at least one ring. The first ring is always the outer ring, and the rest are inner rings.
	 * Outer rings must be counter-clockwise oriented and inner rings must be clockwise oriented.
	 * All rings must be weakly simple.
	 * Each ring must have a duplicate of the first vertex at the end.
	 * The weights Array must represent the length of each 
	 * polygonring - 1 like so : [[outerRing.length-1], [holeRing.length - 1]]
	 * @param polygon The GeoJSON polygon.
	 * @param weights The weights for each vertex. 
	 */
	public static buildFromGeoJSONPolygon(polygon: GeoJSON.Polygon, weights?: number[][]): Skeleton {

		this.checkModule();
		return this.buildFromPolygon(polygon.coordinates, weights);
	}

	/**
	 * Builds a skeleton from a polygon represented as an array of rings.
	 * The polygon must have at least one ring. The first ring is always the outer ring, and the rest are inner rings.
	 * Outer rings must be counter-clockwise oriented and inner rings must be clockwise oriented.
	 * All rings must be weakly simple.
	 * Each ring must have a duplicate of the first vertex at the end.
	 * @param coordinates The polygon represented as an array of rings.
	 * @param weights The weights for each vertex.
	 */
	public static buildFromPolygon(coordinates: number[][][], weights?: number[][]): Skeleton {

		if (!weights) {
			weights = coordinates.map(ring => new Array(ring.length).fill(1));
		} else {
			// Validate the weights length
			if (weights.length !== coordinates.length) {
				throw new Error('Weights array length does not match the number of rings in the polygon.');
			}
			for (let i = 0; i < weights.length; i++) {
				if (weights[i].length !== coordinates[i].length - 1) {
					throw new Error(`Weights array length for ring ${i} does not match the number of points in the ring.`);
				}
			}
		}


		this.checkModule();

		const inputBuffer = this.serializeInput(coordinates);
		const inputPtr = this.module._malloc(inputBuffer.byteLength);
		this.module.HEAPU8.set(new Uint8Array(inputBuffer), inputPtr);

		const rowCount = weights.length;

		// Flatten the weights array into a 1D Float32Array
		const flatWeights = weights.flat();
		const weightsArray = new Float32Array(flatWeights);

		// Create an array to store sizes of subarrays
		const rowSizes = new Int32Array(weights.map(row => row.length));

		// Allocate memory in WASM for weights data
		const weightsPtr = this.module._malloc(weightsArray.length * 4); // Each float is 4 bytes
		this.module.HEAPF32.set(weightsArray, weightsPtr / 4);

		// Allocate memory in WASM for row sizes
		const rowSizesPtr = this.module._malloc(rowSizes.length * 4); // Each int is 4 bytes
		this.module.HEAPU32.set(rowSizes, rowSizesPtr / 4);

		const ptr = this.module._create_weighted_straight_skeleton(inputPtr, weightsPtr, rowSizesPtr, rowCount);
		if (ptr === 0) {
			return null;
		}

		let offset = ptr / 4;
		const arrayU32 = this.module.HEAPU32;
		const arrayF32 = this.module.HEAPF32;

		const vertices: Vertex[] = [];
		const polygons: number[][] = [];

		const vertexCount = arrayU32[offset++];

		for (let i = 0; i < vertexCount; i++) {
			const x = arrayF32[offset++];
			const y = arrayF32[offset++];
			const time = arrayF32[offset++];

			vertices.push([x, y, time]);
		}

		let polygonVertexCount = arrayU32[offset++];

		while (polygonVertexCount > 0) {
			const polygon = [];

			for (let i = 0; i < polygonVertexCount; i++) {
				polygon.push(arrayU32[offset++]);
			}

			polygons.push(polygon);
			polygonVertexCount = arrayU32[offset++];
		}

		this.module._free(ptr);
		this.module._free(inputPtr);
		this.module._free(weightsPtr);

		return { vertices, polygons };
	}

	private static checkModule(): void {
		if (this.module === null) {
			throw new Error('The WebAssembly module has not been initialized, call SkeletonBuilder.init() first.');
		}
	}

	private static serializeInput(input: number[][][]): ArrayBuffer {
		let size: number = 1;

		for (const ring of input) {
			size += 1 + (ring.length - 1) * 2;
		}

		const uint32Array = new Uint32Array(size);
		const float32Array = new Float32Array(uint32Array.buffer);
		let offset = 0;

		for (const ring of input) {
			uint32Array[offset++] = ring.length - 1;

			for (let i = 0; i < ring.length - 1; i++) {
				float32Array[offset++] = ring[i][0];
				float32Array[offset++] = ring[i][1];
			}
		}

		uint32Array[offset++] = 0;
		return float32Array.buffer;
	}
}
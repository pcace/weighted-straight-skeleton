//@ts-ignore
import Module from '../core/build/main.js';

interface WasmModule {
    HEAPU8: Uint8Array;
    HEAPU32: Uint32Array;
    HEAPF32: Float32Array;
    _malloc(size: number): number;
    _free(ptr: number): void;
    _create_weighted_straight_skeleton(ptr: number, weightsPtr: number, rowSizePtr: number, rowCount: number, height: number): number;
    _create_angle_straight_skeleton(ptr: number, anglesPtr: number, rowSizePtr: number, rowCount: number, height: number): number;
}

/**
 * Each mesh vertex is represented by x, y and z coordinates.
 */
export type Vertex = [number, number, number];

/**
 * Each face is represented by an array of vertex indices.
 */
export type Face = number[];

/**
 * 3D mesh representation result.
 */
export interface Mesh {
    vertices: Vertex[];
    faces: Face[];
}

export class MeshBuilder {
    private static module: WasmModule = null;

    /**
     * Initializes the WebAssembly module. Must be called before any other method.
     */
    public static async init(): Promise<void> {
        if (this.module) return Promise.resolve();
        
        return new Promise<void>((resolve, reject) => {
            try {
                // Handle ES Module and CommonJS loading patterns
                const modulePromise = typeof Module === 'function' ? Module() : Promise.resolve(Module);
                
                modulePromise.then((library: WasmModule) => {
                    this.module = library;
                    resolve();
                }).catch(reject);
            } catch (error) {
                reject(new Error(`Failed to initialize WebAssembly module: ${error.message}`));
            }
        });
    }

    /**
     * Builds a 3D mesh from a GeoJSON polygon using weights for each edge.
     * The polygon must have at least one ring. The first ring is always the outer ring, and the rest are inner rings.
     * Outer rings must be counter-clockwise oriented and inner rings must be clockwise oriented.
     * All rings must be weakly simple.
     * Each ring must have a duplicate of the first vertex at the end.
     * @param polygon The GeoJSON polygon.
     * @param weights The weights for each edge. 
     * @param height The maximum height of the extrusion.
     */
    public static buildFromGeoJSONPolygonWithWeights(polygon: GeoJSON.Polygon, weights: number[][], height: number = 10): Mesh {
        this.checkModule();
        return this.buildFromPolygonWithWeights(polygon.coordinates, weights, height);
    }

    /**
     * Builds a 3D mesh from a polygon represented as an array of rings using weights for each edge.
     * @param coordinates The polygon represented as an array of rings.
     * @param weights The weights for each edge.
     * @param height The maximum height of the extrusion.
     */
    public static buildFromPolygonWithWeights(coordinates: number[][][], weights: number[][], height: number = 10): Mesh {
        this.validateWeights(coordinates, weights);
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

        const ptr = this.module._create_weighted_straight_skeleton(inputPtr, weightsPtr, rowSizesPtr, rowCount, height);
        
        return this.parseMeshResult(ptr, inputPtr, weightsPtr, rowSizesPtr);
    }

    /**
     * Builds a 3D mesh from a GeoJSON polygon using angles for each edge.
     * @param polygon The GeoJSON polygon.
     * @param angles The angles for each edge (in degrees).
     * @param height The maximum height of the extrusion.
     */
    public static buildFromGeoJSONPolygonWithAngles(polygon: GeoJSON.Polygon, angles: number[][], height = 10): Mesh {
        this.checkModule();
        return this.buildFromPolygonWithAngles(polygon.coordinates, angles, height);
    }

    /**
     * Builds a 3D mesh from a polygon represented as an array of rings using angles for each edge.
     * @param coordinates The polygon represented as an array of rings.
     * @param angles The angles for each edge (in degrees).
     * @param height The maximum height of the extrusion.
     */
    public static buildFromPolygonWithAngles(coordinates: number[][][], angles: number[][], height: number = 10): Mesh {
        this.validateWeights(coordinates, angles);
        this.checkModule();

        const inputBuffer = this.serializeInput(coordinates);
        const inputPtr = this.module._malloc(inputBuffer.byteLength);
        this.module.HEAPU8.set(new Uint8Array(inputBuffer), inputPtr);

        const rowCount = angles.length;

        // Flatten the angles array into a 1D Float32Array
        const flatAngles = angles.flat();
        const anglesArray = new Float32Array(flatAngles);

        // Create an array to store sizes of subarrays
        const rowSizes = new Int32Array(angles.map(row => row.length));

        // Allocate memory in WASM for angles data
        const anglesPtr = this.module._malloc(anglesArray.length * 4); // Each float is 4 bytes
        this.module.HEAPF32.set(anglesArray, anglesPtr / 4);

        // Allocate memory in WASM for row sizes
        const rowSizesPtr = this.module._malloc(rowSizes.length * 4); // Each int is 4 bytes
        this.module.HEAPU32.set(rowSizes, rowSizesPtr / 4);

        const ptr = this.module._create_angle_straight_skeleton(inputPtr, anglesPtr, rowSizesPtr, rowCount, height);
        
        return this.parseMeshResult(ptr, inputPtr, anglesPtr, rowSizesPtr);
    }

    /**
     * Parse the result buffer from WASM into a mesh structure
     */
    private static parseMeshResult(ptr: number, inputPtr: number, valuesPtr: number, rowSizesPtr: number): Mesh {
        if (ptr === 0) {
            this.module._free(inputPtr);
            this.module._free(valuesPtr);
            this.module._free(rowSizesPtr);
            return null;
        }

        let offset = ptr / 4;
        const arrayU32 = this.module.HEAPU32;
        const arrayF32 = this.module.HEAPF32;

        const vertices: Vertex[] = [];
        const faces: number[][] = [];

        const vertexCount = arrayU32[offset++];

        for (let i = 0; i < vertexCount; i++) {
            const x = arrayF32[offset++];
            const y = arrayF32[offset++];
            const z = arrayF32[offset++];

            vertices.push([x, y, z]);
        }

        const faceCount = arrayU32[offset++];
        
        for (let i = 0; i < faceCount; i++) {
            const vertexCount = arrayU32[offset++];
            const face: number[] = [];
            
            for (let j = 0; j < vertexCount; j++) {
                face.push(arrayU32[offset++]);
            }
            
            faces.push(face);
        }

        this.module._free(ptr);
        this.module._free(inputPtr);
        this.module._free(valuesPtr);
        this.module._free(rowSizesPtr);

        return { vertices, faces };
    }

    /**
     * Validate that weights/angles arrays match polygon structure
     */
    private static validateWeights(coordinates: number[][][], values: number[][]): void {
        // Validate the values length
        if (values.length !== coordinates.length) {
            throw new Error('Values array length does not match the number of rings in the polygon.');
        }
        for (let i = 0; i < values.length; i++) {
            if (values[i].length !== coordinates[i].length - 1) {
                throw new Error(`Values array length for ring ${i} does not match the number of points in the ring.`);
            }
        }
    }

    private static checkModule(): void {
        if (this.module === null) {
            throw new Error('The WebAssembly module has not been initialized, call MeshBuilder.init() first.');
        }
    }

    private static serializeInput(input: number[][][]): ArrayBuffer {
        let size = 1;

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
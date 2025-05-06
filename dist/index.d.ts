/**
 * Each mesh vertex is represented by x, y and z coordinates.
 */
type Vertex = [number, number, number];
/**
 * Each face is represented by an array of vertex indices.
 */
type Face = number[];
/**
 * 3D mesh representation result.
 */
interface Mesh {
    vertices: Vertex[];
    faces: Face[];
}
declare class MeshBuilder {
    private static module;
    /**
     * Initializes the WebAssembly module. Must be called before any other method.
     */
    static init(): Promise<void>;
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
    static buildFromGeoJSONPolygonWithWeights(polygon: GeoJSON.Polygon, weights: number[][], height?: number): Mesh;
    /**
     * Builds a 3D mesh from a polygon represented as an array of rings using weights for each edge.
     * @param coordinates The polygon represented as an array of rings.
     * @param weights The weights for each edge.
     * @param height The maximum height of the extrusion.
     */
    static buildFromPolygonWithWeights(coordinates: number[][][], weights: number[][], height?: number): Mesh;
    /**
     * Builds a 3D mesh from a GeoJSON polygon using angles for each edge.
     * @param polygon The GeoJSON polygon.
     * @param angles The angles for each edge (in degrees).
     * @param height The maximum height of the extrusion.
     */
    static buildFromGeoJSONPolygonWithAngles(polygon: GeoJSON.Polygon, angles: number[][], height?: number): Mesh;
    /**
     * Builds a 3D mesh from a polygon represented as an array of rings using angles for each edge.
     * @param coordinates The polygon represented as an array of rings.
     * @param angles The angles for each edge (in degrees).
     * @param height The maximum height of the extrusion.
     */
    static buildFromPolygonWithAngles(coordinates: number[][][], angles: number[][], height?: number): Mesh;
    /**
     * Parse the result buffer from WASM into a mesh structure
     */
    private static parseMeshResult;
    /**
     * Validate that weights/angles arrays match polygon structure
     */
    private static validateWeights;
    private static checkModule;
    private static serializeInput;
}

export { MeshBuilder };
export type { Face, Mesh, Vertex };

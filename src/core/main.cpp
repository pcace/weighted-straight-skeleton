#ifdef EMSCRIPTEN
// #define CGAL_ALWAYS_ROUND_TO_NEAREST
#define CGAL_NO_ASSERTIONS
#define CGAL_NO_PRECONDITIONS
#define CGAL_NO_POSTCONDITIONS
#define CGAL_NO_WARNINGS
#include <emscripten.h>
#include <emscripten/bind.h>
#endif

#include <iostream>
#include <vector>
#include <CGAL/Uncertain.h>
#include <CGAL/enum.h>
#include <CGAL/Exact_predicates_inexact_constructions_kernel.h>
#include <CGAL/Polygon_with_holes_2.h>
#include <CGAL/create_weighted_straight_skeleton_from_polygon_with_holes_2.h>
#include <CGAL/create_straight_skeleton_from_polygon_with_holes_2.h>
#include <CGAL/Straight_skeleton_2/IO/print.h>
#include <CGAL/Surface_mesh.h>
#include <CGAL/extrude_skeleton.h>
#include <boost/shared_ptr.hpp>
#include <cassert>
#include <cmath>

// Override make_certain to fix errors. Not sure why Uncertain doesn't work properly in Wasm environment.
template <>
bool CGAL::Uncertain<bool>::make_certain() const
{
    return _i;
}

template <>
CGAL::Sign CGAL::Uncertain<CGAL::Sign>::make_certain() const
{
    return _i;
}

typedef CGAL::Exact_predicates_inexact_constructions_kernel K;
typedef K::Point_2 Point_2;
typedef K::Point_3 Point_3;
typedef K::FT FT;  // This is likely a double in most implementations
typedef CGAL::Polygon_2<K> Polygon_2;
typedef CGAL::Polygon_with_holes_2<K> Polygon_with_holes;
typedef CGAL::Straight_skeleton_2<K> Ss;
typedef boost::shared_ptr<Ss> SsPtr;
typedef CGAL::Surface_mesh<Point_3> Mesh;
typedef CGAL::Exact_predicates_inexact_constructions_kernel CGAL_KERNEL;

// Serializes a mesh into a format that can be sent to the JS side.
// Format:
// 1. Number of vertices (uint32_t)
// 2. Vertices (x,y,z) as triples of floats
// 3. Number of faces (uint32_t)
// 4. For each face: number of vertices (uint32_t) followed by vertex indices (uint32_t)
void* serialize_mesh(const Mesh& mesh)
{
    if (mesh.num_vertices() == 0)
    {
        return nullptr;
    }

    // Count total size needed
    size_t num_vertices = mesh.num_vertices();
    size_t num_faces = mesh.num_faces();
    size_t total_face_vertices = 0;
    
    for (Mesh::Face_index face_index : mesh.faces())
    {
        for (Mesh::Vertex_index v : CGAL::vertices_around_face(mesh.halfedge(face_index), mesh))
        {
            total_face_vertices++;
        }
    }

    // Calculate total buffer size (in uint32_t units)
    size_t total_size = 1 + (num_vertices * 3) + 1 + num_faces + total_face_vertices;
    
    // Allocate buffer
    uint32_t* data = (uint32_t*)malloc(total_size * sizeof(uint32_t));
    float* data_float = (float*)data;
    size_t index = 0;

    // Store vertex count
    data[index++] = num_vertices;
    
    // Store vertices
    std::vector<Mesh::Vertex_index> vertex_indices;
    for (Mesh::Vertex_index v : mesh.vertices())
    {
        vertex_indices.push_back(v);
        Point_3 p = mesh.point(v);
        data_float[index++] = static_cast<float>(CGAL::to_double(p.x()));
        data_float[index++] = static_cast<float>(CGAL::to_double(p.y()));
        data_float[index++] = static_cast<float>(CGAL::to_double(p.z()));
    }
    
    // Store face count
    data[index++] = num_faces;
    
    // Store faces
    for (Mesh::Face_index face_index : mesh.faces())
    {
        // Count vertices in this face
        size_t face_vertex_count = 0;
        for (Mesh::Vertex_index v : CGAL::vertices_around_face(mesh.halfedge(face_index), mesh))
        {
            face_vertex_count++;
        }
        
        // Store vertex count for this face
        data[index++] = face_vertex_count;
        
        // Store vertex indices for this face
        for (Mesh::Vertex_index v : CGAL::vertices_around_face(mesh.halfedge(face_index), mesh))
        {
            // Find the index of the vertex in our vertex_indices array
            auto it = std::find(vertex_indices.begin(), vertex_indices.end(), v);
            data[index++] = std::distance(vertex_indices.begin(), it);
        }
    }
    
    return data;
}

// Decodes rings from data and generates a polygon with holes
Polygon_with_holes decode_polygon(void* data)
{
    uint32_t* data_uint32 = (uint32_t*)data;
    uint32_t points = data_uint32[0];

    assert(points != 0);
    assert(points > 2);

    ++data_uint32;

    Polygon_2 outer;
    Polygon_2 hole;
    Polygon_with_holes poly;
    bool outer_set = false;

    while (points != 0)
    {
        Polygon_2* target = outer_set ? &hole : &outer;

        for (long i = 0; i < points; i++)
        {
            float x = *((float*)data_uint32 + i * 2);
            float y = *((float*)data_uint32 + i * 2 + 1);

            target->push_back(Point_2(x, y));
        }

        data_uint32 += points * 2;

        points = data_uint32[0];

        ++data_uint32;

        if (!outer_set)
        {
            assert(outer.is_counterclockwise_oriented());
            poly = Polygon_with_holes(outer);
            outer_set = true;
        }
        else
        {
            assert(hole.is_clockwise_oriented());
            poly.add_hole(hole);
            hole.clear();
        }
    }

    return poly;
}

// Generate a 3D mesh from a polygon with holes, using either angles or weights
Mesh generate_extruded_mesh(const Polygon_with_holes& pwh, 
                          const std::vector<std::vector<double>>& values,
                          bool use_angles,
                          double height)
{
    Mesh mesh;
    
    if (use_angles)
        CGAL::extrude_skeleton(pwh, mesh, CGAL::parameters::angles(values).maximum_height(height));
    else
        CGAL::extrude_skeleton(pwh, mesh, CGAL::parameters::weights(values).maximum_height(height));
        
    return mesh;
}

extern "C"
{
    EMSCRIPTEN_KEEPALIVE
    void* create_weighted_straight_skeleton(void* data, float* weightsPtr, unsigned int* rowSizesPtr, unsigned int rowCount, float height)
    {
        std::vector<std::vector<double>> polygonWeights;

        unsigned int offset = 0;
        for (unsigned int i = 0; i < rowCount; ++i)
        {
            unsigned int rowSize = rowSizesPtr[i];
            
            // Convert float weights to double
            std::vector<double> row;
            row.reserve(rowSize);
            for (unsigned int j = 0; j < rowSize; ++j) {
                row.push_back(static_cast<double>(weightsPtr[offset + j]));
            }
            
            polygonWeights.push_back(std::move(row));
            offset += rowSize;
        }

        Polygon_with_holes pwh = decode_polygon(data);
        Mesh mesh = generate_extruded_mesh(pwh, polygonWeights, false, static_cast<double>(height));

        return serialize_mesh(mesh);
    }
    
    EMSCRIPTEN_KEEPALIVE
    void* create_angle_straight_skeleton(void* data, float* anglesPtr, unsigned int* rowSizesPtr, unsigned int rowCount, float height)
    {
        std::vector<std::vector<double>> polygonAngles;

        unsigned int offset = 0;
        for (unsigned int i = 0; i < rowCount; ++i)
        {
            unsigned int rowSize = rowSizesPtr[i];
            
            // Convert float angles to double
            std::vector<double> row;
            row.reserve(rowSize);
            for (unsigned int j = 0; j < rowSize; ++j) {
                row.push_back(static_cast<double>(anglesPtr[offset + j]));
            }
            
            polygonAngles.push_back(std::move(row));
            offset += rowSize;
        }

        Polygon_with_holes pwh = decode_polygon(data);
        Mesh mesh = generate_extruded_mesh(pwh, polygonAngles, true, static_cast<double>(height));

        return serialize_mesh(mesh);
    }
}
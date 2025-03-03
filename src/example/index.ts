import { Mesh, MeshBuilder } from '../wrapper';
import { isPolygon, } from "geojson-validation";
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const samples = [{
    polygon: {
        type: "Polygon",
        coordinates: [[[0, 0], [10, 0], [10, 1], [8, 5], [8, 3], [0, 0]]]
    },
    weights: [[0.1, 1, 1, 1, 80]],
    angles: [[45, 60, 89, 89, 89]],
    height: 10
}];

let activeMesh: Mesh = null;
let meshBox: { minX: number, minY: number, maxX: number, maxY: number } = null;
let useAngles = false;

const updateMeshBox = () => {
    if (activeMesh === null) {
        meshBox = null;
        return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const vertex of activeMesh.vertices) {
        minX = Math.min(minX, vertex[0]);
        minY = Math.min(minY, vertex[1]);
        maxX = Math.max(maxX, vertex[0]);
        maxY = Math.max(maxY, vertex[1]);
    }

    meshBox = { minX, minY, maxX, maxY };
};

MeshBuilder.init().then(() => {
    // 2D canvas für die Grundfläche

    const canvas2d = document.getElementById('canvas2d') as HTMLCanvasElement;
    const ctx = canvas2d.getContext('2d');

    const draw2d = () => {
        if (ctx) {
            ctx.fillStyle = '#eee';
            ctx.fillRect(0, 0, canvas2d.width, canvas2d.height);

            if (activeMesh === null) {
                return;
            }

            const padding = 15 * window.devicePixelRatio;
            const scale = Math.min(
                (canvas2d.width - padding * 2) / (meshBox.maxX - meshBox.minX),
                (canvas2d.height - padding * 2) / (meshBox.maxY - meshBox.minY)
            );
            const offsetX = (canvas2d.width - (meshBox.maxX - meshBox.minX) * scale) / 2;
            const offsetY = (canvas2d.height - (meshBox.maxY - meshBox.minY) * scale) / 2;

            // Zeichne die 2D Projektion
            ctx.strokeStyle = '#000';
            ctx.lineWidth = window.devicePixelRatio;
            ctx.fillStyle = '#ffb6e9';

            // Zeichne nur die Polygone, die zum Boden gehören (z=0)
            const groundFaces = activeMesh.faces.filter(face => {
                // Überprüfe, ob alle Vertices dieser Face auf z=0 liegen
                return face.every(vertexIdx => activeMesh.vertices[vertexIdx][2] < 0.001);
            });

            for (const face of groundFaces) {
                ctx.beginPath();

                for (let i = 0; i < face.length; i++) {
                    const vertex = activeMesh.vertices[face[i]];
                    const x = (vertex[0] - meshBox.minX) * scale + offsetX;
                    const y = (vertex[1] - meshBox.minY) * scale + offsetY;

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }

                ctx.closePath();
                ctx.stroke();
                ctx.fill();
            }
        }
    };

    const onCanvas2dResize = () => {
        canvas2d.width = canvas2d.clientWidth * window.devicePixelRatio;
        canvas2d.height = canvas2d.clientHeight * window.devicePixelRatio;
        draw2d();
    };

    new ResizeObserver(onCanvas2dResize).observe(canvas2d);

    // 3D canvas für die 3D-Ansicht

    const canvas3d = document.getElementById('canvas3d') as HTMLCanvasElement;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeeeeee);
    const camera = new THREE.PerspectiveCamera(25, canvas3d.clientWidth / canvas3d.clientHeight, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({
        canvas: canvas3d,
        antialias: true
    });
    const controls = new OrbitControls(camera, renderer.domElement);
    const light = new THREE.DirectionalLight(0xffffff, 0.5);
    light.position.set(1, 1, -0.5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    camera.position.set(1, 2, 1);
    controls.update();

    const onCanvas3dResize = () => {
        canvas3d.width = canvas3d.clientWidth * window.devicePixelRatio;
        canvas3d.height = canvas3d.clientHeight * window.devicePixelRatio;

        renderer.setViewport(0, 0, canvas3d.width, canvas3d.height);
        camera.aspect = canvas3d.clientWidth / canvas3d.clientHeight;
        camera.updateProjectionMatrix();
    };

    new ResizeObserver(onCanvas3dResize).observe(canvas3d);

    const material = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xffb6e9),
        side: THREE.DoubleSide,
        flatShading: true
    });
    const parent = new THREE.Object3D();
    scene.add(parent);

    const animate = () => {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    };
    animate();

    const draw3d = () => {
        // Entferne alle vorhandenen Meshes
        parent.remove(...parent.children);

        if (activeMesh === null) {
            return;
        }

        // Zentriere das Modell
        const offset = new THREE.Vector3(
            -(meshBox.maxX + meshBox.minX) / 2,
            -(meshBox.maxY + meshBox.minY) / 2,
            0
        );
        const scale = 1 / Math.max(meshBox.maxX - meshBox.minX, meshBox.maxY - meshBox.minY);

        // Erstelle die Geometrie direkt aus den Faces
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const normals = [];

        // Für jedes Face...
        for (const face of activeMesh.faces) {
            // Wir müssen Dreiecke erstellen (Triangulation)
            // Einfache Fan-Triangulation für konvexe Polygone
            for (let i = 1; i < face.length - 1; i++) {
                // Dreieck: [0, i, i+1]
                const v0 = activeMesh.vertices[face[0]];
                const v1 = activeMesh.vertices[face[i]];
                const v2 = activeMesh.vertices[face[i + 1]];

                // Berechne die Face-Normal (für flat shading)
                const vA = new THREE.Vector3(v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]);
                const vB = new THREE.Vector3(v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]);
                const normal = new THREE.Vector3().crossVectors(vA, vB).normalize();

                // Füge die Vertices zum Array hinzu
                vertices.push(
                    (v0[0] + offset.x) * scale, (v0[1] + offset.y) * scale, v0[2] * scale,
                    (v1[0] + offset.x) * scale, (v1[1] + offset.y) * scale, v1[2] * scale,
                    (v2[0] + offset.x) * scale, (v2[1] + offset.y) * scale, v2[2] * scale
                );

                // Füge für jede Vertex die gleiche Normal hinzu (flat shading)
                normals.push(
                    normal.x, normal.y, normal.z,
                    normal.x, normal.y, normal.z,
                    normal.x, normal.y, normal.z
                );
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));

        const mesh = new THREE.Mesh(geometry, material);
        parent.add(mesh);

        // Zusätzliches Grid zur Orientierung
        const grid = new THREE.GridHelper(1, 10);
        grid.position.y = -0.01; // Leicht unter die Basis setzen
        parent.add(grid);

        camera.position.set(1, 2, 1);
        controls.update();
    };

    // UI-Elemente und Event-Handler

    const updateButton = document.getElementById('update');
    const angleToggle = document.getElementById('useAngles') as HTMLInputElement;

    if (angleToggle) {
        angleToggle.addEventListener('change', () => {
            useAngles = angleToggle.checked;
        });
    }

    updateButton.addEventListener('click', () => {
        let inputJSON: any;

        try {
            inputJSON = JSON.parse((<HTMLTextAreaElement>document.getElementById('input')).value);
        } catch (e) {
            alert(`Ungültiges JSON: ${e.message}`);
            console.error(e);
            return;
        }

        const isValid = isPolygon(inputJSON.polygon);

        if (!isValid) {
            alert('Ungültiges GeoJSON-Polygon');
            return;
        }

        let mesh: Mesh;
        const startTime = performance.now();
        const height = inputJSON.height || 10;

        try {
            if (useAngles && inputJSON.angles) {
                mesh = MeshBuilder.buildFromGeoJSONPolygonWithAngles(
                    inputJSON.polygon, 
                    inputJSON.angles, 
                    height
                );
            } else {
                mesh = MeshBuilder.buildFromGeoJSONPolygonWithWeights(
                    inputJSON.polygon, 
                    inputJSON.weights, 
                    height
                );
            }
        } catch (e) {
            alert(`Wasm-Modul hat einen Fehler geworfen: ${e.message}`);
            console.error(e);
            return;
        }

        if (mesh === null) {
            alert('Wasm-Modul hat null zurückgegeben');
            return;
        }

        const endTime = performance.now();

        document.getElementById('time').innerHTML = `${(endTime - startTime).toFixed(2)} ms`;

        activeMesh = mesh;
        updateMeshBox();
        draw2d();
        draw3d();
    });

    const sampleButtons = document.getElementsByClassName('sample');

    for (let i = 0; i < sampleButtons.length; i++) {
        sampleButtons[i].addEventListener('click', () => {
            const id = sampleButtons[i].getAttribute('data-sample');
            const input = JSON.stringify(samples[parseInt(id)], null, 4);

            (<HTMLTextAreaElement>document.getElementById('input')).value = input;

            updateButton.click();
        });
    }

    // Starte mit dem ersten Sample
    (sampleButtons[0] as HTMLButtonElement).click();
});
/**
 * viewer-3d.js — Three.js 3D mosaic viewer
 *
 * Renders the LEGO mosaic as an interactive 3D scene with studs/tiles,
 * lighting, and orbit controls. Extracted from result.js for modularity.
 */
import { getState } from '../store.js';

const state = new Proxy({}, {
    get(target, prop) { return getState()[prop]; },
    set(target, prop, value) { getState()[prop] = value; return true; }
});

// ═════════════════════════════════════════════════
//  3D WEBGL IMPLEMENTATION (THREE.JS)
// ═════════════════════════════════════════════════
let scene3d, camera3d, renderer3d, controls3d, mosaicGroup;

export function init3DScene() {
    const container = document.getElementById('3d-canvas-container');
    if (!container) return;

    // Measure container — use offsetWidth for reliable layout-computed size
    let w = container.offsetWidth || container.parentElement?.offsetWidth || 800;
    let h = container.offsetHeight || w; // aspect-square → h equals w

    // Scene setup
    scene3d = new THREE.Scene();
    scene3d.background = new THREE.Color('#101216');

    // Camera
    camera3d = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
    camera3d.position.set(0, -60, 50);
    camera3d.lookAt(0, 0, 0);

    // Renderer — explicit pixel-perfect size
    renderer3d = new THREE.WebGLRenderer({ antialias: true });
    renderer3d.setSize(w, h);
    renderer3d.setPixelRatio(window.devicePixelRatio);
    renderer3d.shadowMap.enabled = true;
    renderer3d.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer3d.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene3d.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(50, -50, 100);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.left = -80;
    dirLight.shadow.camera.right = 80;
    dirLight.shadow.camera.top = 80;
    dirLight.shadow.camera.bottom = -80;
    scene3d.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xccddff, 0.4);
    fillLight.position.set(-50, 50, 50);
    scene3d.add(fillLight);

    // Controls
    controls3d = new THREE.OrbitControls(camera3d, renderer3d.domElement);
    controls3d.enableDamping = true;
    controls3d.dampingFactor = 0.05;
    controls3d.target.set(0, 0, 0);
    controls3d.update();

    mosaicGroup = new THREE.Group();
    scene3d.add(mosaicGroup);

    // Resize handler
    window.addEventListener('resize', () => {
        const c = document.getElementById('3d-canvas-container');
        if (!c || c.style.display === 'none') return;
        const rw = c.offsetWidth || 800;
        const rh = c.offsetHeight || rw;
        camera3d.aspect = rw / rh;
        camera3d.updateProjectionMatrix();
        renderer3d.setSize(rw, rh);
    });

    // Animation Loop
    const animate = () => {
        requestAnimationFrame(animate);
        if (controls3d) controls3d.update();
        if (renderer3d && scene3d && camera3d) renderer3d.render(scene3d, camera3d);
    };
    animate();

    window.update3DMosaic();
}

window.update3DMosaic = function() {
    if (!scene3d || !state.mosaicData) return;
    
    const { grid, colors, width, height } = state.mosaicData;
    
    // Clear previous
    while(mosaicGroup.children.length > 0){ 
        const obj = mosaicGroup.children[0];
        mosaicGroup.remove(obj); 
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
            else obj.material.dispose();
        }
    }
    
    // Lego sets often use flat tiles (Elvis/Marilyn) vs round plates (Batman/StarWars)
    const TILE_SETS = ['31204', '31197']; // Elvis, Warhol
    let useTiles = false;
    if (state.setSelections && state.setSelections.length > 0) {
        useTiles = state.setSelections.some(s => s.set && TILE_SETS.includes(s.set.id));
    }
    
    // Standard Lego dimensions
    const studSpacing = 1.0; 
    const studRadius = 0.35;
    const basePlateThickness = 0.5;
    const tileThickness = 0.32;
    const studHeight = 0.18;
    
    // Center alignment
    const wOffset = (width * studSpacing) / 2 - (studSpacing / 2);
    const hOffset = (height * studSpacing) / 2 - (studSpacing / 2);
    
    // Create base plate (black)
    const baseGeom = new THREE.BoxGeometry(width * studSpacing, height * studSpacing, basePlateThickness);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x05131D, roughness: 0.8, metalness: 0.1 });
    const baseMesh = new THREE.Mesh(baseGeom, baseMat);
    baseMesh.position.z = -basePlateThickness / 2;
    baseMesh.receiveShadow = true;
    mosaicGroup.add(baseMesh);
    
    // Create frame (black border around the plate)
    const frameThickness = 0.8;
    const frameDepth = 1.5;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x05131D, roughness: 0.6 });
    
    // Top/Bottom frame parts
    const frameHGeom = new THREE.BoxGeometry(width * studSpacing + frameThickness * 2, frameThickness, frameDepth);
    const frameMeshTop = new THREE.Mesh(frameHGeom, frameMat);
    frameMeshTop.position.set(0, height * studSpacing / 2 + frameThickness / 2, frameDepth / 2 - basePlateThickness);
    frameMeshTop.castShadow = true;
    frameMeshTop.receiveShadow = true;
    
    const frameMeshBot = new THREE.Mesh(frameHGeom, frameMat);
    frameMeshBot.position.set(0, -height * studSpacing / 2 - frameThickness / 2, frameDepth / 2 - basePlateThickness);
    frameMeshBot.castShadow = true;
    frameMeshBot.receiveShadow = true;
    
    // Left/Right frame parts
    const frameVGeom = new THREE.BoxGeometry(frameThickness, height * studSpacing, frameDepth);
    const frameMeshLeft = new THREE.Mesh(frameVGeom, frameMat);
    frameMeshLeft.position.set(-width * studSpacing / 2 - frameThickness / 2, 0, frameDepth / 2 - basePlateThickness);
    frameMeshLeft.castShadow = true;
    frameMeshLeft.receiveShadow = true;
    
    const frameMeshRight = new THREE.Mesh(frameVGeom, frameMat);
    frameMeshRight.position.set(width * studSpacing / 2 + frameThickness / 2, 0, frameDepth / 2 - basePlateThickness);
    frameMeshRight.castShadow = true;
    frameMeshRight.receiveShadow = true;
    
    mosaicGroup.add(frameMeshTop, frameMeshBot, frameMeshLeft, frameMeshRight);

    const geometries = {};
    const materials = {};
    const instancedBases = {};
    const instancedStuds = {};
    
    // Choose base geometry (round plate for normal, flat tile for useTiles)
    const baseCylGeom = useTiles 
        ? new THREE.BoxGeometry(0.96, 0.96, tileThickness) 
        : new THREE.CylinderGeometry(0.48, 0.48, tileThickness, 16);
        
    // Always translate to rest on Z=0
    if (!useTiles) {
        baseCylGeom.rotateX(Math.PI / 2);
    }
    
    const studGeom = new THREE.CylinderGeometry(studRadius, studRadius, studHeight, 12);
    studGeom.rotateX(Math.PI / 2);
    studGeom.translate(0, 0, tileThickness / 2 + studHeight / 2);
    
    const colorCounts = new Array(colors.length).fill(0);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            colorCounts[grid[y][x]]++;
        }
    }
    
    for (let i = 0; i < colors.length; i++) {
        if (colorCounts[i] === 0) continue;
        
        const mat = new THREE.MeshStandardMaterial({ 
            color: new THREE.Color(colors[i].hex), 
            roughness: 0.3, 
            metalness: 0.1 
        });
        
        const imeshBase = new THREE.InstancedMesh(baseCylGeom, mat, colorCounts[i]);
        imeshBase.castShadow = true;
        imeshBase.receiveShadow = true;
        instancedBases[i] = imeshBase;
        mosaicGroup.add(imeshBase);
        
        if (!useTiles) {
            const imeshStud = new THREE.InstancedMesh(studGeom, mat, colorCounts[i]);
            imeshStud.castShadow = true;
            imeshStud.receiveShadow = true;
            instancedStuds[i] = imeshStud;
            mosaicGroup.add(imeshStud);
        }
    }
    
    const dummy = new THREE.Object3D();
    const counters = new Array(colors.length).fill(0);
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const ci = grid[y][x];
            dummy.position.set(
                x * studSpacing - wOffset,
                -(y * studSpacing - hOffset),
                tileThickness / 2
            );
            dummy.updateMatrix();
            instancedBases[ci].setMatrixAt(counters[ci], dummy.matrix);
            if (!useTiles) {
                instancedStuds[ci].setMatrixAt(counters[ci], dummy.matrix);
            }
            counters[ci]++;
        }
    }
    
    Object.values(instancedBases).forEach(imesh => imesh.instanceMatrix.needsUpdate = true);
    if (!useTiles) {
        Object.values(instancedStuds).forEach(imesh => imesh.instanceMatrix.needsUpdate = true);
    }
    
    // Initial camera position. Look straightforward at the mosaic.
    const maxDim = Math.max(width, height) * studSpacing;
    camera3d.position.set(0, -maxDim * 0.8, maxDim * 1.0);
    camera3d.lookAt(0, 0, 0);
    controls3d.target.set(0, 0, 0);
    controls3d.update();

    const container = document.getElementById('3d-canvas-container');
    const containerWidth = (container && container.offsetWidth) || 800;
    const containerHeight = (container && container.offsetHeight) || containerWidth;
    camera3d.aspect = containerWidth / containerHeight;
    camera3d.updateProjectionMatrix();
    renderer3d.setSize(containerWidth, containerHeight);
};

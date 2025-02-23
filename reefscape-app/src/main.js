import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import Stats from 'three/examples/jsm/libs/stats.module';

// Global variables
let scene, camera, renderer, model;
const keyState = {};
const moveSpeed = 15;
const sprintMultiplier = 2;
const velocity = new THREE.Vector3();
const clock = new THREE.Clock();
let pointerLocked = false;
let isSprinting = false;
let stats;

// DOM elements
const loadingScreen = document.getElementById('loadingScreen');
const progressFill = document.getElementById('progressFill');

// Initialize
init();
loadModel();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    // Optimized camera setup
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 500);
    camera.position.set(0, 5, 10);
    camera.rotation.order = 'YXZ';

    renderer = new THREE.WebGLRenderer({
        antialias: false,
        powerPreference: "high-performance",
        stencil: false,
        depth: true,
        logarithmicDepthBuffer: true // Helps with depth precision
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limit pixel ratio
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = true;
    document.body.appendChild(renderer.domElement);

    // Initialize Stats
    stats = new Stats();
    document.body.appendChild(stats.dom);

    // Simplified lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1));

    // Event listeners
    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousemove', onMouseMove, false);
    document.addEventListener('click', () => renderer.domElement.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
        pointerLocked = document.pointerLockElement === renderer.domElement;
    });
}

function onKeyDown(e) {
  keyState[e.code] = true;
  if (e.code === 'ShiftLeft') isSprinting = true;
}

function onKeyUp(e) {
  keyState[e.code] = false;
  if (e.code === 'ShiftLeft') isSprinting = false;
}

function updateLoadingProgress(progress) {
  const percent = Math.floor(progress * 100);
  if (loadingScreen && progressFill) {
      loadingScreen.firstElementChild.textContent = `Loading: ${percent}%`;
      progressFill.style.width = `${percent}%`;
  }
}

function loadModel() {
    const manager = new THREE.LoadingManager();
    
    manager.onProgress = (url, loaded, total) => {
        updateLoadingProgress(loaded / total);
    };

    manager.onLoad = () => {
        loadingScreen.style.display = 'none';
    };

    manager.onError = (url) => {
        console.error('Error loading:', url);
        loadingScreen.firstElementChild.textContent = 'Error loading model';
    };

    const loader = new GLTFLoader(manager);
    
    loader.load('/reefscape_arena.gltf', gltf => {
        model = gltf.scene;
        
        // Fix model orientation
        model.rotation.x = -Math.PI / 2; // Rotate 90 degrees around X axis to make "up" align with Y
        
        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center); // Center the model at origin
        
        // Adjust model scale if needed
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 100) {
            const scale = 100 / maxDim;
            model.scale.multiplyScalar(scale);
        }

        scene.add(model);
        
        // Optimize model
        model.traverse(child => {
            if (child.isMesh) {
                // Optimize materials
                child.material.dithering = false;
                child.material.precision = 'lowp';
                child.material.fog = false;
                child.material.flatShading = true;
                child.material.needsUpdate = true;
                
                // Disable unnecessary features
                child.castShadow = false;
                child.receiveShadow = false;
                child.frustumCulled = true;
                
                // Optimize geometry
                if (child.geometry) {
                    child.geometry.computeBoundingSphere();
                    child.geometry.computeVertexNormals();
                    child.geometry.attributes.position.usage = THREE.StaticDrawUsage;
                    if (child.geometry.index) {
                        child.geometry.index.usage = THREE.StaticDrawUsage;
                    }
                }
            }
        });

        // Move camera to a good starting position relative to the model
        const modelBox = new THREE.Box3().setFromObject(model);
        const modelSize = modelBox.getSize(new THREE.Vector3());
        camera.position.set(0, modelSize.y * 0.5, modelSize.z * 1.5);
        camera.lookAt(0, 0, 0);
    });
}

// Rest of the movement and control functions remain the same...

function updateMovement(deltaTime) {
    if (!pointerLocked) return;

    velocity.set(0, 0, 0);

    // Get forward and right directions from camera
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    
    // Extract the forward and right vectors from camera's matrix
    camera.matrix.extractBasis(right, new THREE.Vector3(), forward);
    forward.negate(); // Negate because we want forward to be where the camera is looking
    
    // Zero out Y component to keep movement horizontal
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    // Apply movement
    if (keyState['KeyW']) velocity.add(forward);
    if (keyState['KeyS']) velocity.sub(forward);
    if (keyState['KeyA']) velocity.sub(right);
    if (keyState['KeyD']) velocity.add(right);
    if (keyState['Space']) velocity.y += 1;
    if (keyState['ShiftLeft'] || keyState['ShiftRight']) velocity.y -= 1;

    if (velocity.length() > 0) {
        velocity.normalize();
        let currentSpeed = moveSpeed;
        
        if (isSprinting) {
            currentSpeed *= sprintMultiplier;
        }
        
        velocity.multiplyScalar(currentSpeed * deltaTime);
        camera.position.add(velocity);
    }
}

function onMouseMove(event) {
    if (!pointerLocked) return;

    const sensitivity = 0.002;
    
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    
    euler.y -= event.movementX * sensitivity;
    euler.x -= event.movementY * sensitivity;
    
    // Clamp vertical rotation
    euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, euler.x));
    
    camera.quaternion.setFromEuler(euler);
}

function animate() {
  requestAnimationFrame(animate);
  
  stats.begin();
  const deltaTime = Math.min(clock.getDelta(), 0.1);
  
  updateMovement(deltaTime);

  renderer.render(scene, camera);
  stats.end();
}

document.addEventListener('wheel', event => {
  if (event.deltaY < 0) {
      scrollMultiplier = Math.min(scrollMultiplier + scrollStep, maxScrollSpeed);
  } else {
      scrollMultiplier = Math.max(scrollMultiplier - scrollStep, minScrollSpeed);
  }
});

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
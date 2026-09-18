let scene, camera, renderer;
let isPlaying = false;
let isInventoryOpen = false;

let player = {
    hp: 100,
    speed: 0.13,
    radius: 0.45,
    position: new THREE.Vector3(0, 1.6, 15)
};

const weapons = [
    { name: "Pistola Tática", ammo: 12, maxAmmo: 12, damage: 25, fireRate: 400, reloadTime: 1500, spread: 0.005, unlocked: true },
    { name: "Submetralhadora", ammo: 30, maxAmmo: 30, damage: 15, fireRate: 110, reloadTime: 2000, spread: 0.02, unlocked: true },
    { name: "Espingarda Calibre 12", ammo: 6, maxAmmo: 6, damage: 90, fireRate: 900, reloadTime: 2500, spread: 0.06, unlocked: true }
];

let currentWeaponIndex = 0;
let lastShotTime = 0;

let gameStats = {
    kills: 0,
    score: 0,
    survivalTime: 0,
    itemsCollected: 0,
    totalItems: 10,
    comboCount: 0,
    comboTimer: 0
};

let boss = {
    active: false,
    mesh: null,
    reactorMesh: null,
    hp: 1200,
    maxHp: 1200,
    speed: 0.048,
    attackCooldown: 0,
    rangedCooldown: 0,
    isEnraged: false,
    animTimer: 0
};

let bossProjectiles = [];
let blinkingLights = [];

let inventory = [
    { id: 'ammo_pistol', name: 'Munição 9mm', count: 24, type: 'ammo', desc: 'Caixa de munição padrão.' },
    { id: 'first_aid', name: 'Kit Médico', count: 2, type: 'healing', desc: 'Restaura +50 de HP.' },
    null, null, null, null, null, null, null, null, null, null
];
let selectedInventorySlot = null;

const keys = { w: false, a: false, s: false, d: false };
let mouseLook = { x: 0, y: 0 };
const mouseSensitivity = 0.002;

const mainMenu = document.getElementById('main-menu');
const hud = document.getElementById('hud');
const gameOverScreen = document.getElementById('gameover-screen');
const inventoryScreen = document.getElementById('inventory-screen');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const hpBar = document.getElementById('hp-bar');
const hpText = document.getElementById('hp-text');
const ammoText = document.getElementById('ammo-text');
const weaponNameText = document.getElementById('weapon-text');
const interactionPrompt = document.getElementById('interaction-prompt');
const regionTracker = document.getElementById('region-tracker');

const killsText = document.getElementById('kills-text');
const scoreText = document.getElementById('score-text');
const timeText = document.getElementById('time-text');
const itemsCollectedText = document.getElementById('items-collected-text');

const bossHud = document.getElementById('boss-hud');
const bossHpBar = document.getElementById('boss-hp-bar');
const bossHpVal = document.getElementById('boss-hp-val');

let reloadPromptText, weaponMesh, muzzleFlashMesh, playerFillLight;
let colliders = [];
let interactiveItems = [];
let zombies = [];
let environmentalParticles = [];
let raycaster = new THREE.Raycaster();

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);

document.getElementById('inv-close-btn').addEventListener('click', toggleInventory);
document.getElementById('inv-use-btn').addEventListener('click', useSelectedInventoryItem);
document.getElementById('inv-combine-btn').addEventListener('click', combineSelectedInventoryItems);
document.getElementById('inv-discard-btn').addEventListener('click', discardSelectedInventoryItem);

function startGame() {
    mainMenu.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    document.body.requestPointerLock();
    
    if (!scene) {
        initThreeJS();
        initWeaponModel();
    } else {
        resetGameStates();
    }
    isPlaying = true;
}

function restartGame() {
    resetGameStates();
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    document.body.requestPointerLock();
    isPlaying = true;
}

function resetGameStates() {
    player.hp = 100;
    player.position.set(0, 1.6, 15);
    camera.position.copy(player.position);
    camera.rotation.set(0, 0, 0);
    mouseLook.x = 0;
    mouseLook.y = 0;
    
    weapons[0].ammo = 12;
    weapons[1].ammo = 30;
    weapons[2].ammo = 6;
    currentWeaponIndex = 0;

    gameStats = {
        kills: 0,
        score: 0,
        survivalTime: 0,
        itemsCollected: 0,
        totalItems: interactiveItems.length,
        comboCount: 0,
        comboTimer: 0
    };

    zombies.forEach(z => scene.remove(z.mesh));
    zombies = [];
    spawnInitialZombies();

    removeBoss();
    updateHUD();
}

function removeBoss() {
    if (boss.mesh) {
        scene.remove(boss.mesh);
        boss.mesh = null;
    }
    boss.active = false;
    bossHud.classList.add('hidden');
}

function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0c14);
    scene.fog = new THREE.FogExp2(0x0a0c14, 0.022);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.copy(player.position);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x28324a, 0.85);
    scene.add(ambientLight);

    const moonLight = new THREE.DirectionalLight(0x6688cc, 0.7);
    moonLight.position.set(30, 60, 30);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    moonLight.shadow.bias = -0.0005;
    scene.add(moonLight);

    playerFillLight = new THREE.PointLight(0xffeedd, 0.9, 12, 2.0);
    playerFillLight.position.set(0, 0, 0);
    camera.add(playerFillLight);

    buildOpenWorldMap();
    initEnvironmentalParticles();
    createReloadPrompt();
    spawnInitialZombies();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('resize', onWindowResize);

    animate();
}

function createReloadPrompt() {
    reloadPromptText = document.createElement('div');
    reloadPromptText.style.cssText = 'position:absolute; bottom:25%; left:50%; transform:translateX(-50%); color:#ff3333; font-weight:bold; letter-spacing:2px; display:none; font-family:monospace; text-shadow:0 0 8px rgba(255,0,0,0.8);';
    reloadPromptText.innerText = 'RECARREGANDO...';
    hud.appendChild(reloadPromptText);
}

function initWeaponModel() {
    const weaponGroup = new THREE.Group();
    const barrelGeo = new THREE.BoxGeometry(0.1, 0.1, 0.6);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.85, roughness: 0.3 });
    const barrel = new THREE.Mesh(barrelGeo, metalMat);
    barrel.position.set(0.2, -0.2, -0.5);
    weaponGroup.add(barrel);

    const flashGeo = new THREE.ConeGeometry(0.15, 0.4, 8);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0 });
    muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    muzzleFlashMesh.rotation.x = Math.PI / 2;
    muzzleFlashMesh.position.set(0.2, -0.2, -0.85);
    weaponGroup.add(muzzleFlashMesh);

    weaponMesh = weaponGroup;
    camera.add(weaponMesh);
    scene.add(camera);
}

// ----------------------------------------------------
// GERADOR DE ZUMBIS FÍSICOS E CORPÓREOS (3 VARIAÇÕES)
// ----------------------------------------------------
function createZombieMesh(type = 'common') {
    const group = new THREE.Group();

    // Materiais Opacos e Físicos para a Criatura
    let skinColor = type === 'fast' ? 0x4f5945 : (type === 'heavy' ? 0x3d4738 : 0x5a6650);
    let clothColor = type === 'fast' ? 0x242428 : (type === 'heavy' ? 0x472e25 : 0x3b3d4a);
    let bloodColor = 0x5a0f0f;

    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.85, metalness: 0.05 });
    const clothMat = new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.9, metalness: 0.1 });
    const bloodMat = new THREE.MeshStandardMaterial({ color: bloodColor, roughness: 0.6, metalness: 0.2 });

    let torW = type === 'heavy' ? 0.95 : (type === 'fast' ? 0.65 : 0.8);
    let torH = type === 'heavy' ? 1.3 : 1.2;
    let torD = type === 'heavy' ? 0.6 : 0.45;

    // Tronco Corpóreo Curvado
    const torso = new THREE.Mesh(new THREE.BoxGeometry(torW, torH, torD), clothMat);
    torso.position.y = 1.0;
    torso.rotation.x = 0.2; // Postura corcunda
    torso.castShadow = true;
    torso.receiveShadow = true;
    group.add(torso);

    // Detalhes de Ferimentos / Sangue no Torso
    const wound = new THREE.Mesh(new THREE.BoxGeometry(torW * 0.5, 0.4, torD + 0.05), bloodMat);
    wound.position.set(0, 1.0, 0);
    group.add(wound);

    // Cabeça Sólida
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.52), skinMat);
    head.position.set(0, 1.85, 0.1);
    head.castShadow = true;
    group.add(head);

    // Braço Esquerdo
    const armGeo = new THREE.BoxGeometry(0.22, 0.9, 0.22);
    const leftArm = new THREE.Mesh(armGeo, skinMat);
    leftArm.position.set(-(torW / 2 + 0.15), 1.1, 0.15);
    leftArm.rotation.x = -0.4;
    leftArm.castShadow = true;
    group.add(leftArm);

    // Braço Direito (Estendido para ataque)
    const rightArm = new THREE.Mesh(armGeo, skinMat);
    rightArm.position.set(torW / 2 + 0.15, 1.0, 0.3);
    rightArm.rotation.x = -0.8;
    rightArm.castShadow = true;
    group.add(rightArm);

    // Pernas Articuladas Sólidas
    const legGeo = new THREE.BoxGeometry(0.26, 0.95, 0.26);
    const leftLeg = new THREE.Mesh(legGeo, clothMat);
    leftLeg.position.set(-0.2, 0.45, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, clothMat);
    rightLeg.position.set(0.2, 0.45, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    return {
        mesh: group,
        leftLeg: leftLeg,
        rightLeg: rightLeg,
        leftArm: leftArm,
        rightArm: rightArm,
        torso: torso,
        type: type
    };
}

function spawnInitialZombies() {
    const spawnPoints = [
        { pos: new THREE.Vector3(-15, 0, 30), type: 'common' },
        { pos: new THREE.Vector3(15, 0, 35), type: 'fast' },
        { pos: new THREE.Vector3(-25, 0, 0), type: 'heavy' },
        { pos: new THREE.Vector3(25, 0, -20), type: 'common' },
        { pos: new THREE.Vector3(-40, 0, -45), type: 'fast' },
        { pos: new THREE.Vector3(-10, 0, 10), type: 'heavy' },
        { pos: new THREE.Vector3(10, 0, 5), type: 'common' }
    ];

    spawnPoints.forEach(sp => {
        let zObj = createZombieMesh(sp.type);
        zObj.mesh.position.copy(sp.pos);
        scene.add(zObj.mesh);

        let hpMax = sp.type === 'heavy' ? 140 : (sp.type === 'fast' ? 45 : 70);
        let speedVal = sp.type === 'fast' ? 0.052 : (sp.type === 'heavy' ? 0.028 : 0.038);

        zombies.push({
            ...zObj,
            hp: hpMax,
            maxHp: hpMax,
            speed: speedVal,
            attackCooldown: 0,
            hitCooldown: 0,
            isDead: false,
            deathTimer: 0,
            animOffset: Math.random() * Math.PI * 2
        });
    });
}

// ----------------------------------------------------
// CONSTRUÇÃO DO MUNDO ABERTO COM ILUMINAÇÃO LOCAL
// ----------------------------------------------------
function buildOpenWorldMap() {
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1b1d26, roughness: 0.85, metalness: 0.1 });
    const brokenRoadMat = new THREE.MeshStandardMaterial({ color: 0x222430, roughness: 0.75, metalness: 0.15 });
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x2d3240, roughness: 0.8 });
    const rustMetalMat = new THREE.MeshStandardMaterial({ color: 0x472d24, roughness: 0.7, metalness: 0.5 });

    const worldGround = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), groundMat);
    worldGround.rotation.x = -Math.PI / 2;
    worldGround.receiveShadow = true;
    scene.add(worldGround);

    createRoad(0, 0, 120, 12, brokenRoadMat);
    createRoad(0, 0, 12, 120, brokenRoadMat);

    createBuilding(-25, 30, 12, 10, 8, buildingMat);
    createBuilding(25, 30, 12, 10, 8, buildingMat);
    createStreetLight(-15, 25, 0xffaa44, 1.5);
    createStreetLight(15, 25, 0xffaa44, 1.5);
    createAbandonedCar(-10, 25, 0);
    createTree(-18, 20);
    createTree(18, 22);
    createItemBox(22, 28, 'first_aid', 'Kit Médico Residencial');

    createBuilding(-30, -5, 10, 18, 10, buildingMat);
    createBuilding(-30, -25, 10, 14, 8, buildingMat);
    createStreetLight(-22, -10, 0xff3300, 1.2, true);
    createDebrisPile(-25, 5);
    createItemBox(-28, -20, 'ammo_pistol', 'Munição 9mm Escondida no Beco');

    createGasStation(30, -25);
    createAbandonedBus(15, -15, Math.PI / 4);
    createItemBox(32, -30, 'ammo_shotgun', 'Cartuchos de Calibre 12 no Posto');

    createAbandonedCar(22, 18, 0.5);
    createAbandonedCar(28, 24, -0.3);
    createAbandonedCar(34, 16, 1.2);
    createFenceBarrier(20, 30, 25, 0);
    createItemBox(35, 20, 'weapon_sub', 'Submetralhadora Abandonada no Porta-Malas');

    createIndustrialWarehouse(-35, -45, 20, 14, 12, rustMetalMat);
    createStreetLight(-30, -42, 0x44ccff, 2.0);
    createBarrelsCluster(-22, -40);
    createItemBox(-35, -48, 'first_aid', 'Soro Industrial');

    createTree(-35, 40);
    createTree(-42, 48);
    createTree(-28, 45);
    createDebrisPile(-35, 45);
    createItemBox(-40, 50, 'ammo_pistol', 'Munição na Estátua Quebrada');

    createFacilityGate(0, -60);
    createStreetLight(-5, -58, 0xff2222, 1.8, true);
    createItemBox(0, -58, 'ammo_shotgun', 'Munição Pesada do Arsenal');

    createBossArena(0, -77);
}

function createRoad(x, z, w, d, mat) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.01, z);
    road.receiveShadow = true;
    scene.add(road);
}

function createBuilding(x, z, w, d, h, mat) {
    const bGeo = new THREE.BoxGeometry(w, h, d);
    const building = new THREE.Mesh(bGeo, mat);
    building.position.set(x, h / 2, z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    colliders.push(building);
}

function createIndustrialWarehouse(x, z, w, d, h, mat) {
    createBuilding(x, z, w, d, h, mat);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 2, 1, d + 2), new THREE.MeshStandardMaterial({ color: 0x1f222b }));
    roof.position.set(x, h + 0.5, z);
    scene.add(roof);
    colliders.push(roof);
}

function createAbandonedCar(x, z, rot) {
    const carGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4c3333, metalness: 0.6, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 4.2), bodyMat);
    body.position.y = 0.5;
    carGroup.add(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.8, 2.2), new THREE.MeshStandardMaterial({ color: 0x1a1c22 }));
    cabin.position.set(0, 1.3, -0.2);
    carGroup.add(cabin);

    carGroup.position.set(x, 0, z);
    carGroup.rotation.y = rot;
    scene.add(carGroup);
    colliders.push(body);
}

function createAbandonedBus(x, z, rot) {
    const busGroup = new THREE.Group();
    const busMat = new THREE.MeshStandardMaterial({ color: 0x665c2b, metalness: 0.5, roughness: 0.6 });
    const busBody = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.4, 8.5), busMat);
    busBody.position.y = 1.2;
    busGroup.add(busBody);

    busGroup.position.set(x, 0, z);
    busGroup.rotation.y = rot;
    scene.add(busGroup);
    colliders.push(busBody);
}

function createGasStation(x, z) {
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x3d404f });
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(14, 0.8, 10), canopyMat);
    canopy.position.set(x, 4.5, z);
    scene.add(canopy);

    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.5), new THREE.MeshStandardMaterial({ color: 0x777 }));
    p1.position.set(x - 5, 2.25, z - 3);
    scene.add(p1);
    colliders.push(p1);

    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4.5), new THREE.MeshStandardMaterial({ color: 0x777 }));
    p2.position.set(x + 5, 2.25, z - 3);
    scene.add(p2);
    colliders.push(p2);

    const gasLight = new THREE.PointLight(0xffcc66, 1.5, 12);
    gasLight.position.set(x, 4.0, z);
    scene.add(gasLight);
}

function createBossArena(x, z) {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x221a1a, roughness: 0.8 });
    const size = 30;
    const h = 7;

    const w1 = new THREE.Mesh(new THREE.BoxGeometry(size, h, 1), wallMat);
    w1.position.set(x, h/2, z - size/2);
    scene.add(w1);
    colliders.push(w1);

    const w2 = new THREE.Mesh(new THREE.BoxGeometry(1, h, size), wallMat);
    w2.position.set(x - size/2, h/2, z);
    scene.add(w2);
    colliders.push(w2);

    const w3 = new THREE.Mesh(new THREE.BoxGeometry(1, h, size), wallMat);
    w3.position.set(x + size/2, h/2, z);
    scene.add(w3);
    colliders.push(w3);

    const bossLight1 = new THREE.PointLight(0xff2200, 2.0, 18);
    bossLight1.position.set(x - 8, 4, z - 8);
    scene.add(bossLight1);

    const bossLight2 = new THREE.PointLight(0xff2200, 2.0, 18);
    bossLight2.position.set(x + 8, 4, z - 8);
    scene.add(bossLight2);
}

function createTree(x, z) {
    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3.5), new THREE.MeshStandardMaterial({ color: 0x2b2017 }));
    trunk.position.y = 1.75;
    treeGroup.add(trunk);

    const leaves = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8), new THREE.MeshStandardMaterial({ color: 0x263320 }));
    leaves.position.y = 4.2;
    treeGroup.add(leaves);

    treeGroup.position.set(x, 0, z);
    scene.add(treeGroup);
    colliders.push(trunk);
}

function createDebrisPile(x, z) {
    const debris = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.6, 2.5), new THREE.MeshStandardMaterial({ color: 0x33353d }));
    debris.position.set(x, 0.3, z);
    scene.add(debris);
}

function createBarrelsCluster(x, z) {
    const bMat = new THREE.MeshStandardMaterial({ color: 0x6b2b20, roughness: 0.5 });
    for(let i=0; i<3; i++) {
        let b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2), bMat);
        b.position.set(x + (i*0.7) - 0.7, 0.6, z + (i%2)*0.6);
        scene.add(b);
        colliders.push(b);
    }
}

function createStreetLight(x, z, colorHex, intensity, isBlinking = false) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 6), new THREE.MeshStandardMaterial({ color: 0x33363d }));
    pole.position.set(x, 3, z);
    scene.add(pole);
    colliders.push(pole);

    const light = new THREE.PointLight(colorHex, intensity, 14);
    light.position.set(x, 5.5, z);
    scene.add(light);

    if (isBlinking) {
        blinkingLights.push({ light: light, baseIntensity: intensity, speed: 4 + Math.random() * 6 });
    }
}

function createFenceBarrier(x, z, w, rot) {
    const fence = new THREE.Mesh(new THREE.BoxGeometry(w, 2, 0.2), new THREE.MeshStandardMaterial({ color: 0x42382d }));
    fence.position.set(x, 1, z);
    fence.rotation.y = rot;
    scene.add(fence);
    colliders.push(fence);
}

function createFacilityGate(x, z) {
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x2b303d, metalness: 0.8 });
    const g1 = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 0.6), gateMat);
    g1.position.set(x - 3, 2.5, z);
    scene.add(g1);
    colliders.push(g1);

    const g2 = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 0.6), gateMat);
    g2.position.set(x + 3, 2.5, z);
    scene.add(g2);
    colliders.push(g2);
}

function createItemBox(x, z, itemId, desc) {
    const boxGeo = new THREE.BoxGeometry(0.5, 0.4, 0.5);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0x442200 });
    const boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.position.set(x, 0.25, z);
    scene.add(boxMesh);

    interactiveItems.push({
        mesh: boxMesh,
        itemId: itemId,
        desc: desc,
        collected: false
    });
}

function initEnvironmentalParticles() {
    const particleCount = 70;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 120;
        positions[i + 1] = Math.random() * 6;
        positions[i + 2] = (Math.random() - 0.5) * 120;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({ color: 0x8899aa, size: 0.08, transparent: true, opacity: 0.45 });
    const pSystem = new THREE.Points(geometry, material);
    scene.add(pSystem);
    environmentalParticles.push(pSystem);
}

function updateEnvironmentalParticles() {
    environmentalParticles.forEach(sys => {
        const positions = sys.geometry.attributes.position.array;
        for (let i = 1; i < positions.length; i += 3) {
            positions[i] -= 0.0015;
            if (positions[i] < 0) positions[i] = 6;
        }
        sys.geometry.attributes.position.needsUpdate = true;
    });
}

function updateBlinkingLights(delta) {
    blinkingLights.forEach(item => {
        let noise = Math.sin(performance.now() * 0.008 * item.speed);
        item.light.intensity = noise > 0.3 ? item.baseIntensity : item.baseIntensity * 0.15;
    });
}

// ----------------------------------------------------
// ATUALIZAÇÃO E INTELIGÊNCIA DOS ZUMBIS
// ----------------------------------------------------
function updateZombies(delta) {
    for (let i = zombies.length - 1; i >= 0; i--) {
        let z = zombies[i];

        if (z.isDead) {
            z.deathTimer += delta;
            if (z.deathTimer > 15) { // Desaparece após 15 segundos no chão para preservar performance
                scene.remove(z.mesh);
                zombies.splice(i, 1);
            }
            continue;
        }

        let dist = z.mesh.position.distanceTo(player.position);
        
        // Comportamento de perseguição agressiva quando perto, ou caminhada lenta quando distante
        let currentSpeed = dist < 22 ? z.speed : z.speed * 0.65;

        if (dist < 32) {
            z.mesh.lookAt(player.position.x, z.mesh.position.y, player.position.z);
            
            let nextPos = z.mesh.position.clone();
            let dir = player.position.clone().sub(z.mesh.position).normalize();
            nextPos.addScaledVector(dir, currentSpeed);

            // Verificação de colisão dos zumbis com paredes/objetos do cenário
            if (!checkCollision(nextPos, 0.5)) {
                z.mesh.position.copy(nextPos);
            }

            // Animação cíclica de caminhada com os pés tocando o solo e braços balançando
            z.animOffset += delta * (currentSpeed * 25);
            z.leftLeg.rotation.x = Math.sin(z.animOffset) * 0.6;
            z.rightLeg.rotation.x = -Math.sin(z.animOffset) * 0.6;
            z.leftArm.rotation.z = Math.sin(z.animOffset * 0.5) * 0.2;
            z.rightArm.rotation.x = -0.8 + Math.cos(z.animOffset) * 0.3;

            // Ataque físico ao jogador
            if (dist < 1.4 && z.attackCooldown <= 0) {
                damagePlayer(z.type === 'heavy' ? 25 : 15);
                z.attackCooldown = 55;
            }
        }

        if (z.attackCooldown > 0) z.attackCooldown--;
        if (z.hitCooldown > 0) {
            z.hitCooldown--;
            z.mesh.position.y = 0;
        }
    }
}

function checkBossTrigger() {
    if (!boss.active && player.position.z < -65) {
        spawnBoss();
    }
}

function spawnBoss() {
    boss.active = true;
    boss.hp = 1200;
    boss.maxHp = 1200;
    boss.speed = 0.048;
    boss.isEnraged = false;

    const bossGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x242a38, metalness: 0.7, roughness: 0.3 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x75261c, metalness: 0.8, roughness: 0.2 });

    const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 1.5), bodyMat);
    torsoMesh.position.y = 2.2;
    bossGroup.add(torsoMesh);

    const armorL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.8, 1.8), armorMat);
    armorL.position.set(-1.3, 2.2, 0);
    bossGroup.add(armorL);

    const armorR = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.8, 1.8), armorMat);
    armorR.position.set(1.3, 2.2, 0);
    bossGroup.add(armorR);

    const reactorGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const reactorMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const reactorMesh = new THREE.Mesh(reactorGeo, reactorMat);
    reactorMesh.position.set(0, 2.3, 0.82);
    reactorMesh.userData = { isWeakPoint: true };
    bossGroup.add(reactorMesh);
    boss.reactorMesh = reactorMesh;

    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 1.2), new THREE.MeshStandardMaterial({ color: 0x11 }));
    headMesh.position.y = 4.2;
    bossGroup.add(headMesh);

    bossGroup.position.set(0, 0, -77);
    scene.add(bossGroup);
    boss.mesh = bossGroup;

    bossHud.classList.remove('hidden');
    updateBossHUD();
    showNotification("AVISO: VOCÊ ENTROU NA ÁREA DO CHEFE: O TECNO-CARNICEIRO!");
}

function updateBoss(delta) {
    if (!boss.active || !boss.mesh) return;

    let dist = boss.mesh.position.distanceTo(player.position);
    boss.mesh.lookAt(player.position.x, boss.mesh.position.y, player.position.z);

    if (dist > 3.0) {
        boss.mesh.position.lerp(player.position, boss.speed / dist);
    }

    if (dist < 3.2 && boss.attackCooldown <= 0) {
        damagePlayer(boss.isEnraged ? 40 : 25);
        boss.attackCooldown = 60;
    }
    if (boss.attackCooldown > 0) boss.attackCooldown--;

    if (boss.rangedCooldown <= 0) {
        triggerBossRangedAttack();
        boss.rangedCooldown = boss.isEnraged ? 80 : 130;
    }
    if (boss.rangedCooldown > 0) boss.rangedCooldown--;

    boss.animTimer += delta * 6;
    boss.mesh.position.y = Math.sin(boss.animTimer) * 0.08;

    updateBossProjectiles();
}

function triggerBossRangedAttack() {
    const projGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const projMat = new THREE.MeshBasicMaterial({ color: boss.isEnraged ? 0xff2200 : 0x00ffcc });
    const projMesh = new THREE.Mesh(projGeo, projMat);

    let startPos = boss.mesh.position.clone().add(new THREE.Vector3(0, 2.5, 0));
    projMesh.position.copy(startPos);
    scene.add(projMesh);

    let dir = player.position.clone().sub(startPos).normalize();
    bossProjectiles.push({ mesh: projMesh, direction: dir, speed: 0.22, lifetime: 180 });
}

function updateBossProjectiles() {
    for (let i = bossProjectiles.length - 1; i >= 0; i--) {
        let p = bossProjectiles[i];
        p.mesh.position.addScaledVector(p.direction, p.speed);
        p.lifetime--;

        if (p.mesh.position.distanceTo(player.position) < 1.2) {
            damagePlayer(18);
            scene.remove(p.mesh);
            bossProjectiles.splice(i, 1);
            continue;
        }

        if (p.lifetime <= 0) {
            scene.remove(p.mesh);
            bossProjectiles.splice(i, 1);
        }
    }
}

function damageBoss(amount, isWeakPoint) {
    let finalDmg = isWeakPoint ? amount * 3.0 : amount;
    boss.hp -= finalDmg;

    if (!boss.isEnraged && boss.hp <= boss.maxHp * 0.5) {
        boss.isEnraged = true;
        boss.speed = 0.068;
        if (boss.reactorMesh) boss.reactorMesh.material.color.setHex(0xff0033);
        showNotification("MODO FÚRIA ATIVADO PELO CHEFE!");
    }

    updateBossHUD();

    if (boss.hp <= 0) {
        defeatBoss();
    }
}

function updateBossHUD() {
    let pct = Math.max(0, (boss.hp / boss.maxHp) * 100);
    bossHpBar.style.width = pct + '%';
    bossHpVal.innerText = Math.round(pct) + '%';
}

function defeatBoss() {
    boss.active = false;
    scene.remove(boss.mesh);
    boss.mesh = null;
    bossHud.classList.add('hidden');
    gameStats.score += 5000;
    showNotification("PARABÉNS! VOCÊ DERROTOU O TECNO-CARNICEIRO E SOBREVIVEU!");
}

// ----------------------------------------------------
// TIROS E COMBATE
// ----------------------------------------------------
function shootWeapon() {
    let curWeapon = weapons[currentWeaponIndex];
    let now = performance.now();

    if (player.isReloading || now - lastShotTime < curWeapon.fireRate) return;

    if (curWeapon.ammo <= 0) {
        reloadWeapon();
        return;
    }

    lastShotTime = now;
    curWeapon.ammo--;
    updateHUD();

    triggerMuzzleFlash();
    mouseLook.y += 0.01;

    let spreadX = (Math.random() - 0.5) * curWeapon.spread;
    let spreadY = (Math.random() - 0.5) * curWeapon.spread;
    raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), camera);

    let targetMeshes = [];
    if (boss.active && boss.mesh) targetMeshes.push(boss.mesh);
    let zombieMeshes = zombies.filter(z => !z.isDead).map(z => z.mesh);
    targetMeshes = targetMeshes.concat(zombieMeshes);

    let intersects = raycaster.intersectObjects(targetMeshes, true);

    if (intersects.length > 0) {
        let hitObject = intersects[0].object;

        if (boss.active && boss.mesh) {
            let isPartOfBoss = false;
            boss.mesh.traverse(c => { if (c === hitObject) isPartOfBoss = true; });
            if (isPartOfBoss) {
                let isWeakPoint = hitObject.userData && hitObject.userData.isWeakPoint;
                damageBoss(curWeapon.damage, isWeakPoint);
                return;
            }
        }

        let hitZombie = zombies.find(z => {
            let isPartOfZ = false;
            z.mesh.traverse(c => { if (c === hitObject) isPartOfZ = true; });
            return isPartOfZ;
        });

        if (hitZombie) {
            hitZombie.hp -= curWeapon.damage;
            hitZombie.hitCooldown = 12;
            hitZombie.mesh.position.y = 0.15; // Feedback visual de dano

            if (hitZombie.hp <= 0 && !hitZombie.isDead) {
                hitZombie.isDead = true;
                hitZombie.mesh.rotation.x = Math.PI / 2; // Queda firme no chão
                hitZombie.mesh.position.y = 0.25;
                gameStats.kills++;
                gameStats.score += 150;
                updateHUD();
            }
        }
    }
}

function triggerMuzzleFlash() {
    if (!muzzleFlashMesh) return;
    muzzleFlashMesh.material.opacity = 1.0;
    setTimeout(() => { muzzleFlashMesh.material.opacity = 0.0; }, 50);
}

function reloadWeapon() {
    let curWeapon = weapons[currentWeaponIndex];
    if (player.isReloading || curWeapon.ammo === curWeapon.maxAmmo) return;

    player.isReloading = true;
    reloadPromptText.style.display = 'block';

    setTimeout(() => {
        curWeapon.ammo = curWeapon.maxAmmo;
        player.isReloading = false;
        reloadPromptText.style.display = 'none';
        updateHUD();
    }, curWeapon.reloadTime);
}

function checkItemProximity() {
    let nearby = interactiveItems.find(item => !item.collected && item.mesh.position.distanceTo(player.position) < 2.2);
    if (nearby) {
        interactionPrompt.innerText = `[ E ] Coletar: ${nearby.desc}`;
        interactionPrompt.style.display = 'block';
    } else {
        interactionPrompt.style.display = 'none';
    }
}

function collectNearbyItem() {
    let nearby = interactiveItems.find(item => !item.collected && item.mesh.position.distanceTo(player.position) < 2.2);
    if (!nearby) return;

    nearby.collected = true;
    scene.remove(nearby.mesh);
    gameStats.itemsCollected++;

    if (nearby.itemId === 'weapon_sub') {
        weapons[1].unlocked = true;
        showNotification("Arma Desbloqueada: Submetralhadora!");
    } else {
        let emptySlot = inventory.findIndex(slot => slot === null);
        if (emptySlot !== -1) {
            inventory[emptySlot] = {
                id: nearby.itemId,
                name: nearby.itemId === 'first_aid' ? 'Kit Médico' : 'Munição Extra',
                count: 1,
                type: nearby.itemId === 'first_aid' ? 'healing' : 'ammo',
                desc: nearby.desc
            };
        }
    }

    itemsCollectedText.innerText = `${gameStats.itemsCollected} / ${interactiveItems.length}`;
    showNotification(`Item Coletado: ${nearby.desc}`);
    updateHUD();
}

function damagePlayer(amount) {
    player.hp -= amount;
    updateHUD();
    document.body.style.backgroundColor = '#550000';
    setTimeout(() => { document.body.style.backgroundColor = '#030305'; }, 150);
    if (player.hp <= 0) triggerGameOver();
}

function toggleInventory() {
    if (!isPlaying) return;
    isInventoryOpen = !isInventoryOpen;

    if (isInventoryOpen) {
        inventoryScreen.classList.remove('hidden');
        document.exitPointerLock();
        renderInventoryUI();
    } else {
        inventoryScreen.classList.add('hidden');
        document.body.requestPointerLock();
        selectedInventorySlot = null;
    }
}

function renderInventoryUI() {
    const grid = document.getElementById('inventory-slots');
    grid.innerHTML = '';

    for (let i = 0; i < 12; i++) {
        const slotDiv = document.createElement('div');
        slotDiv.className = 'inv-slot';
        if (selectedInventorySlot === i) slotDiv.classList.add('selected');

        let item = inventory[i];
        if (item) {
            slotDiv.innerHTML = `<div class="inv-slot-name">${item.name}</div>${item.count > 1 ? `<div class="inv-slot-count">x${item.count}</div>` : ''}`;
        }

        slotDiv.addEventListener('click', () => {
            selectedInventorySlot = i;
            renderInventoryUI();
            document.getElementById('inventory-desc').innerText = item ? `${item.name}: ${item.desc}` : 'Slot vazio.';
        });
        grid.appendChild(slotDiv);
    }
}

function useSelectedInventoryItem() {
    if (selectedInventorySlot === null) return;
    let item = inventory[selectedInventorySlot];
    if (!item) return;

    if (item.type === 'healing') {
        player.hp = Math.min(100, player.hp + 50);
        inventory[selectedInventorySlot] = null;
        selectedInventorySlot = null;
        renderInventoryUI();
        updateHUD();
        showNotification("Você usou o Kit Médico (+50 HP).");
    } else if (item.type === 'ammo') {
        let curWeapon = weapons[currentWeaponIndex];
        curWeapon.ammo = curWeapon.maxAmmo;
        inventory[selectedInventorySlot] = null;
        selectedInventorySlot = null;
        renderInventoryUI();
        updateHUD();
        showNotification("Munição recarregada com sucesso!");
    }
}

function combineSelectedInventoryItems() { showNotification("Nenhuma combinação possível."); }
function discardSelectedInventoryItem() {
    if (selectedInventorySlot === null) return;
    inventory[selectedInventorySlot] = null;
    selectedInventorySlot = null;
    renderInventoryUI();
    showNotification("Item descartado.");
}

function showNotification(text) {
    interactionPrompt.innerText = text;
    interactionPrompt.style.display = 'block';
    setTimeout(() => { if (!isInventoryOpen) interactionPrompt.style.display = 'none'; }, 3500);
}

function handleKeyDown(e) {
    if (e.code === 'KeyI') { toggleInventory(); return; }
    if (isInventoryOpen) return;

    switch(e.code) {
        case 'KeyW': keys.w = true; break;
        case 'KeyS': keys.s = true; break;
        case 'KeyA': keys.a = true; break;
        case 'KeyD': keys.d = true; break;
        case 'KeyE': collectNearbyItem(); break;
        case 'KeyR': reloadWeapon(); break;
        case 'Digit1': switchWeapon(0); break;
        case 'Digit2': switchWeapon(1); break;
        case 'Digit3': switchWeapon(2); break;
    }
}

function handleKeyUp(e) {
    switch(e.code) {
        case 'KeyW': keys.w = false; break;
        case 'KeyS': keys.s = false; break;
        case 'KeyA': keys.a = false; break;
        case 'KeyD': keys.d = false; break;
    }
}

function switchWeapon(index) {
    if (weapons[index] && weapons[index].unlocked) {
        currentWeaponIndex = index;
        updateHUD();
    }
}

function handleMouseDown(e) {
    if (!isPlaying || isInventoryOpen || document.pointerLockElement !== document.body) return;
    if (e.button === 0) shootWeapon();
}

function handleMouseMove(e) {
    if (!isPlaying || isInventoryOpen || document.pointerLockElement !== document.body) return;
    mouseLook.x -= e.movementX * mouseSensitivity;
    mouseLook.y -= e.movementY * mouseSensitivity;
    mouseLook.y = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, mouseLook.y));

    camera.rotation.set(0, 0, 0);
    camera.rotateY(mouseLook.x);
    camera.rotateX(mouseLook.y);
}

function checkCollision(targetPosition, radius = 0.35) {
    for (let obj of colliders) {
        const box = new THREE.Box3().setFromObject(obj);
        if (targetPosition.x > box.min.x - radius && targetPosition.x < box.max.x + radius &&
            targetPosition.z > box.min.z - radius && targetPosition.z < box.max.z + radius) {
            return true;
        }
    }
    return false;
}

function updatePlayer(delta) {
    if (!isPlaying || isInventoryOpen) return;

    const moveVector = new THREE.Vector3();
    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseLook.x);
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), mouseLook.x);

    if (keys.w) moveVector.add(forward);
    if (keys.s) moveVector.sub(forward);
    if (keys.a) moveVector.sub(right);
    if (keys.d) moveVector.add(right);

    moveVector.normalize();
    moveVector.multiplyScalar(player.speed);

    let nextPos = player.position.clone();
    nextPos.x += moveVector.x;
    if (!checkCollision(nextPos, player.radius)) player.position.x = nextPos.x;

    nextPos = player.position.clone();
    nextPos.z += moveVector.z;
    if (!checkCollision(nextPos, player.radius)) player.position.z = nextPos.z;

    camera.position.copy(player.position);
    updateRegionTracker();
}

function updateRegionTracker() {
    let p = player.position;
    if (p.z > 15) regionTracker.innerText = "ÁREA RESIDENCIAL ABANDONADA";
    else if (p.x < -15 && p.z >= -20 && p.z <= 15) regionTracker.innerText = "RUA COMERCIAL DESTRUÍDA";
    else if (p.x > 15 && p.z <= 0) regionTracker.innerText = "POSTO DE GASOLINA";
    else if (p.x > 15 && p.z > 0) regionTracker.innerText = "PEQUENO ESTACIONAMENTO";
    else if (p.x < -20 && p.z < -25) regionTracker.innerText = "ÁREA INDUSTRIAL";
    else if (p.x < -20 && p.z > 25) regionTracker.innerText = "PARQUE ABANDONADO";
    else if (p.z < -55 && p.z >= -70) regionTracker.innerText = "ENTRADA DA INSTALAÇÃO";
    else if (p.z < -70) regionTracker.innerText = "ZONA DE CONFRONTO COM O CHEFE";
    else regionTracker.innerText = "CRUZAMENTO CENTRAL";
}

function updateHUD() {
    let curWeapon = weapons[currentWeaponIndex];
    hpBar.style.width = Math.max(0, player.hp) + '%';
    hpText.innerText = Math.max(0, player.hp) + '%';
    ammoText.innerText = `${curWeapon.ammo} / ${curWeapon.maxAmmo}`;
    weaponNameText.innerText = curWeapon.name;
    killsText.innerText = gameStats.kills;
    scoreText.innerText = gameStats.score;
    itemsCollectedText.innerText = `${gameStats.itemsCollected} / ${interactiveItems.length}`;

    let mins = Math.floor(gameStats.survivalTime / 60);
    let secs = Math.floor(gameStats.survivalTime % 60);
    timeText.innerText = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
}

function triggerGameOver() {
    isPlaying = false;
    document.exitPointerLock();
    document.getElementById('final-items').innerText = gameStats.itemsCollected;
    document.getElementById('final-kills').innerText = gameStats.kills;
    document.getElementById('final-score').innerText = gameStats.score;
    gameOverScreen.classList.remove('hidden');
    hud.classList.add('hidden');
}

function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

let clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (isPlaying) {
        gameStats.survivalTime += delta;
        updatePlayer(delta);
        updateZombies(delta);
        checkBossTrigger();
        updateBoss(delta);
        updateEnvironmentalParticles();
        updateBlinkingLights(delta);
        checkItemProximity();
        updateHUD();
    }

    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

import * as THREE from '../../vendor/three/three.module.min.js';
import { createBackroomsMaterials } from './materials.js';

export const CELL = 2.4;
export const HEIGHT = 3.05;
export const SIZE = 43;
export function seededRandom(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Broad rooms and staggered partitions, connected before any decorative pillars.
export function createLayout(seed) {
  const random = seededRandom(seed);
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(1));
  const carve = (x, z, w, d) => {
    for (let j = z; j < z + d; j++) for (let i = x; i < x + w; i++) {
      if (i > 0 && j > 0 && i < SIZE - 1 && j < SIZE - 1) grid[j][i] = 0;
    }
  };
  const centers = [];
  for (let rz = 0; rz < 7; rz++) for (let rx = 0; rx < 7; rx++) {
    const x = rx * 6 + 3, z = rz * 6 + 3;
    const w = random() > .3 ? 5 : 4, d = random() > .3 ? 5 : 4;
    carve(x - 2, z - 2, w, d);
    centers.push({ x, z });
  }
  const visited = new Set(['0,0']), stack = [[0, 0]];
  while (stack.length) {
    const [x, z] = stack[stack.length - 1];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    const next = dirs.find(([dx, dz]) => x + dx >= 0 && z + dz >= 0 && x + dx < 7 && z + dz < 7 && !visited.has(`${x + dx},${z + dz}`));
    if (!next) { stack.pop(); continue; }
    const [dx, dz] = next, cx = x * 6 + 3, cz = z * 6 + 3;
    if (dx) carve(Math.min(cx, cx + dx * 6), cz + (random() > .5 ? 0 : -1), 7, 2);
    else carve(cx + (random() > .5 ? 0 : -1), Math.min(cz, cz + dz * 6), 2, 7);
    visited.add(`${x + dx},${z + dz}`); stack.push([x + dx, z + dz]);
  }
  // Extra openings make loops and spaces that merge unexpectedly.
  for (let i = 0; i < 28; i++) {
    const rx = Math.floor(random() * 6), rz = Math.floor(random() * 6);
    if (random() > .5) carve(rx * 6 + 5, rz * 6 + 2, 4, 2);
    else carve(rx * 6 + 2, rz * 6 + 5, 2, 4);
  }
  // The entrance is a deliberately recognizable Level 0 room.
  carve(1, 1, 5, 5); carve(4, 4, 6, 2);
  for (let i = 0; i < centers.length; i++) {
    const { x, z } = centers[i];
    if (i > 1 && random() < .35) grid[z - 1][x - 1] = 1;
  }
  const spawn = { x: CELL * 2.5, z: CELL * 3.5, yaw: -Math.PI / 2 };
  const distances = new Map([['2,3', 0]]), queue = [[2, 3]];
  for (let n = 0; n < queue.length; n++) {
    const [x, z] = queue[n], distance = distances.get(`${x},${z}`);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, key = `${nx},${nz}`;
      if (grid[nz]?.[nx] === 0 && !distances.has(key)) {
        distances.set(key, distance + 1); queue.push([nx, nz]);
      }
    }
  }
  const [ex, ez] = queue[queue.length - 1];
  const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => grid[ez + dz]?.[ex + dx] === 1) || [0, 1];
  const exit = { x: (ex + .5) * CELL, z: (ez + .5) * CELL, dx: side[0], dz: side[1] };
  const entityCell = queue[Math.floor(queue.length * .6)];
  return { seed, grid, spawn, exit, entity: { x: (entityCell[0] + .5) * CELL, z: (entityCell[1] + .5) * CELL }, reachable: queue.length };
}

function wallGeometry(grid) {
  const pos = [], uv = [], normals = [];
  function face(corners, normal, width, height) {
    const coords = [[0, 0], [width, 0], [width, height], [0, height]];
    for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...corners[i]); normals.push(...normal); uv.push(...coords[i]); }
  }
  const trims = [];
  for (let z = 0; z < SIZE; z++) for (let x = 0; x < SIZE; x++) {
    if (!grid[z][x]) continue;
    const x0 = x * CELL, x1 = x0 + CELL, z0 = z * CELL, z1 = z0 + CELL;
    if (grid[z]?.[x - 1] === 0) { face([[x0, 0, z0], [x0, 0, z1], [x0, HEIGHT, z1], [x0, HEIGHT, z0]], [-1, 0, 0], CELL, HEIGHT); trims.push([x0 - .015, z0 + CELL / 2, 1]); }
    if (grid[z]?.[x + 1] === 0) { face([[x1, 0, z1], [x1, 0, z0], [x1, HEIGHT, z0], [x1, HEIGHT, z1]], [1, 0, 0], CELL, HEIGHT); trims.push([x1 + .015, z0 + CELL / 2, 1]); }
    if (grid[z - 1]?.[x] === 0) { face([[x1, 0, z0], [x0, 0, z0], [x0, HEIGHT, z0], [x1, HEIGHT, z0]], [0, 0, -1], CELL, HEIGHT); trims.push([x0 + CELL / 2, z0 - .015, 0]); }
    if (grid[z + 1]?.[x] === 0) { face([[x0, 0, z1], [x1, 0, z1], [x1, HEIGHT, z1], [x0, HEIGHT, z1]], [0, 0, 1], CELL, HEIGHT); trims.push([x0 + CELL / 2, z1 + .015, 0]); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  return { geometry, trims };
}

export function buildWorld(scene, seed) {
  const layout = createLayout(seed), group = new THREE.Group(), materials = createBackroomsMaterials(THREE);
  materials.wallpaper.map.repeat.set(1 / 1.2, 1 / HEIGHT);
  materials.carpet.map.repeat.set(1 / 3, 1 / 3);
  materials.ceiling.map.repeat.set(1 / 1.2, 1 / 1.2);
  scene.add(group);
  const { geometry, trims } = wallGeometry(layout.grid);
  const walls = new THREE.Mesh(geometry, materials.wallpaper); walls.receiveShadow = true; group.add(walls);
  const floorGeometry = new THREE.PlaneGeometry(SIZE * CELL, SIZE * CELL);
  // UVs in metres allow matching scale on every surface.
  const floorUV = floorGeometry.attributes.uv;
  for (let i = 0; i < floorUV.count; i++) floorUV.setXY(i, floorUV.getX(i) * SIZE * CELL, floorUV.getY(i) * SIZE * CELL);
  const floor = new THREE.Mesh(floorGeometry, materials.carpet);
  floor.rotation.x = -Math.PI / 2; floor.position.set(SIZE * CELL / 2, 0, SIZE * CELL / 2); floor.receiveShadow = true; group.add(floor);
  const ceiling = new THREE.Mesh(floorGeometry, materials.ceiling);
  ceiling.rotation.x = Math.PI / 2; ceiling.position.set(SIZE * CELL / 2, HEIGHT, SIZE * CELL / 2); group.add(ceiling);
  const matrix = new THREE.Object3D();
  const baseboards = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), materials.trim, trims.length);
  trims.forEach(([x, z, vertical], i) => { matrix.position.set(x, .075, z); matrix.scale.set(vertical ? .035 : CELL, .15, vertical ? CELL : .035); matrix.updateMatrix(); baseboards.setMatrixAt(i, matrix.matrix); });
  group.add(baseboards);
  const lightPositions = [], random = seededRandom(seed ^ 0x1986);
  for (let z = 2; z < SIZE - 1; z += 2) for (let x = 2; x < SIZE - 1; x += 2) {
    if (layout.grid[z][x] || (x + z) % 6 === 0) continue;
    lightPositions.push({ x: (x + .5) * CELL, z: (z + .5) * CELL, broken: random() < .08, phase: random() * 100 });
  }
  // Keep the first room well lit, including the initial camera view.
  lightPositions.unshift({ x: 3 * CELL, z: 3 * CELL, broken: false, phase: 0 });
  const fixtureGeometry = new THREE.BoxGeometry(.52, .07, 1.28), panelGeometry = new THREE.PlaneGeometry(.43, 1.18);
  const fixtures = new THREE.InstancedMesh(fixtureGeometry, materials.fixture, lightPositions.length);
  const diffuser = materials.diffuser;
  const panels = new THREE.InstancedMesh(panelGeometry, diffuser, lightPositions.length);
  lightPositions.forEach((p, i) => {
    matrix.position.set(p.x, HEIGHT - .055, p.z); matrix.scale.set(1, 1, 1); matrix.rotation.set(0, 0, 0); matrix.updateMatrix(); fixtures.setMatrixAt(i, matrix.matrix);
    matrix.position.y = HEIGHT - .095; matrix.rotation.x = Math.PI / 2; matrix.updateMatrix(); panels.setMatrixAt(i, matrix.matrix);
    panels.setColorAt(i, new THREE.Color(p.broken ? '#443f2d' : '#fff8d7'));
  });
  group.add(fixtures, panels);
  const doorGroup = new THREE.Group();
  doorGroup.position.set(layout.exit.x + layout.exit.dx * CELL * .485, 0, layout.exit.z + layout.exit.dz * CELL * .485);
  doorGroup.rotation.y = Math.atan2(-layout.exit.dx, -layout.exit.dz);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.22, 2.5, .09), materials.darkMetal); doorFrame.position.y = 1.25; doorGroup.add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.08, 2.35, .12), materials.door); door.position.set(0, 1.19, .045); doorGroup.add(door);
  const knob = new THREE.Mesh(new THREE.BoxGeometry(.16, .035, .08), materials.fixture); knob.position.set(.36, 1.1, .15); doorGroup.add(knob);
  const signCanvas = document.createElement('canvas'); signCanvas.width = 256; signCanvas.height = 80;
  const signCtx = signCanvas.getContext('2d'); signCtx.fillStyle = '#17412b'; signCtx.fillRect(0, 0, 256, 80); signCtx.fillStyle = '#e6ffe9'; signCtx.font = 'bold 52px sans-serif'; signCtx.textAlign = 'center'; signCtx.fillText('EXIT →', 128, 59);
  const signTexture = new THREE.CanvasTexture(signCanvas); signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(.8, .25), new THREE.MeshBasicMaterial({ map: signTexture })); sign.position.set(0, 2.72, .08); doorGroup.add(sign); group.add(doorGroup);
  const lights = [];
  for (let i = 0; i < 10; i++) { const light = new THREE.PointLight('#fff2c6', 15, 14, 2); light.position.y = HEIGHT - .3; scene.add(light); lights.push(light); }
  let lastLightUpdate = -100;
  function updateLights(position, time) {
    if (time - lastLightUpdate > .45) {
      lightPositions.sort((a, b) => Math.hypot(a.x - position.x, a.z - position.z) - Math.hypot(b.x - position.x, b.z - position.z));
      lights.forEach((light, i) => { const p = lightPositions[i]; if (!p) return; light.position.set(p.x, HEIGHT - .24, p.z); light.userData.fixture = p; });
      lastLightUpdate = time;
    }
    lights.forEach(light => { const p = light.userData.fixture; if (!p) return; const flicker = .97 + Math.sin(time * 1.7 + p.phase) * .025; light.intensity = p.broken ? .5 : 19 * flicker; });
  }
  function blocked(x, z, radius = .23) {
    return [[x - radius, z - radius], [x + radius, z - radius], [x - radius, z + radius], [x + radius, z + radius]].some(([px, pz]) => layout.grid[Math.floor(pz / CELL)]?.[Math.floor(px / CELL)] !== 0);
  }
  function dispose() {
    group.traverse(o => { o.geometry?.dispose(); });
    for (const m of Object.values(materials)) { for (const value of Object.values(m)) if (value?.isTexture) value.dispose(); m.dispose(); }
    signTexture.dispose(); sign.material.dispose(); scene.remove(group); lights.forEach(l => scene.remove(l));
  }
  return { ...layout, group, blocked, updateLights, dispose };
}

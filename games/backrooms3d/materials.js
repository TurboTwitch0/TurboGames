// Every texture is generated locally so a room never depends on a remote image host.
// Apply these physical sizes to geometry UVs; one UV repeat equals this many metres.
export const MATERIAL_SCALE = Object.freeze({
  wallpaper: { width: 1.2, height: 2.85 },
  carpet: { width: 3, height: 3 },
  ceiling: { width: 1.2, height: 1.2 },
  door: { width: 1, height: 2.2 },
});

function random(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(width, height = width) {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return [element, element.getContext('2d')];
}

function grain(ctx, width, height, base, amount, seed, variation) {
  const rnd = random(seed);
  const image = ctx.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      const noise = (rnd() - 0.5) * amount;
      const cloud = variation ? variation(x / width, y / height) : 0;
      image.data[at] = base[0] + noise + cloud;
      image.data[at + 1] = base[1] + noise + cloud;
      image.data[at + 2] = base[2] + noise * 0.8 + cloud * 0.8;
      image.data[at + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function wallpaperCanvas() {
  const [image, ctx] = canvas(512, 1024);
  const rnd = random(38129);
  grain(ctx, 512, 1024, [181, 165, 101], 13, 441,
    (u, v) => Math.sin(u * Math.PI * 6) * 2 + Math.sin(v * Math.PI * 4 + u * 9) * 3);

  // Faded printed wallpaper: vertical stems and a small repeating damask leaf.
  ctx.strokeStyle = 'rgba(106, 99, 55, .21)';
  ctx.fillStyle = 'rgba(113, 104, 58, .15)';
  ctx.lineWidth = 1.3;
  for (let column = 0; column < 8; column++) {
    const centerX = column * 64 + 32;
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    for (let y = 0; y <= 1024; y += 4) {
      ctx.lineTo(centerX + Math.sin(y / 23) * 3.5, y);
    }
    ctx.stroke();
    for (let row = -1; row < 17; row++) {
      const centerY = row * 64 + (column % 2) * 32;
      for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY + 17);
        ctx.bezierCurveTo(centerX + sign * 17, centerY + 8,
          centerX + sign * 20, centerY - 5, centerX + sign * 9, centerY - 13);
        ctx.bezierCurveTo(centerX + sign * 2, centerY - 5,
          centerX + sign * 4, centerY + 3, centerX, centerY + 17);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - 19);
      ctx.lineTo(centerX + 5, centerY - 11);
      ctx.lineTo(centerX, centerY - 4);
      ctx.lineTo(centerX - 5, centerY - 11);
      ctx.closePath();
      ctx.stroke();
    }
  }

  // The paper has darkened along the carpet line, with irregular damp patches.
  const damp = ctx.createLinearGradient(0, 780, 0, 1024);
  damp.addColorStop(0, 'rgba(79, 74, 44, 0)');
  damp.addColorStop(0.8, 'rgba(79, 74, 44, .10)');
  damp.addColorStop(1, 'rgba(66, 62, 35, .25)');
  ctx.fillStyle = damp;
  ctx.fillRect(0, 780, 512, 244);
  for (let i = 0; i < 18; i++) {
    const x = rnd() * 512, y = 880 + rnd() * 170, radius = 30 + rnd() * 110;
    const stain = ctx.createRadialGradient(x, y, 0, x, y, radius);
    stain.addColorStop(0, 'rgba(70, 68, 39, .13)');
    stain.addColorStop(0.7, 'rgba(80, 75, 41, .06)');
    stain.addColorStop(1, 'rgba(80, 75, 41, 0)');
    ctx.fillStyle = stain;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  for (let i = 0; i < 110; i++) {
    const x = rnd() * 512, y = rnd() * 1024;
    ctx.strokeStyle = `rgba(75, 67, 37, ${0.03 + rnd() * 0.08})`;
    ctx.lineWidth = 0.5 + rnd();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 13, y + rnd() * 29);
    ctx.stroke();
  }
  // Narrow paper joint repeats every 1.2 metres, rather than screen-space stripes.
  ctx.fillStyle = 'rgba(82, 75, 42, .18)';
  ctx.fillRect(0, 0, 1, 1024);
  ctx.fillStyle = 'rgba(235, 219, 146, .14)';
  ctx.fillRect(1, 0, 1, 1024);
  return image;
}

function carpetCanvas() {
  const [image, ctx] = canvas(512);
  const rnd = random(93511);
  grain(ctx, 512, 512, [112, 103, 76], 38, 6152, (u, v) =>
    5 * Math.sin(u * Math.PI * 2) * Math.cos(v * Math.PI * 4) +
    3 * Math.sin((u + v) * Math.PI * 6));

  // Fine, uneven loops make the floor read as low-pile carpet at walking height.
  for (let i = 0; i < 32000; i++) {
    const x = rnd() * 512, y = rnd() * 512;
    const light = rnd() > 0.48;
    ctx.strokeStyle = light ? 'rgba(208, 192, 143, .16)' : 'rgba(42, 40, 28, .24)';
    ctx.lineWidth = 0.65;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 1.8, y + 1 + rnd() * 2.5);
    ctx.stroke();
  }
  // Periodic copies keep damp patches continuous when the texture repeats.
  for (let i = 0; i < 11; i++) {
    const x = rnd() * 512, y = rnd() * 512, radius = 14 + rnd() * 64;
    for (const dx of [-512, 0, 512]) for (const dy of [-512, 0, 512]) {
      const stain = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
      stain.addColorStop(0, 'rgba(47, 46, 28, .18)');
      stain.addColorStop(0.6, 'rgba(50, 46, 28, .07)');
      stain.addColorStop(1, 'rgba(50, 46, 28, 0)');
      ctx.fillStyle = stain;
      ctx.fillRect(x + dx - radius, y + dy - radius, radius * 2, radius * 2);
    }
  }
  return image;
}

function ceilingCanvas() {
  const [image, ctx] = canvas(512);
  const rnd = random(773122);
  grain(ctx, 512, 512, [204, 199, 167], 14, 2713, (u, v) =>
    Math.sin(u * Math.PI * 4) * Math.cos(v * Math.PI * 4) * 2);
  for (let i = 0; i < 13500; i++) {
    const x = rnd() * 512, y = rnd() * 512;
    ctx.fillStyle = `rgba(67, 65, 49, ${0.06 + rnd() * 0.2})`;
    ctx.fillRect(x, y, 0.6 + rnd() * 1.9, 0.6 + rnd() * 1.9);
  }
  // Four 60cm acoustic tiles, held by an aging exposed T-bar grid.
  for (const at of [0, 256, 512]) {
    ctx.fillStyle = '#888570';
    ctx.fillRect(at - 3, 0, 6, 512);
    ctx.fillRect(0, at - 3, 512, 6);
    ctx.fillStyle = '#c0bda5';
    ctx.fillRect(at - 1, 0, 2, 512);
    ctx.fillRect(0, at - 1, 512, 2);
    ctx.fillStyle = 'rgba(54, 51, 35, .22)';
    ctx.fillRect(at + 3, 0, 2, 512);
    ctx.fillRect(0, at + 3, 512, 2);
  }
  const stain = ctx.createRadialGradient(370, 155, 30, 370, 155, 110);
  stain.addColorStop(0, 'rgba(123, 104, 50, .02)');
  stain.addColorStop(0.78, 'rgba(123, 104, 50, .03)');
  stain.addColorStop(0.84, 'rgba(123, 104, 50, .12)');
  stain.addColorStop(0.91, 'rgba(123, 104, 50, .04)');
  stain.addColorStop(1, 'rgba(123, 104, 50, 0)');
  ctx.fillStyle = stain;
  ctx.fillRect(256, 5, 250, 245);
  return image;
}

function doorCanvas() {
  const [image, ctx] = canvas(256, 512);
  const rnd = random(44);
  grain(ctx, 256, 512, [117, 119, 93], 10, 1888,
    (u, v) => Math.sin(u * 25) * 1.5 + Math.cos(v * 4) * 3);
  ctx.strokeStyle = 'rgba(39, 44, 33, .3)';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 24, 216, 201);
  ctx.strokeRect(20, 263, 216, 225);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = 'rgba(49, 49, 33, .15)';
    ctx.fillRect(rnd() * 256, 390 + rnd() * 122, 3 + rnd() * 20, 1);
  }
  return image;
}

export function createBackroomsMaterials(THREE) {
  function texture(source) {
    const result = new THREE.CanvasTexture(source);
    result.wrapS = result.wrapT = THREE.RepeatWrapping;
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 4;
    return result;
  }
  const wallpaper = texture(wallpaperCanvas());
  const carpet = texture(carpetCanvas());
  const ceiling = texture(ceilingCanvas());
  const door = texture(doorCanvas());
  return {
    wallpaper: new THREE.MeshStandardMaterial({ map: wallpaper, roughness: 0.94, metalness: 0 }),
    carpet: new THREE.MeshStandardMaterial({ map: carpet, roughness: 1, metalness: 0 }),
    ceiling: new THREE.MeshStandardMaterial({ map: ceiling, roughness: 0.96, metalness: 0 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x716b45, roughness: 0.86 }),
    fixture: new THREE.MeshStandardMaterial({ color: 0xb8b6a3, roughness: 0.68, metalness: 0.25 }),
    diffuser: new THREE.MeshStandardMaterial({ color: 0xfff6d4, emissive: 0xffedbb, emissiveIntensity: 2.1, roughness: 0.42 }),
    door: new THREE.MeshStandardMaterial({ map: door, roughness: 0.81, metalness: 0.05 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x383b32, roughness: 0.63, metalness: 0.5 }),
  };
}

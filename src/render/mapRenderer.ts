import {
  BufferImageSource,
  Container,
  Mesh,
  MeshGeometry,
  Shader,
  Texture,
  UniformGroup,
} from 'pixi.js';
import type { World } from '../sim/world';

// The map is a single rectangle. For each pixel, the shader:
// 1) reads the province ID from the IDs texture,
// 2) looks up the province color in the palette texture (1 pixel = 1 province),
// 3) draws a border where an adjacent pixel has a different ID and highlights the selected province.
const VERTEX = `#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uIds;
uniform sampler2D uPalette;
uniform vec2 uTexel;
uniform float uSelected;

float idAt(vec2 uv) {
  vec4 c = texture(uIds, uv);
  return floor(c.r * 255.0 + 0.5) + floor(c.g * 255.0 + 0.5) * 256.0;
}

vec3 colorOf(float id) {
  float lo = mod(id, 256.0);
  float hi = floor(id / 256.0);
  return texture(uPalette, vec2((lo + 0.5) / 256.0, (hi + 0.5) / 256.0)).rgb;
}

void main() {
  float id = idAt(vUV);
  vec3 col = colorOf(id);

  if (abs(id - uSelected) < 0.5) col = mix(col, vec3(1.0), 0.45);

  bool border = idAt(vUV + vec2(uTexel.x, 0.0)) != id || idAt(vUV + vec2(0.0, uTexel.y)) != id;
  if (border) col *= 0.45;

  finalColor = vec4(col, 1.0);
}`;

export class MapRenderer {
  readonly view = new Container();
  private paletteData = new Uint8Array(256 * 256 * 4);
  private paletteSource: BufferImageSource;
  private uniforms: UniformGroup;

  private world: World;

  constructor(world: World) {
    this.world = world;
    const { width, height, ids } = world;

    // ID texture: R = low byte of the ID, G = high byte (supports up to 65,535 provinces).
    const idData = new Uint8Array(width * height * 4);
    for (let i = 0; i < ids.length; i++) {
      idData[i * 4] = ids[i] & 255;
      idData[i * 4 + 1] = ids[i] >> 8;
      idData[i * 4 + 3] = 255;
    }
    const idSource = new BufferImageSource({
      resource: idData,
      width,
      height,
      format: 'rgba8unorm',
      scaleMode: 'nearest',
    });

    this.paletteSource = new BufferImageSource({
      resource: this.paletteData,
      width: 256,
      height: 256,
      format: 'rgba8unorm',
      scaleMode: 'nearest',
    });

    this.uniforms = new UniformGroup({
      uTexel: { value: new Float32Array([1 / width, 1 / height]), type: 'vec2<f32>' },
      uSelected: { value: -1, type: 'f32' },
    });

    const shader = Shader.from({
      gl: { vertex: VERTEX, fragment: FRAGMENT },
      resources: {
        uIds: idSource,
        uPalette: this.paletteSource,
        mapUniforms: this.uniforms,
      },
    });

    const geometry = new MeshGeometry({
      positions: new Float32Array([0, 0, width, 0, width, height, 0, height]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });

    this.view.addChild(new Mesh({ geometry, shader, texture: Texture.EMPTY }));
    this.refreshColors();
  }

  /** Updates province colors based on their current owners (efficient: 1 pixel per province). */
  refreshColors() {
    for (const p of this.world.provinces) {
      const [r, g, b] = this.world.countries[p.owner].color;
      const o = p.id * 4;
      this.paletteData[o] = r;
      this.paletteData[o + 1] = g;
      this.paletteData[o + 2] = b;
      this.paletteData[o + 3] = 255;
    }
    this.paletteSource.update();
  }

  setSelected(id: number) {
    this.uniforms.uniforms.uSelected = id;
  }

  /** Returns the province ID at a point in map coordinates, or -1 if outside the map. */
  provinceAt(mapX: number, mapY: number): number {
    const x = Math.floor(mapX);
    const y = Math.floor(mapY);
    if (x < 0 || y < 0 || x >= this.world.width || y >= this.world.height) return -1;
    return this.world.ids[y * this.world.width + x];
  }
}
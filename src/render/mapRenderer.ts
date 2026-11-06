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

// The map is a single rectangle drawn by one shader. For every screen pixel it:
// 1) looks at the 4x4 texels around the pixel and picks the province with the highest smoothed score,
//    which turns the blocky texel borders into smooth, rounded ones (also along coasts),
// 2) colors the pixel with the owner's color (palette texture, indexed by province id),
// 3) draws a thin line between provinces, a thicker one between states and the thickest between
//    countries. Province lines fade in when zooming in, like in Hearts of Iron IV.
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
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uIds;      // R = low byte, G = high byte of the province id
uniform sampler2D uPalette;  // RGB = color of the province owner, indexed by province id
uniform sampler2D uMeta;     // R = owner id, G/B = low/high byte of the state id, indexed by province id
uniform vec2 uSize;          // map size in texels
uniform float uSelected;     // selected province id, -1 for none
uniform float uZoom;         // current map scale (screen pixels per texel)

int idAt(ivec2 p) {
  p = clamp(p, ivec2(0), ivec2(uSize) - ivec2(1));
  vec4 c = texelFetch(uIds, p, 0);
  return int(c.r * 255.0 + 0.5) + int(c.g * 255.0 + 0.5) * 256;
}
vec4 metaAt(int id) {
  return texelFetch(uMeta, ivec2(id & 255, id >> 8), 0);
}
int ownerOf(int id) {
  return int(metaAt(id).r * 255.0 + 0.5);
}
int stateOf(int id) {
  vec4 m = metaAt(id);
  return int(m.g * 255.0 + 0.5) + int(m.b * 255.0 + 0.5) * 256;
}

void main() {
  vec2 p = vUV * uSize - 0.5;
  ivec2 base = ivec2(floor(p));
  vec2 f = p - vec2(base);

  // Weights of the 4 texels along each axis. At low zoom a cubic B-spline turns the blocky raster
  // into rounded borders, but magnified it would smear every border across tens of screen pixels
  // and lines would break. So the weights fade to plain bilinear (exact texel edges) as we zoom in.
  float sharp = smoothstep(2.5, 7.0, uZoom);
  vec4 wxB = vec4(
    (1.0 - f.x) * (1.0 - f.x) * (1.0 - f.x),
    3.0 * f.x * f.x * f.x - 6.0 * f.x * f.x + 4.0,
    -3.0 * f.x * f.x * f.x + 3.0 * f.x * f.x + 3.0 * f.x + 1.0,
    f.x * f.x * f.x
  ) / 6.0;
  vec4 wyB = vec4(
    (1.0 - f.y) * (1.0 - f.y) * (1.0 - f.y),
    3.0 * f.y * f.y * f.y - 6.0 * f.y * f.y + 4.0,
    -3.0 * f.y * f.y * f.y + 3.0 * f.y * f.y + 3.0 * f.y + 1.0,
    f.y * f.y * f.y
  ) / 6.0;
  vec4 wx = mix(wxB, vec4(0.0, 1.0 - f.x, f.x, 0.0), sharp);
  vec4 wy = mix(wyB, vec4(0.0, 1.0 - f.y, f.y, 0.0), sharp);

  int ids16[16];
  float w16[16];
  bool same = true;
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      int id = idAt(base + ivec2(i - 1, j - 1));
      ids16[j * 4 + i] = id;
      w16[j * 4 + i] = wx[i] * wy[j];
      if (id != ids16[0]) same = false;
    }
  }

  int bestId = ids16[0];
  int secondId = ids16[0];
  float margin = 1.0;
  if (!same) {
    float bestScore = 0.0;
    float secondScore = 0.0;
    for (int k = 0; k < 16; k++) {
      int id = ids16[k];
      bool seen = false;
      for (int m = 0; m < k; m++) {
        if (ids16[m] == id) { seen = true; }
      }
      if (seen) { continue; }
      float s = 0.0;
      for (int m = k; m < 16; m++) {
        if (ids16[m] == id) { s += w16[m]; }
      }
      if (ownerOf(id) != 0) { s *= 1.35; } // small islands must not vanish into the sea
      if (s > bestScore) {
        secondScore = bestScore;
        secondId = bestId;
        bestScore = s;
        bestId = id;
      } else if (s > secondScore) {
        secondScore = s;
        secondId = id;
      }
    }
    margin = bestScore - secondScore;
  }

  vec3 col = texelFetch(uPalette, ivec2(bestId & 255, bestId >> 8), 0).rgb;
  if (uSelected >= 0.0 && bestId == int(uSelected + 0.5)) { col = mix(col, vec3(1.0), 0.4); }

  // Distance (in screen pixels) from the border between the two best candidates. The gradient
  // length is used instead of fwidth(): fwidth is an L1 norm, so borders at 45 degrees come out up
  // to 1.4x thinner and break into dots once the line gets thin.
  float grad = length(vec2(dFdx(margin), dFdy(margin)));
  float dist = margin / max(grad, 1e-6);
  float lineWidth = 0.0;
  float lineAlpha = 0.0;
  vec3 lineColor = vec3(0.0);
  if (!same) {
    float stateFade = smoothstep(0.35, 0.9, uZoom);
    float provinceFade = smoothstep(0.6, 1.4, uZoom);
    bool sea1 = ownerOf(bestId) == 0;
    bool sea2 = ownerOf(secondId) == 0;
    if (sea1 && sea2) {
      // sea region borders are stronger than borders between sea provinces
      lineColor = vec3(0.35, 0.55, 0.8);
      if (stateOf(bestId) != stateOf(secondId)) {
        lineWidth = 1.4;
        lineAlpha = 0.55 * stateFade;
      } else {
        lineWidth = 0.8;
        lineAlpha = 0.25 * provinceFade;
      }
    } else if (sea1 != sea2) {
      lineWidth = 1.0;
      lineAlpha = 0.55;
      lineColor = vec3(0.03, 0.06, 0.1);
    } else if (ownerOf(bestId) != ownerOf(secondId)) {
      lineWidth = 2.2;
      lineAlpha = 0.95;
    } else if (stateOf(bestId) != stateOf(secondId)) {
      lineWidth = 1.5;
      lineAlpha = 0.7 * stateFade;
    } else {
      lineWidth = 1.0;
      lineAlpha = 0.45 * provinceFade;
    }
  }
  // A thin line keeps a full pixel wide anti-aliasing ramp and gives up alpha instead of width, so
  // a border that fades in with zoom stays continuous instead of turning into a dotted line.
  float halfWidth = max(lineWidth, 1.0) * 0.5;
  float coverage = (1.0 - smoothstep(halfWidth - 0.5, halfWidth + 0.5, dist)) * min(1.0, lineWidth);
  col = mix(col, lineColor, coverage * lineAlpha);

  finalColor = vec4(col, 1.0);
}`;

export class MapRenderer {
  readonly view = new Container();
  private paletteData = new Uint8Array(256 * 256 * 4);
  private metaData = new Uint8Array(256 * 256 * 4);
  private paletteSource: BufferImageSource;
  private metaSource: BufferImageSource;
  private uniforms: UniformGroup;
  private world: World;

  constructor(world: World) {
    this.world = world;
    const { width, height, ids } = world;

    // Id texture: R = low byte of the id, G = high byte (up to 65535 provinces).
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
    this.metaSource = new BufferImageSource({
      resource: this.metaData,
      width: 256,
      height: 256,
      format: 'rgba8unorm',
      scaleMode: 'nearest',
    });

    this.uniforms = new UniformGroup({
      uSize: { value: new Float32Array([width, height]), type: 'vec2<f32>' },
      uSelected: { value: -1, type: 'f32' },
      uZoom: { value: 1, type: 'f32' },
    });

    const shader = Shader.from({
      gl: { vertex: VERTEX, fragment: FRAGMENT },
      resources: {
        uIds: idSource,
        uPalette: this.paletteSource,
        uMeta: this.metaSource,
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

  /** Rewrites province colors from the current owners (cheap: 1 texel per province). */
  refreshColors() {
    for (const p of this.world.provinces) {
      const [r, g, b] = this.world.countries[p.owner].color;
      const o = p.id * 4;
      this.paletteData[o] = r;
      this.paletteData[o + 1] = g;
      this.paletteData[o + 2] = b;
      this.paletteData[o + 3] = 255;
      this.metaData[o] = p.owner;
      this.metaData[o + 1] = p.state & 255;
      this.metaData[o + 2] = p.state >> 8;
      this.metaData[o + 3] = 255;
    }
    this.paletteSource.update();
    this.metaSource.update();
  }

  setSelected(id: number) {
    this.uniforms.uniforms.uSelected = id;
  }

  /** Tell the shader how far the map is zoomed in (it fades province borders in and out). */
  setZoom(scale: number) {
    this.uniforms.uniforms.uZoom = scale;
  }

  /** Province id under a point in map coordinates, or -1 outside the map. */
  provinceAt(mapX: number, mapY: number): number {
    const x = Math.floor(mapX);
    const y = Math.floor(mapY);
    if (x < 0 || y < 0 || x >= this.world.width || y >= this.world.height) return -1;
    return this.world.ids[y * this.world.width + x];
  }
}
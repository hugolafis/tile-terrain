import * as THREE from 'three';
import { Resolver } from 'webpack';

export interface TileParameters {
  position: THREE.Vector2Like;
  depth: number;
  heightBuffer: Uint8Array;
  normalBuffer: Uint8Array;
  dataXResolution: number;
  coords: THREE.Vector2Like; 
  parentUvTransform: THREE.Matrix3;
}

//const imageResolution = 4096;

const tileResolution = 64;
const terrainHeight = 1; // move elsewhere

const red = new THREE.Color(0xff0000);
const green = new THREE.Color(0x00ff00);

// todo - the vertex share edges, but are effectively sampling different texels at the moment
// todo implement the UV coordinates and interpolated sampling CPU side?

// shouldn't be a mesh itself, but have an optional mesh property? (if it's a leaf)

// todo fix the y flipping...
export class Tile extends THREE.Group {
  readonly tiles: Tile[];
  private mesh?: THREE.Mesh;

  readonly depth: number;
  private readonly heightBuffer: Uint8Array;
  private readonly normalBuffer: Uint8Array;
  private readonly dataXResolution: number; // todo actually use this...
  private readonly coords: THREE.Vector2Like;

  private readonly uvTransform: THREE.Matrix3;

  constructor(params: TileParameters) {
    super();

    this.tiles = [];
    this.depth = params.depth;

    this.heightBuffer = params.heightBuffer;
    this.normalBuffer = params.normalBuffer;

    this.dataXResolution = params.dataXResolution;
    this.coords = params.coords;

    this.uvTransform = new THREE.Matrix3();
  
    if (this.depth !== 0) {
      this.uvTransform.setUvTransform(this.coords.x * 0.5, 0.5 - this.coords.y * 0.5, 0.5, 0.5, 0, 0, 0)
    }

    this.uvTransform.premultiply(params.parentUvTransform);

    this.position.set(params.position.x, 0, params.position.y);
  }

  get isLeaf() {
    return !this.tiles.length;
  }

  createMesh() {
    const segments = tileResolution - 1;
    const invDepthDivisor = 1.0 / Math.pow(2, this.depth);
    const geometry = new THREE.PlaneGeometry(1, 1, segments, segments)
      .scale(invDepthDivisor, invDepthDivisor, 1)
      .rotateX(-Math.PI * 0.5);

    //const indexAttrib = geometry.index!;
    const uvAttrib = geometry.getAttribute("uv");
    const positionAttrib = geometry.getAttribute("position");
    const normalAttrib = geometry.getAttribute("normal");

    const position = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const uv = new THREE.Vector2();
    for (let i = 0; i < positionAttrib.count; i++) {
      position.fromArray(positionAttrib.array, i * 3);
      normal.fromArray(normalAttrib.array, i * 3); // making some assumptions that these are in the same order
      uv.fromArray(uvAttrib.array, i * 2);
      uv.applyMatrix3(this.uvTransform);

      position.y = (bilinearSample(uv.x, 1.0 - uv.y, this.heightBuffer, 4096) / 255) * 0.1;
      normal.copy(bilinearSampleXYZ(uv.x, 1.0 - uv.y, this.normalBuffer, 2048)).divideScalar(255).multiplyScalar(2).subScalar(1).normalize();

      // swizzle
      const z = normal.z;
      normal.z = normal.y;
      normal.y = z;

      position.toArray(positionAttrib.array, i * 3);
      normal.toArray(normalAttrib.array, i * 3);
    }

    //geometry.computeVertexNormals();

    const color = new THREE.Color().lerpColors(red, green, this.depth / 5);
    //const material = new THREE.MeshBasicMaterial({ wireframe: true, color });
    const material = new THREE.MeshStandardMaterial({ wireframe: false, color });

    this.mesh = new THREE.Mesh(geometry, material);
    this.add(this.mesh);
  }

  subdivide(maxDepth: number) {
    if (!this.isLeaf) return;
    if (this.depth === maxDepth) return;

    const invChildDepthDivisor = 1.0 / Math.pow(2, this.depth + 1);
    const position = new THREE.Vector2();
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        position.set(x, y).multiplyScalar(2).subScalar(1).multiplyScalar(invChildDepthDivisor).multiplyScalar(0.5); // todo improve this...
        const child = new Tile({
          position,
          depth: this.depth + 1,
          heightBuffer: this.heightBuffer,
          normalBuffer: this.normalBuffer,
          dataXResolution: this.dataXResolution,
          coords: { x, y },
          parentUvTransform: this.uvTransform,
        });
        //child.scale.setScalar(0.5);
        child.createMesh();

        this.add(child);
        this.tiles.push(child);
      }
    }

    if (this.mesh) {
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.remove(this.mesh);
      this.mesh = undefined;
    }
  }

  unify() {
    if (this.isLeaf) return;
    if (!this.tiles.every(t => t.isLeaf)) return;

    this.tiles.forEach(t => {
      t.disposeMesh();
      this.remove(t);
    });

    this.createMesh();

    this.tiles.length = 0;
  }

  depthTraverse(callback: (Tile: Tile) => void) {
    this.tiles.forEach(t => t.depthTraverse(callback));

    callback(this);
  }

  disposeMesh() {
    if (!this.mesh) return;

    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.remove(this.mesh);
  }
}

function lerp(a: number, b: number, t: number) {
  return a * (1 - t) + b * t;
}


//const normalizationFactor = 1 / 255; // uint8 to float

function bilinearSample(x: number, y: number, buffer: Uint8Array, imageResolution: number, stride = 1, offset = 0) {
  const invTexelSize = 1 / imageResolution;
  const invHalfTexelSize = invTexelSize * 0.5;
  const maxXIndice = imageResolution - 1;

  const xLeft = Math.floor(x * maxXIndice); // 0-4095 (for example)
  const xRight = Math.ceil(x * maxXIndice);
  const yUp = Math.floor(y * maxXIndice);
  const yDown = Math.ceil(y * maxXIndice);

  const xFrac = (x * maxXIndice) % 1;
  const yFrac = (y * maxXIndice) % 1;

  // left to right, in rows
  const texelAIndice = (yUp * imageResolution + xLeft) * stride + offset;
  const texelBIndice = (yUp * imageResolution + xRight) * stride + offset;
  const texelCIndice = (yDown * imageResolution + xLeft) * stride + offset;
  const texelDIndice = (yDown * imageResolution + xRight) * stride + offset;

  const texelA = buffer[texelAIndice];
  const texelB = buffer[texelBIndice];
  const texelC = buffer[texelCIndice];
  const texelD = buffer[texelDIndice];

  const horzA = lerp(texelA, texelB, xFrac - invHalfTexelSize);
  const horzB = lerp(texelC, texelD, xFrac - invHalfTexelSize);

  return lerp(horzA, horzB, yFrac - invHalfTexelSize);
}

const helper = new THREE.Vector3();
function bilinearSampleXYZ(x: number, y: number, buffer: Uint8Array, imageResolution: number): THREE.Vector3 {
  helper.set(
    bilinearSample(x, y, buffer, imageResolution, 4, 0),
    bilinearSample(x, y, buffer, imageResolution, 4, 1),
    bilinearSample(x, y, buffer, imageResolution, 4, 2),
  )

  return helper;
}
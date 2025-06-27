import * as THREE from 'three';
import { Resolver } from 'webpack';

export interface TileParameters {
  position: THREE.Vector2Like;
  depth: number;
  dataBuffer: Uint8Array;
  dataXResolution: number;
  index: number;
  parentColumnOffset: number;
  parentRowOffset: number;
}

const imageResolution = 4096;

const tileResolution = 64;
const terrainHeight = 1; // move elsewhere

const red = new THREE.Color(0xff0000);
const green = new THREE.Color(0x00ff00);

// todo - the vertex share edges, but are effectively sampling different texels at the moment

// shouldn't be a mesh itself, but have an optional mesh property? (if it's a leaf)
export class Tile extends THREE.Group {
  readonly tiles: Tile[];
  private mesh?: THREE.Mesh;

  readonly depth: number;
  private readonly dataBuffer: Uint8Array;
  private readonly dataXResolution: number;
  private readonly index: number;

  private readonly parentColumnOffset: number;
  private readonly parentRowOffset: number;

  constructor(params: TileParameters) {
    super();

    this.tiles = [];
    this.depth = params.depth;

    this.dataBuffer = params.dataBuffer;
    this.dataXResolution = params.dataXResolution;
    this.index = params.index;
    this.parentColumnOffset = params.parentColumnOffset;
    this.parentRowOffset = params.parentRowOffset;

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

    const positionAttrib = geometry.getAttribute('position');
    const vertex = new THREE.Vector3();

    const stride = imageResolution / tileResolution;

    const tileColumnIndex = this.index % 2;
    const tileRowIndex = Math.floor(this.index / 2);

    const scaling = 0.5; // todo variable on depth

    const tileColumnOffset = imageResolution * invDepthDivisor * tileColumnIndex;
    const tileRowOffset = imageResolution * invDepthDivisor * tileRowIndex * imageResolution;

    for (let y = 0; y < tileResolution; y++) {
      for (let x = 0; x < tileResolution; x++) {
        const posIndice = (y * tileResolution + x) * 3;
        vertex.fromArray(positionAttrib.array, posIndice);

        const columnOffset = x * stride * invDepthDivisor;
        const rowOffset = y * stride * tileResolution * stride * invDepthDivisor;

        const imageIndice =
          columnOffset + tileColumnOffset + this.parentColumnOffset + rowOffset + tileRowOffset + this.parentRowOffset;

        //const imageIndice = columnOffset + rowOffset;
        vertex.y = (this.dataBuffer[imageIndice] / 255) * 0.1;
        vertex.toArray(positionAttrib.array, posIndice);
      }
    }

    const color = new THREE.Color().lerpColors(red, green, this.depth / 4);
    const material = new THREE.MeshBasicMaterial({ wireframe: true, color });

    this.mesh = new THREE.Mesh(geometry, material);
    this.add(this.mesh);
  }

  subdivide(maxDepth: number) {
    if (!this.isLeaf) return;
    if (this.depth === maxDepth) return;

    const tileColumnIndex = this.index % 2;
    const tileRowIndex = Math.floor(this.index / 2);

    const invDepthDivisor = 1.0 / Math.pow(2, this.depth);
    const tileColumnOffset = imageResolution * invDepthDivisor * tileColumnIndex;
    const tileRowOffset = imageResolution * invDepthDivisor * tileRowIndex * imageResolution;

    const invChildDepthDivisor = 1.0 / Math.pow(2, this.depth + 1);
    const position = new THREE.Vector2();
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        position.set(x, y).multiplyScalar(2).subScalar(1).multiplyScalar(invChildDepthDivisor).multiplyScalar(0.5); // todo improve this...
        //console.log(y * 2 + x);
        const child = new Tile({
          position,
          depth: this.depth + 1,
          dataBuffer: this.dataBuffer,
          dataXResolution: this.dataXResolution,
          index: y * 2 + x,
          parentColumnOffset: this.parentColumnOffset + tileColumnOffset,
          parentRowOffset: this.parentRowOffset + tileRowOffset,
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
    //if (this.depth === 0) return;
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

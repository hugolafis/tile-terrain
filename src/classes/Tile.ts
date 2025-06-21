import * as THREE from 'three';
import { Resolver } from 'webpack';

export interface TileParameters {
  position: THREE.Vector2Like;
  depth: number;
  dataBuffer: Uint8Array;
  dataXResolution: number;
  index: number;
}

const tileXResolution = 64;
const terrainHeight = 1; // move elsewhere

const red = new THREE.Color(0xff0000);
const green = new THREE.Color(0x00ff00);

// shouldn't be a mesh itself, but have an optional mesh property? (if it's a leaf)
export class Tile extends THREE.Group {
  readonly tiles: Tile[];
  private mesh?: THREE.Mesh;

  readonly depth: number;
  private readonly dataBuffer: Uint8Array;
  private readonly dataXResolution: number;
  private readonly index: number;

  constructor(params: TileParameters) {
    super();

    this.tiles = [];
    this.depth = params.depth;

    this.dataBuffer = params.dataBuffer;
    this.dataXResolution = params.dataXResolution;
    this.index = params.index;

    this.position.set(params.position.x, 0, params.position.y);
  }

  get isLeaf() {
    return !this.tiles.length;
  }

  createMesh() {
    const divisor = tileXResolution - 1;
    const geometry = new THREE.PlaneGeometry(1, 1, divisor, divisor).rotateX(-Math.PI * 0.5);

    //const blockScale = 1.0 / Math.max(1, Math.pow(2, this.depth));
    const stride = this.dataXResolution / divisor; // todo not really vertex count at all...

    const depthScale = 1.0 / Math.pow(2, this.depth);
    console.log(depthScale);

    const positionAttrib = geometry.getAttribute('position');
    const vertex = new THREE.Vector3();

    const scaledResolution = this.dataXResolution * depthScale;

    const tileOffset = this.dataXResolution * 0.5 * this.index; // todo tile depth
    const scale = (this.dataXResolution - 1) / divisor;

    for (let y = 0; y < tileXResolution; y++) {
      for (let x = 0; x < tileXResolution; x++) {
        const posIndice = (y * tileXResolution + x) * 3;
        vertex.fromArray(positionAttrib.array, posIndice);

        // const columnOffset = Math.max(0, x * divisor * stride - 1);
        // const rowOffset = Math.max(0, y * divisor * stride * stride);

        const columnOffset = Math.max(0, x * scale - 1);
        const rowOffset = y * scale;

        //vertex.y = Math.random();
        //const imageIndice = rowOffset + columnOffset;
        const imageIndice = rowOffset * this.dataXResolution + columnOffset;
        vertex.y = (this.dataBuffer[imageIndice] / 255) * 0.25;

        vertex.toArray(positionAttrib.array, posIndice);

        /*
        const posIndice = (y * vertexCount + x) * 3;
        vertex.fromArray(positionAttrib.array, posIndice);

        const rowOffset = y * this.dataXResolution;
        const columnOffset = x;

        // const rowOffset = y * divisor * vertexCount * divisor;
        // const columnOffset = Math.max(0, x * divisor) * vertexCount;
        //const columnOffset = Math.max(0, x * divisor - 1);

        const indice = rowOffset + columnOffset; // + tileOffset;

        if (indice > this.dataBuffer.length) {
          throw new Error('Out of bounds indice');
        }

        vertex.y = (this.dataBuffer[indice] / 255) * terrainHeight;
        vertex.toArray(positionAttrib.array, posIndice);
        */
      }
    }

    // the starting quad will be one of four
    //const xOffset =

    const color = new THREE.Color().lerpColors(red, green, this.depth / 4);
    const material = new THREE.MeshBasicMaterial({ wireframe: true, color });

    this.mesh = new THREE.Mesh(geometry, material);
    this.add(this.mesh);
  }

  subdivide(maxDepth: number) {
    if (!this.isLeaf) return;
    if (this.depth === maxDepth) return;

    const position = new THREE.Vector2();
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        position.set(x, y).multiplyScalar(2).subScalar(1).multiplyScalar(0.25);
        console.log(y * 2 + x);
        const child = new Tile({
          position,
          depth: this.depth + 1,
          dataBuffer: this.dataBuffer,
          dataXResolution: this.dataXResolution,
          index: y * 2 + x,
        });
        child.scale.setScalar(0.5);
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

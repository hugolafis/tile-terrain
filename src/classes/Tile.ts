import * as THREE from 'three';
import { Resolver } from 'webpack';

export interface TileParameters {
  position: THREE.Vector2Like;
  depth: number;
}

const tileXResolution = 4;

// shouldn't be a mesh itself, but have an optional mesh property? (if it's a leaf)
export class Tile extends THREE.Group {
  readonly tiles: Tile[];
  private mesh?: THREE.Mesh;

  readonly depth: number;

  constructor(params: TileParameters) {
    super();

    this.tiles = [];
    this.depth = params.depth;

    this.position.set(params.position.x, 0, params.position.y);
  }

  get isLeaf() {
    return !this.tiles.length;
  }

  createMesh() {
    const divisors = tileXResolution - 1;
    const geometry = new THREE.PlaneGeometry(1, 1, divisors, divisors).rotateX(-Math.PI * 0.5);
    const material = new THREE.MeshBasicMaterial({ wireframe: true });

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
        const child = new Tile({ position, depth: this.depth + 1 });
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
    if (this.depth === 0) return;
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

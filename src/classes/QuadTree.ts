import * as THREE from 'three';
import { Tile } from './Tile';

// export class Tile {
//   children: Tile[];
//   mesh: TileMesh;

//   constructor() {
//     this.mesh = new TileMesh({ position: new THREE.Vector3(), axisVertexCount: 2 });
//     this.children = [];
//   }

//   subdivide() {
//     this.children = new Array(4).map(() => new Tile());
//   }
// }

const helper = new THREE.Vector3();

export class QuadTree {
  //readonly heirarchy: Tile[];
  readonly root: Tile;

  private readonly maxDepth = 5; // todo this needs to be based on the resolution of the source buffer and tiles

  constructor(private readonly scene: THREE.Scene, heightBuffer: Uint8Array, normalBuffer: Uint8Array, dataXResolution: number) {
    this.root = new Tile({
      position: new THREE.Vector3(),
      depth: 0,
      heightBuffer,
      normalBuffer,
      dataXResolution,
      coords: {x: 0, y: 0},
      parentUvTransform: new THREE.Matrix3().setUvTransform(0, 0, 1, 1, 0, 0, 0),
    });
    this.root.scale.setScalar(128);
    this.root.createMesh();
    //this.root.subdivide(this.maxDepth);

    this.scene.add(this.root);
  }

  update(playerPos: THREE.Vector3) {
    const position = new THREE.Vector3();
    const box3 = new THREE.Box3();

    this.root.depthTraverse(tile => {
      box3.setFromObject(tile);
      //position.copy(tile.position).applyMatrix4(tile.matrixWorld);
      //const distance = position.distanceTo(playerPos);

      const size = box3.getSize(new THREE.Vector3()).length();
      box3.clampPoint(playerPos, helper);
      helper.sub(playerPos);
      const distance = Math.sqrt(helper.x * helper.x + helper.z * helper.z);

      const lodRatio = size / distance;
      if (lodRatio > 5) {
        tile.subdivide(this.maxDepth);
      } else {
        tile.unify();
      }
    });
  }
}

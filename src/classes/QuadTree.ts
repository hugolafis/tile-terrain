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

export class QuadTree {
  //readonly heirarchy: Tile[];
  readonly root: Tile;

  private readonly maxDepth = 3;

  constructor(private readonly scene: THREE.Scene) {
    this.root = new Tile({ position: new THREE.Vector3(), depth: 0 });
    this.root.subdivide();

    // this.heirarchy.forEach(root => {
    //   root.traverse(tile => {
    //     if (tile instanceof Tile) {
    //       if (tile.isLeaf) {
    //         tile.createMesh();
    //       }
    //     }
    //   });
    // });

    this.scene.add(this.root);
  }

  update(playerPos: THREE.Vector3Like) {
    const position = new THREE.Vector3();
    this.root.depthTraverse(tile => {
      position.copy(tile.position).applyMatrix4(tile.matrixWorld);
      const distance = position.distanceTo(playerPos);

      if (distance < 0.3) {
        if (tile.depth < this.maxDepth) {
          tile.subdivide();
        }
      } else {
        if (tile.isLeaf) return;
        tile.unify();
      }
    });
  }
}

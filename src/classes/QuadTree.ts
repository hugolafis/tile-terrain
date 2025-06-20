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

  private readonly maxDepth = 5;

  constructor(private readonly scene: THREE.Scene) {
    this.root = new Tile({ position: new THREE.Vector3(), depth: 0 });
    this.root.subdivide(this.maxDepth);

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

  update(playerPos: THREE.Vector3) {
    const position = new THREE.Vector3();
    const box3 = new THREE.Box3();

    this.root.depthTraverse(tile => {
      box3.setFromObject(tile);
      //position.copy(tile.position).applyMatrix4(tile.matrixWorld);
      //const distance = position.distanceTo(playerPos);

      const distance = box3.distanceToPoint(playerPos);

      if (distance <= 0.125) {
        tile.subdivide(this.maxDepth);
      } else {
        tile.unify();
      }
    });
  }
}

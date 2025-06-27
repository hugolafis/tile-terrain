import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { QuadTree } from './QuadTree';

export class Viewer {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private readonly scene: THREE.Scene;

  private readonly canvasSize: THREE.Vector2;
  private readonly renderSize: THREE.Vector2;

  private quadTree?: QuadTree;

  private helper: THREE.Mesh;

  private elapsed = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly canvas: HTMLCanvasElement) {
    this.canvasSize = new THREE.Vector2();
    this.renderSize = new THREE.Vector2();

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75, this.canvas.clientWidth / this.canvas.clientHeight);
    this.camera.position.set(1, 1, 1).multiplyScalar(25);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, 0, 0);

    const sun = new THREE.DirectionalLight(undefined, Math.PI); // undo physically correct changes
    sun.position.copy(new THREE.Vector3(0.75, 1, 0.5).normalize());
    const ambient = new THREE.AmbientLight(undefined, 0.25);
    this.scene.add(sun);
    this.scene.add(ambient);

    this.helper = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial({ wireframe: true }));
    this.helper.scale.setScalar(2);
    this.scene.add(this.helper);

    //this.quadTree = new QuadTree(this.scene);

    this.initQuadTree();

    //this.loadTerrainData();
  }

  private async initQuadTree() {
    const response = await fetch('./assets/terrain_height.data');
    const arrayBuffer = await response.arrayBuffer();
    const pixelArray = new Uint8Array(arrayBuffer);

    // todo don't hardcode
    const imageResolution = 4096;

    this.quadTree = new QuadTree(this.scene, pixelArray, imageResolution);
  }

  readonly update = (dt: number) => {
    this.controls.update();

    this.elapsed += dt;

    // Do we need to resize the renderer?
    this.canvasSize.set(
      Math.floor(this.canvas.parentElement!.clientWidth),
      Math.floor(this.canvas.parentElement!.clientHeight)
    );
    if (!this.renderSize.equals(this.canvasSize)) {
      this.renderSize.copy(this.canvasSize);
      this.renderer.setSize(this.renderSize.x, this.renderSize.y, false);

      this.camera.aspect = this.renderSize.x / this.renderSize.y;
      this.camera.updateProjectionMatrix();
    }

    const x = Math.sin(this.elapsed * 0.2) * 64;
    const z = Math.cos(this.elapsed * 0.2) * 64;

    this.helper.position.x = x;
    this.helper.position.z = z;

    if (this.quadTree) {
      this.quadTree.update(this.helper.position);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private async loadTerrainData() {
    const response = await fetch('./assets/terrain_height.data');
    const arrayBuffer = await response.arrayBuffer();
    const pixelArray = new Uint8Array(arrayBuffer);

    const terrainHeight = 50;
    const imageResolution = 4096;
    const divisor = 4;
    const vertexCount = imageResolution / divisor;
    const divisions = Math.max(1, vertexCount - 1);
    const geometry = new THREE.PlaneGeometry(512, 512, divisions, divisions).rotateX(-Math.PI / 2);
    //.translate(terrainSize * 0.5, 0, terrainSize * 0.5);
    const material = new THREE.MeshStandardMaterial();

    const positionAttrib = geometry.getAttribute('position');
    const index = geometry.index!;

    const vertex = new THREE.Vector3();
    for (let y = 0; y < vertexCount; y++) {
      for (let x = 0; x < vertexCount; x++) {
        const posIndice = (y * vertexCount + x) * 3;
        vertex.fromArray(positionAttrib.array, posIndice);

        //const imageIndice = Math.max(0, (y * vertexCount + x) * divisor - 1);
        const rowOffset = y * divisor * vertexCount * divisor;
        const columnOffset = Math.max(0, x * divisor - 1);

        const imageX = x * divisor;
        const imageY = y * divisor;
        const imageIndex = imageY * imageResolution + imageX;

        vertex.y = (pixelArray[rowOffset + columnOffset] / 255) * terrainHeight;
        //vertex.y = vertex.x;
        vertex.toArray(positionAttrib.array, posIndice);
      }
    }

    geometry.computeVertexNormals(); // todo remove

    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
  }
}

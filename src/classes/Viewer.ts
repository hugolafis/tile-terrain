import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export class Viewer {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private readonly scene: THREE.Scene;

  private readonly canvasSize: THREE.Vector2;
  private readonly renderSize: THREE.Vector2;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly canvas: HTMLCanvasElement) {
    this.canvasSize = new THREE.Vector2();
    this.renderSize = new THREE.Vector2();

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75, this.canvas.clientWidth / this.canvas.clientHeight);
    this.camera.position.set(1, 1, 1);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.set(0, 0, 0);

    const sun = new THREE.DirectionalLight(undefined, Math.PI); // undo physically correct changes
    sun.position.copy(new THREE.Vector3(0.75, 1, 0.5).normalize());
    const ambient = new THREE.AmbientLight(undefined, 0.25);
    this.scene.add(sun);
    this.scene.add(ambient);

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial());
    this.scene.add(mesh);

    this.loadTerrainData();
  }

  readonly update = (dt: number) => {
    this.controls.update();

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

    this.renderer.render(this.scene, this.camera);
  };

  private async loadTerrainData() {
    const response = await fetch('./assets/terrain_height_512.data');
    const arrayBuffer = await response.arrayBuffer();
    const pixelArray = new Uint8Array(arrayBuffer);

    const terrainHeight = 50;
    const terrainSize = 512;
    //const divisor = 4;
    const vertexCount = terrainSize; // / divisor;
    const divisions = Math.max(1, vertexCount - 1);
    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, divisions, divisions)
      .rotateX(-Math.PI / 2)
      .translate(terrainSize * 0.5, 0, terrainSize * 0.5);
    const material = new THREE.MeshStandardMaterial();

    const positionAttrib = geometry.getAttribute('position');
    const index = geometry.index!;

    const vertex = new THREE.Vector3();
    for (let y = 0; y < vertexCount; y++) {
      for (let x = 0; x < vertexCount; x++) {
        const posIndice = (y * vertexCount + x) * 3;
        vertex.fromArray(positionAttrib.array, posIndice);

        const imageIndice = y * vertexCount + x;
        vertex.y = (pixelArray[imageIndice] / 255) * terrainHeight;
        vertex.toArray(positionAttrib.array, posIndice);
      }
    }

    geometry.computeVertexNormals(); // todo remove

    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
  }
}

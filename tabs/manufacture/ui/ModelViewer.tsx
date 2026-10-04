/** In-browser 3D preview (spec §13.13). three.js is loaded only when someone opens a preview. */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { Spinner } from '@teamhub/ui';

export default function ModelViewer({ data, name }: { data: ArrayBuffer; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const el = host.current!;
    const width = el.clientWidth;
    const height = 380;
    const dark = document.documentElement.classList.contains('dark');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(dark ? 0x1c1c1f : 0xf6f6f7);
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(width, height);
    el.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(1, 2, 3);
    scene.add(dir);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    const material = new THREE.MeshStandardMaterial({ color: 0x4f7cff, metalness: 0.1, roughness: 0.6 });

    let obj: THREE.Object3D;
    try {
      const lower = name.toLowerCase().replace(/\.gz$/, '');
      if (lower.endsWith('.stl')) obj = new THREE.Mesh(new STLLoader().parse(data), material);
      else if (lower.endsWith('.obj')) {
        obj = new OBJLoader().parse(new TextDecoder().decode(data));
        obj.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).material = material;
        });
      } else if (lower.endsWith('.3mf')) obj = new ThreeMFLoader().parse(data);
      else throw new Error('Preview supports STL, OBJ and 3MF files.');
      scene.add(obj);
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3()).length() || 1;
      const center = box.getCenter(new THREE.Vector3());
      obj.position.sub(center);
      camera.position.set(size * 0.8, size * 0.6, size * 0.9);
      camera.near = size / 100;
      camera.far = size * 100;
      camera.updateProjectionMatrix();
      controls.update();
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, [data, name]);

  return (
    <div className="relative overflow-hidden rounded-md border border-border">
      <div ref={host} className="w-full" style={{ height: 380 }} />
      {loading && (
        <div className="absolute inset-0 grid place-items-center">
          <Spinner />
        </div>
      )}
      {error && <p className="absolute inset-x-0 bottom-0 bg-danger-soft p-2 text-[12.5px] text-danger">{error}</p>}
      <p className="absolute left-2 top-2 rounded bg-surface/80 px-1.5 text-[11px] text-muted">Drag to rotate · scroll to zoom</p>
    </div>
  );
}

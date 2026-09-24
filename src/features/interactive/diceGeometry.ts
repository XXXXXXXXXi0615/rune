import * as THREE from 'three';
import type { DiceFaceOrientation, DiceKind } from './types';

export const EXACT_ORIENTATION_KINDS = new Set<DiceKind>(['d4', 'd6', 'd8', 'd12', 'd20']);

function bipyramidGeometry(equatorPoints: number, radius = 1.12, height = 1.2): THREE.BufferGeometry {
  const vertices: number[] = [0, height, 0, 0, -height, 0];
  for (let index = 0; index < equatorPoints; index += 1) {
    const angle = (index / equatorPoints) * Math.PI * 2;
    vertices.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  }
  const indices: number[] = [];
  for (let index = 0; index < equatorPoints; index += 1) {
    const current = 2 + index; const next = 2 + ((index + 1) % equatorPoints);
    indices.push(0, current, next, 1, next, current);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

export function geometryForDice(kind: DiceKind, faces: number): THREE.BufferGeometry {
  if (kind === 'd4') return new THREE.TetrahedronGeometry(1.25);
  if (kind === 'd6') return new THREE.BoxGeometry(1.65, 1.65, 1.65);
  if (kind === 'd8') return new THREE.OctahedronGeometry(1.25);
  if (kind === 'd12') return new THREE.DodecahedronGeometry(1.2);
  if (kind === 'd20') return new THREE.IcosahedronGeometry(1.25);
  if (kind === 'd24') return bipyramidGeometry(12, 1.18, 1.08);
  if (kind === 'd10' || kind === 'd-percent') return bipyramidGeometry(5, 1.18, 1.32);
  if (faces <= 4) return new THREE.TetrahedronGeometry(1.25);
  if (faces <= 6) return new THREE.BoxGeometry(1.65, 1.65, 1.65);
  if (faces <= 8) return new THREE.OctahedronGeometry(1.25);
  if (faces <= 12) return new THREE.DodecahedronGeometry(1.2);
  return new THREE.IcosahedronGeometry(1.25, faces > 30 ? 1 : 0);
}

export function faceNormalsForGeometry(geometry: THREE.BufferGeometry): THREE.Vector3[] {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.getAttribute('position');
  const normals: THREE.Vector3[] = [];
  for (let index = 0; index < position.count; index += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, index);
    const b = new THREE.Vector3().fromBufferAttribute(position, index + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, index + 2);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (!normals.some(existing => existing.dot(normal) > .995)) normals.push(normal);
  }
  if (source !== geometry) source.dispose();
  return normals;
}

export function orientationMapForDice(kind: DiceKind, faces: number): DiceFaceOrientation[] {
  if (!EXACT_ORIENTATION_KINDS.has(kind)) return [];
  const geometry = geometryForDice(kind, faces);
  const normals = faceNormalsForGeometry(geometry).slice(0, faces);
  geometry.dispose();
  const up = new THREE.Vector3(0, 1, 0);
  return normals.map((normal, index) => {
    const quaternion = new THREE.Quaternion().setFromUnitVectors(normal, up).normalize();
    return { result: index + 1, quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] };
  });
}

export function isVisualApproximation(kind: DiceKind) {
  return !EXACT_ORIENTATION_KINDS.has(kind);
}

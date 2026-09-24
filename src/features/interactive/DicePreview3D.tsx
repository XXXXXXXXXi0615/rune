import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { DiceKind, DiceRollPhase, DiceTint } from './types';
import { faceNormalsForGeometry, geometryForDice, isVisualApproximation, orientationMapForDice } from './diceGeometry';

const TINTS: Record<DiceTint, { color: number; edge: number; text: string }> = {
  amber: { color: 0xc99a55, edge: 0xffe1a6, text: '#2e2117' }, tide: { color: 0x438f91, edge: 0xb9eeea, text: '#f5fffc' },
  ivory: { color: 0xe8e2d5, edge: 0xffffff, text: '#26343a' }, midnight: { color: 0x172832, edge: 0x6fa6ad, text: '#f4eee2' },
  violet: { color: 0x927aa8, edge: 0xe1d0ef, text: '#fffaf2' }, coral: { color: 0xbc7165, edge: 0xffc2b4, text: '#fffaf2' },
};

function faceLabel(result: number, kind: DiceKind) {
  return kind === 'd-percent' ? String((result - 1) * 10).padStart(2, '0') : String(result);
}

function labelTexture(label: string, color: string) {
  const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) { context.clearRect(0,0,128,128); context.fillStyle=color; context.textAlign='center'; context.textBaseline='middle'; context.font=`700 ${label.length > 1 ? 48 : 58}px ui-sans-serif, system-ui`; context.fillText(label,64,68); }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true; return texture;
}

function surfaceDistance(geometry: THREE.BufferGeometry, normal: THREE.Vector3) {
  const position = geometry.getAttribute('position'); let max = 0;
  for (let index=0; index<position.count; index+=1) max=Math.max(max, new THREE.Vector3().fromBufferAttribute(position,index).dot(normal));
  return max + .025;
}

function faceQuaternion(normal: THREE.Vector3) {
  const localUp=new THREE.Vector3(0,1,0).projectOnPlane(normal).normalize();
  if(localUp.lengthSq()<.01)localUp.set(1,0,0).projectOnPlane(normal).normalize();
  const right=localUp.clone().cross(normal).normalize();
  const correctedUp=normal.clone().cross(right).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,correctedUp,normal));
}

interface Props { kind: DiceKind; faces: number; tint: DiceTint; quantity?: number; results?: number[]; rollKey?: number; continuous?: boolean; onPhaseChange?: (phase: DiceRollPhase) => void; }

export function DicePreview3D({ kind, faces, tint, quantity=1, results=[], rollKey=0, continuous=true, onPhaseChange }: Props) {
  const hostRef=useRef<HTMLDivElement>(null); const [phase,setPhase]=useState<DiceRollPhase>('idle');
  const shown=Math.min(quantity,5); const primaryResult=results[0];

  useEffect(()=>{
    const host=hostRef.current; if(!host)return;
    const scene=new THREE.Scene(); const camera=new THREE.PerspectiveCamera(34,1,.1,100);
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setClearColor(0,0); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.domElement.setAttribute('aria-hidden','true'); host.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xfff2d8,0x173b43,2.2)); const key=new THREE.DirectionalLight(0xffd6a0,3.6);key.position.set(-3,4,4);key.castShadow=true;scene.add(key);const rim=new THREE.PointLight(0x72d2cf,2.8,10);rim.position.set(3,1,2);scene.add(rim);
    const geometry=geometryForDice(kind,faces);geometry.computeVertexNormals();const palette=TINTS[tint];
    const material=new THREE.MeshPhysicalMaterial({color:palette.color,roughness:.32,metalness:.18,clearcoat:.55,clearcoatRoughness:.28});const edgeGeometry=new THREE.EdgesGeometry(geometry,20);const edgeMaterial=new THREE.LineBasicMaterial({color:palette.edge,transparent:true,opacity:.45});
    const normals=faceNormalsForGeometry(geometry).slice(0,faces);const textures:THREE.Texture[]=[];const labelMaterials:THREE.MeshBasicMaterial[]=[];const labelGeometries:THREE.PlaneGeometry[]=[];
    const groups:THREE.Group[]=[]; const baseScales:number[]=[]; const spacing=shown<=1?0:Math.min(1.75,7/(shown-1));
    for(let diceIndex=0;diceIndex<shown;diceIndex+=1){const group=new THREE.Group();const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);group.add(new THREE.LineSegments(edgeGeometry,edgeMaterial));
      normals.forEach((normal,index)=>{const texture=labelTexture(faceLabel(index+1,kind),palette.text);textures.push(texture);const labelMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4,side:THREE.FrontSide});labelMaterials.push(labelMaterial);const labelSize=kind==='d20'||kind==='d24'?.28:kind==='d12'?.32:.36;const planeGeometry=new THREE.PlaneGeometry(labelSize,labelSize);labelGeometries.push(planeGeometry);const label=new THREE.Mesh(planeGeometry,labelMaterial);label.position.copy(normal).multiplyScalar(surfaceDistance(geometry,normal));label.quaternion.copy(faceQuaternion(normal));label.renderOrder=3;mesh.add(label);});
      group.position.x=(diceIndex-(shown-1)/2)*spacing;const scale=shown>3?.68:shown>1?.82:1.12;baseScales.push(scale);group.scale.setScalar(scale);group.rotation.set(.42+diceIndex*.13,.58+diceIndex*.18,.1);groups.push(group);scene.add(group);}
    const floorGeometry=new THREE.CircleGeometry(shown>1?4.6:2.1,64);const floorMaterial=new THREE.ShadowMaterial({color:0x13272c,opacity:.24});const floor=new THREE.Mesh(floorGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=-1.58;floor.receiveShadow=true;scene.add(floor);
    const orientationMap=orientationMapForDice(kind,faces);const targets=groups.map((_,index)=>{const result=results[index];const entry=orientationMap.find(item=>item.result===result);return entry?new THREE.Quaternion(...entry.quaternion):new THREE.Quaternion().setFromEuler(new THREE.Euler(.35+index*.2,.55+index*.17,.08));});
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;let visible=true;const visibility=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true});visibility.observe(host);
    let fitRevision=0;
    const fitCamera=()=>{const box=new THREE.Box3();groups.forEach(group=>box.expandByObject(group));const sphere=new THREE.Sphere();box.getBoundingSphere(sphere);const vertical=THREE.MathUtils.degToRad(camera.fov);const horizontal=2*Math.atan(Math.tan(vertical/2)*camera.aspect);const limitingHalfFov=Math.min(vertical,horizontal)/2;const distance=(sphere.radius/Math.sin(Math.max(.08,limitingHalfFov)))*1.16;camera.position.set(sphere.center.x,sphere.center.y+.08,distance+sphere.center.z);camera.near=Math.max(.01,distance-sphere.radius*2.5);camera.far=distance+sphere.radius*4;camera.lookAt(sphere.center.x,sphere.center.y+.08,sphere.center.z);camera.updateProjectionMatrix();const corners=[new THREE.Vector3(box.min.x,box.min.y,box.min.z),new THREE.Vector3(box.min.x,box.min.y,box.max.z),new THREE.Vector3(box.min.x,box.max.y,box.min.z),new THREE.Vector3(box.min.x,box.max.y,box.max.z),new THREE.Vector3(box.max.x,box.min.y,box.min.z),new THREE.Vector3(box.max.x,box.min.y,box.max.z),new THREE.Vector3(box.max.x,box.max.y,box.min.z),new THREE.Vector3(box.max.x,box.max.y,box.max.z)].map(point=>point.project(camera));host.dataset.projectedMaxX=Math.max(...corners.map(point=>Math.abs(point.x))).toFixed(3);host.dataset.projectedMaxY=Math.max(...corners.map(point=>Math.abs(point.y))).toFixed(3);host.dataset.cameraDistance=distance.toFixed(3);host.dataset.framingMargin='0.16';host.dataset.fitRevision=String(++fitRevision);};
    const resize=()=>{const width=Math.max(1,host.clientWidth),height=Math.max(1,host.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();fitCamera()};const observer=new ResizeObserver(resize);observer.observe(host);resize();
    const started=performance.now();const duration=reduce?160:1160;let frame=0;let settled=false;let currentPhase:DiceRollPhase='idle';
    const publish=(next:DiceRollPhase)=>{if(currentPhase===next)return;currentPhase=next;setPhase(next);onPhaseChange?.(next)};
    if(results.length)publish(reduce?'landing':'launching');else publish('idle');
    const animate=(now:number)=>{const elapsed=now-started;const progress=Math.min(1,elapsed/duration);
      if(results.length&&!settled){let next:DiceRollPhase=progress<.16?'launching':progress<.7?'rolling':progress<1?'landing':'settled';if(reduce&&progress<1)next='landing';publish(next);
        groups.forEach((group,index)=>{if(reduce){group.quaternion.slerpQuaternions(group.quaternion,targets[index],progress);group.position.y=0;}else if(progress<.72){group.rotation.x+=.12+index*.008;group.rotation.y+=.16;group.rotation.z+=.09;group.position.y=Math.sin(progress/.72*Math.PI)*1.05;}else{const landing=(progress-.72)/.28;group.quaternion.slerp(targets[index],Math.min(1,landing*.18));group.position.y=Math.abs(Math.sin(landing*Math.PI*2))*Math.max(0,(1-landing))*.22;const squash=1-Math.sin(Math.min(1,landing)*Math.PI)*.07;group.scale.y=baseScales[index]*squash;}});
        if(progress>=1){groups.forEach((group,index)=>{group.quaternion.copy(targets[index]);group.position.y=0;});settled=true;publish('settled');host.dataset.upFace=String(primaryResult??'');}}
      else if(!results.length&&continuous&&!reduce)groups.forEach((group,index)=>{group.rotation.y+=.003+index*.0002;group.rotation.x+=.0008;});
      if(visible)renderer.render(scene,camera);if(!settled||continuous)frame=requestAnimationFrame(animate);
    };frame=requestAnimationFrame(animate);
    return()=>{cancelAnimationFrame(frame);observer.disconnect();visibility.disconnect();geometry.dispose();edgeGeometry.dispose();floorGeometry.dispose();material.dispose();edgeMaterial.dispose();floorMaterial.dispose();textures.forEach(item=>item.dispose());labelMaterials.forEach(item=>item.dispose());labelGeometries.forEach(item=>item.dispose());renderer.dispose();renderer.domElement.remove()};
  },[kind,faces,tint,shown,results.join(','),rollKey,continuous,primaryResult]);

  const labelCount=kind==='d-percent'?10:faces;
  const labels=Array.from({length:labelCount},(_,index)=>faceLabel(index+1,kind)).join(',');
  return <div ref={hostRef} className="dice-preview-3d" data-dice-kind={kind} data-dice-faces={faces} data-dice-tint={tint} data-dice-phase={phase} data-canvas-count="1" data-face-labels={labels} data-reduced-motion={typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches} data-visual-approximation={isVisualApproximation(kind)} aria-label={`${faces} 面骰 3D 預覽`} role="img">{quantity>5&&<span className="dice-preview-overflow">前 5 顆 · +{quantity-5}</span>}</div>;
}

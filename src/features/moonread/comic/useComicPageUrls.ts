import { useEffect,useState } from 'react';
import { getAsset } from '@/store/assets';
import type { ComicPage } from '../types';
export function useComicPageUrls(pages:ComicPage[],current:number,radius=2){const [urls,setUrls]=useState<Record<number,string>>({});useEffect(()=>{let disposed=false;const created:string[]=[];const wanted=pages.filter(page=>Math.abs(page.index-current)<=radius);void Promise.all(wanted.map(async page=>{const blob=await getAsset(page.assetId);if(!blob||disposed)return;const url=URL.createObjectURL(blob);created.push(url);setUrls(prev=>({...prev,[page.index]:url}));}));return()=>{disposed=true;created.forEach(url=>URL.revokeObjectURL(url));setUrls({});};},[pages,current,radius]);return urls;}

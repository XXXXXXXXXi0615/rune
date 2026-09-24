import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { addCalendarDayElement, buildCalendarDayScene, deterministicNotePlacement, getCalendarDayRevision, getSnapshotStatus, markCalendarDayDirty, updateCalendarDayElement, updateCalendarNotePresentation } from './calendarDayScene';

beforeEach(()=>useAppStore.setState({customEvents:[],calendarNotes:[],calendarDayElements:[],calendarDayRevisions:[],calendarDaySnapshots:[]}));

describe('CalendarDayScene',()=>{
  it('derives canonical event and note references without duplicating editable content',()=>{
    const event={id:'e1',type:'event' as const,date:'2026-08-09',title:'Canonical',completed:false,description:'',isAllDay:false,startTime:'10:00',author:'user' as const};
    const note={id:'n1',dateKey:'2026-08-09',author:'lunaris' as const,content:'Canonical note',createdAt:'x',updatedAt:'x'};
    useAppStore.setState({customEvents:[event],calendarNotes:[note]});
    const scene=buildCalendarDayScene('2026-08-09');expect(scene.events[0].event).toBe(event);expect(scene.notes[0].note).toBe(note);
  });
  it('auto placement is deterministic and below the date header',()=>{const note={id:'n1',dateKey:'2026-08-09',author:'lunaris' as const,content:'x',createdAt:'x',updatedAt:'x'};expect(deterministicNotePlacement(note,0)).toEqual(deterministicNotePlacement(note,0));expect(deterministicNotePlacement(note,0).y).toBeGreaterThan(170)});
  it('increments day revision exactly once per committed transform',()=>{const item=addCalendarDayElement({dateKey:'2026-08-09',type:'sticker',stickerId:'star',x:1,y:2,width:100,height:100,rotation:0,zIndex:10,createdBy:'user'});expect(getCalendarDayRevision(item.dateKey)).toBe(1);expect(updateCalendarDayElement(item.id,{x:50})).toBe(true);expect(getCalendarDayRevision(item.dateKey)).toBe(2)});
  it('commits note presentation separately from note content',()=>{useAppStore.setState({calendarNotes:[{id:'n',dateKey:'2026-08-09',author:'user',content:'keep',createdAt:'x',updatedAt:'x'}]});expect(updateCalendarNotePresentation('n',{x:20,y:30,width:220,rotation:2,zIndex:100})).toBe(true);expect(useAppStore.getState().calendarNotes![0]).toMatchObject({content:'keep',x:20,y:30});expect(getCalendarDayRevision('2026-08-09')).toBe(1)});
  it('reports missing, stale and fresh snapshot state',()=>{expect(getSnapshotStatus('2026-08-09').status).toBe('missing');markCalendarDayDirty('2026-08-09');useAppStore.setState({calendarDaySnapshots:[{dateKey:'2026-08-09',assetId:'a',contentRevision:0,renderedRevision:0,renderedAt:1,width:1000,height:1400,mimeType:'image/png'}]});expect(getSnapshotStatus('2026-08-09').status).toBe('stale');useAppStore.setState({calendarDaySnapshots:[{dateKey:'2026-08-09',assetId:'b',contentRevision:1,renderedRevision:1,renderedAt:2,width:1000,height:1400,mimeType:'image/png'}]});expect(getSnapshotStatus('2026-08-09').status).toBe('fresh')});
});

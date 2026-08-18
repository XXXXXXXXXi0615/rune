import { expect, test, type Page } from '@playwright/test';
import { collectErrors, expectClean, prepareInteractiveApp, unlockWithDefaults } from './helpers/unlock';

const ids = ['home-checkin','home-today-task','home-period','home-activity-heatmap','home-anniversary','home-lunaris','home-hydration'];

async function seedVisualHome(page: Page) {
  await unlockWithDefaults(page);
  await page.addInitScript(() => {
    const placements = [
      ['home-today-task','wide',0,0,4,2], ['home-checkin','wide',4,0,4,2], ['home-period','small',8,0,2,2],
      ['home-activity-heatmap','full',0,2,12,2], ['home-anniversary','small',10,0,2,2],
      ['home-lunaris','medium',0,4,6,2], ['home-hydration','wide',6,4,4,2],
    ].map(([widgetId,size,x,y,w,h],order)=>({widgetId,size,x,y,w,h,order,hidden:false}));
    localStorage.setItem('lunartide-home-widget-layout-v1', JSON.stringify({ version:5, state:{ desktop:placements, tablet:placements, mobile:placements, version:5, schemaVersion:5, layoutMode:'auto', userEdited:true, updatedAt:new Date().toISOString() } }));
    const app = JSON.parse(localStorage.getItem('lunartide_data') || '{"state":{},"version":0}'); app.state = app.state || {}; app.state.theme = 'light'; localStorage.setItem('lunartide_data', JSON.stringify(app));
    const now = new Date(); const dateKey = now.toLocaleDateString('sv-SE'); const iso = now.toISOString();
    app.state.activityLogs = Array.from({length:28},(_,index)=>({id:`story-activity-${index}`,type:'home',description:'storybook fixture',createdAt:now.getTime()-index*4*86400000}));
    localStorage.setItem('lunartide_data', JSON.stringify(app));
    localStorage.setItem('lunartide-check-in', JSON.stringify({state:{records:[{id:'story-checkin',date:dateKey,kind:'clock_in',status:'completed',clockInAt:iso,clockOutAt:null,isLate:false,graceMinutesUsed:0,report:null,makeupReason:null,moonDewAwarded:0,ticketNumber:'STORY-001',createdAt:iso,updatedAt:iso}],corrections:[],settlements:[],policy:{mode:'simple',clockInDeadline:'10:00',clockOutDeadline:'23:59',graceMinutes:30,makeupHours:48,consequenceLevel:'standard',requireReport:false},milestoneRewards:[],dismissedTodayDate:dateKey},version:1}));
    const target = new Date(now.getFullYear(),now.getMonth(),now.getDate()+79).toLocaleDateString('sv-SE');
    localStorage.setItem('lunartide_countdown_v1',JSON.stringify({state:{events:[{id:'story-dream',title:'夢開始的地方',targetAt:target,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,direction:'until',recurrence:{type:'none'},includeTargetDay:false,showTime:false,pinnedToHome:true,createdAt:now.getTime(),updatedAt:now.getTime()}],schemaVersion:1,widgetConfig:{size:'medium',secondaryCount:1,showBackgroundImage:false,hideElapsed:false},_hydrated:true},version:1}));
    localStorage.setItem('lunartide_update_seen_version_v1','2026.08.09');
    window.addEventListener('unhandledrejection',(event)=>{(window as unknown as {__homeUnhandled?:string[]}).__homeUnhandled??=[];(window as unknown as {__homeUnhandled:string[]}).__homeUnhandled.push(String(event.reason));});
  });
}

test('storybook reskin preserves canonical widgets geometry and responsive shell', async ({ page }) => {
  const errors = collectErrors(page);
  await seedVisualHome(page);
  await page.setViewportSize({ width:1440, height:1100 });
  await page.goto('/'); await prepareInteractiveApp(page);
  await expect(page.locator('.home-view--apple-health')).toBeVisible();
  for (const id of ids) await expect(page.locator(`[data-widget-id="${id}"]`)).toBeVisible();
  await expect(page.locator('.home-activity-widget__summary')).toHaveAttribute('data-pet-safe-region', 'true');
  await expect(page.locator('.home-activity-widget')).toHaveAttribute('data-pet-safe-region', 'true');
  await expect(page.locator('.home-workspace')).not.toHaveAttribute('data-pet-safe-region', /.+/);
  await expect(page.locator('[data-pet-safe-region="interactive"]')).not.toHaveCount(0);
  const before = await page.locator('.hwg-grid').evaluate((grid) => ({ columns:getComputedStyle(grid).gridTemplateColumns, cells:[...grid.querySelectorAll<HTMLElement>('[data-widget-id]')].map((cell)=>({id:cell.dataset.widgetId,row:cell.style.gridRow,column:cell.style.gridColumn})) }));
  await page.reload(); await prepareInteractiveApp(page);
  const after = await page.locator('.hwg-grid').evaluate((grid) => ({ columns:getComputedStyle(grid).gridTemplateColumns, cells:[...grid.querySelectorAll<HTMLElement>('[data-widget-id]')].map((cell)=>({id:cell.dataset.widgetId,row:cell.style.gridRow,column:cell.style.gridColumn})) }));
  expect(after).toEqual(before);
  await page.screenshot({ path:'e2e/screenshots/home-light-desktop-storybook-v1.png', fullPage:true });
  await page.screenshot({ path:'e2e/screenshots/home-light-desktop-fixed-clock.png', fullPage:true });
  await page.locator('.home-workspace').screenshot({path:'e2e/screenshots/home-light-desktop-cards-closeup.png'});
  await page.locator('[data-widget-id="home-activity-heatmap"]').screenshot({path:'e2e/screenshots/home-storybook-v12-activity.png'});
  await page.locator('[data-widget-id="home-anniversary"]').screenshot({path:'e2e/screenshots/home-storybook-v12-dream.png'});
  await page.locator('[data-widget-id="home-checkin"]').screenshot({path:'e2e/screenshots/home-storybook-v12-check-in.png'});

  await page.setViewportSize({ width:390, height:844 }); await page.reload(); await prepareInteractiveApp(page);
  await expect(page.locator('.desktop-sidebar')).toHaveCount(0);
  await expect(page.locator('.mobile-header')).toBeVisible();
  await expect(page.locator('.mobile-tab-bar')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path:'e2e/screenshots/home-storybook-v12a-mobile-390.png', fullPage:true });
  expect(await page.evaluate(()=>(window as unknown as {__homeUnhandled?:string[]}).__homeUnhandled||[])).toEqual([]);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('storybook decoration remains outside edit drag resize and auto free contracts', async ({ page }) => {
  const errors = collectErrors(page); await seedVisualHome(page);
  await page.setViewportSize({ width:1440, height:1000 }); await page.goto('/'); await prepareInteractiveApp(page);
  await expect(page.locator('.home-storybook-decor')).toHaveCount(0);
  await page.getByRole('button',{name:'編輯首頁'}).click();
  await expect(page.locator('[data-home-edit-mode]')).toBeVisible();
  const target = page.locator('[data-widget-id="home-checkin"]'); await target.click();
  await expect(target.locator('.hwg-drag-handle')).toBeVisible();
  await expect(target.locator('.hwg-size-sel')).toBeVisible();
  const freeToggle = page.getByRole('button',{name:'切換到自由模式'}); await expect(freeToggle).toBeVisible(); await freeToggle.click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('lunartide-home-widget-layout-v1')||'{}').state.layoutMode)).toBe('free');
  const handle = target.locator('.hwg-drag-handle'); const box = await handle.boundingBox(); expect(box).not.toBeNull();
  const before = await target.getAttribute('style');
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2); await page.mouse.down(); await page.mouse.move(box!.x+150,box!.y+105,{steps:8}); await page.mouse.up();
  await expect.poll(async()=>target.getAttribute('style')).not.toBe(before);
  await page.getByRole('button',{name:'完成',exact:true}).click();
  expectClean(errors.pageErrors, errors.consoleErrors);
});

test('hero controls and decoration keep distinct accessible responsibilities', async ({ page }) => {
  const errors = collectErrors(page); await seedVisualHome(page);
  await page.setViewportSize({ width:1440, height:1000 }); await page.goto('/'); await prepareInteractiveApp(page);

  await expect(page.locator('.home-storybook-decor')).toHaveCount(0);

  await expect(page.getByRole('button', { name:'拖曳首頁時鐘' })).toHaveCount(0);
  await expect(page.getByRole('button', { name:'調整首頁時鐘大小' })).toHaveCount(0);
  await expect(page.getByTestId('moon-glass-clock')).toHaveAttribute('data-home-clock-fixed', 'true');
  await expect(page.getByRole('button', { name:'編輯首頁' })).toHaveCount(1);
  const tidebound = page.getByTestId('tidebound-orb');
  await expect(tidebound).toHaveAttribute('aria-label', /TIDEBOUND/);
  await expect(tidebound.locator('.tidebound-orb__mark')).toHaveCSS('display', 'none');
  await tidebound.click(); await expect(page.getByTestId('tidebound-quick-panel')).toBeVisible(); await tidebound.click();
  const decorativeContents = await page.locator('.home-view--apple-health').evaluate((home) => ({
    home: getComputedStyle(home, '::after').content,
    clock: getComputedStyle(home.querySelector('.home-fixed-clock-section')!, '::after').content,
    hero: getComputedStyle(home.querySelector('.home-fixed-zone')!, '::after').content,
  }));
  expect(`${decorativeContents.home}${decorativeContents.clock}${decorativeContents.hero}`).not.toContain('☾');

  await page.setViewportSize({ width:390, height:844 }); await page.reload(); await prepareInteractiveApp(page);
  const hero = await page.locator('.home-fixed-zone').boundingBox();
  const clock = await page.locator('[data-testid="moon-glass-clock"]').boundingBox();
  const header = await page.locator('.mobile-header').boundingBox();
  const welcome = await page.locator('.home-presence-pill').boundingBox();
  const edit = await page.getByRole('button', { name:'編輯首頁' }).boundingBox();
  const dock = await page.locator('.mobile-tab-bar').boundingBox();
  expect(hero && header && hero.y >= header.y + header.height).toBe(true);
  expect(clock && welcome && welcome.y >= clock.y + clock.height - 4).toBe(true);
  expect(hero && welcome && welcome.y >= hero.y && welcome.y + welcome.height <= hero.y + hero.height + 16).toBe(true);
  expect(edit && edit.x >= 0 && edit.x + edit.width <= 390).toBe(true);
  expect(dock && dock.y + dock.height <= 845).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expectClean(errors.pageErrors, errors.consoleErrors);
});

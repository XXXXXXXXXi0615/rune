import { expect, test, type Page } from '@playwright/test';
import { collectErrors, expectClean, prepareInteractiveApp, unlockWithDefaults } from './helpers/unlock';

const shot = (name: string) => `e2e/screenshots/${name}.png`;

async function seedV2(page: Page) {
  await unlockWithDefaults(page);
  await page.addInitScript(() => {
    const now = new Date(); const dateKey = now.toLocaleDateString('sv-SE'); const iso = now.toISOString();
    const placements = [
      ['home-today-task','wide',0,0,4,2],['home-checkin','wide',4,0,4,2],['home-period','small',8,0,2,2],['home-anniversary','small',10,0,2,2],
      ['home-activity-heatmap','full',0,2,12,2],['home-lunaris','medium',0,4,6,2],['home-hydration','wide',6,4,4,2],
    ].map(([widgetId,size,x,y,w,h],order)=>({widgetId,size,x,y,w,h,order,hidden:false}));
    localStorage.setItem('lunartide-home-widget-layout-v1',JSON.stringify({version:5,state:{desktop:placements,tablet:placements,mobile:placements,version:5,schemaVersion:5,layoutMode:'auto',userEdited:true,updatedAt:iso}}));
    localStorage.setItem('lunartide-check-in',JSON.stringify({version:1,state:{records:[],corrections:[],settlements:[],milestoneRewards:[],dismissedTodayDate:dateKey}}));
    localStorage.setItem('lunartide-hydration-v1',JSON.stringify({version:2,state:{entries:[],settings:{dailyGoalMl:2000,quickAmounts:[100,250,500]}}}));
    const app=JSON.parse(localStorage.getItem('lunartide_data')||'{"state":{},"version":0}'); app.state=app.state||{}; app.state.theme='light'; app.state.providers=[]; app.state.activityLogs=Array.from({length:42},(_,i)=>({id:`v2-${i}`,type:'home',title:'V2 activity',createdAt:now.getTime()-i*2*86400000})); localStorage.setItem('lunartide_data',JSON.stringify(app));
    localStorage.setItem('lunartide_update_seen_version_v1','2026.08.09');
    (window as Window & {__v2Unhandled?:string[]}).__v2Unhandled=[]; addEventListener('unhandledrejection',(event)=>(window as Window & {__v2Unhandled?:string[]}).__v2Unhandled!.push(String(event.reason)));
  });
}

async function open(page: Page) { await page.setViewportSize({width:1440,height:900}); await seedV2(page); await page.goto('/'); await prepareInteractiveApp(page); }

test('V2 core cards preserve canonical interactions and shared hierarchy', async ({page})=>{
  const errors=collectErrors(page); await open(page);
  for(const id of ['home-today-task','home-checkin','home-period','home-hydration','home-activity-heatmap','home-lunaris']) await expect(page.locator(`[data-widget-id="${id}"]`)).toBeVisible();
  await expect(page.locator('[data-widget-id="home-activity-heatmap"] .home-activity-widget__cell[data-count]:not([data-count="0"])').first()).toBeVisible();
  await page.getByTestId('hyd-widget-quick-250').click(); await expect(page.getByTestId('hyd-widget-total')).toContainText('250');
  await page.locator('[data-widget-id="home-today-task"] button, [data-widget-id="home-today-task"]').first().click(); await expect(page).toHaveURL(/\/quests$/); await page.goto('/'); await prepareInteractiveApp(page);
  await page.locator('[data-widget-id="home-lunaris"] [role="button"], [data-widget-id="home-lunaris"] button').last().click(); await expect(page).toHaveURL(/\/settings/);
  expectClean(errors.pageErrors,errors.consoleErrors); expect(await page.evaluate(()=>(window as Window & {__v2Unhandled?:string[]}).__v2Unhandled)).toEqual([]);
});

test('V2 screenshots and decoration-off hierarchy remain geometry-stable',async({page})=>{
  const errors=collectErrors(page); await open(page);
  const home=page.locator('.home-view--apple-health');
  await expect.poll(async()=>page.evaluate(()=>{
    const pet=document.querySelector('.companion-pet')?.getBoundingClientRect();
    const regions=[...document.querySelectorAll<HTMLElement>('[data-pet-safe-region="interactive"]')].map((node)=>node.getBoundingClientRect());
    return !pet||regions.every((region)=>pet.right<=region.left||pet.left>=region.right||pet.bottom<=region.top||pet.top>=region.bottom);
  }),{timeout:5000}).toBe(true);
  const before=await page.locator('.hwg-grid').evaluate(el=>({columns:getComputedStyle(el).gridTemplateColumns,height:el.getBoundingClientRect().height}));
  await page.screenshot({path:shot('home-storybook-v2-desktop'),fullPage:true});
  await page.locator('.home-workspace').screenshot({path:shot('home-storybook-v2-core-cards')});
  await page.locator('[data-widget-id="home-activity-heatmap"]').screenshot({path:shot('home-storybook-v2-activity')});
  await page.locator('[data-widget-id="home-lunaris"]').evaluate((el)=>el.scrollIntoView({block:'center'}));
  await page.screenshot({path:shot('home-storybook-v2-hydration-ai'),fullPage:false});
  await page.evaluate(() => {
    scrollTo(0,0);
    document.documentElement.scrollTop=0; document.body.scrollTop=0;
    document.querySelectorAll<HTMLElement>('.main-content,.desktop-main,.app-main,.home-view').forEach((element)=>{element.scrollTop=0;});
  });
  await home.evaluate(el=>el.setAttribute('data-decoration','off'));
  await expect(home.locator('.home-storybook-decor')).toHaveCount(0);
  const after=await page.locator('.hwg-grid').evaluate(el=>({columns:getComputedStyle(el).gridTemplateColumns,height:el.getBoundingClientRect().height})); expect(after).toEqual(before);
  expectClean(errors.pageErrors,errors.consoleErrors);
});

test('390px V2 decoration does not overflow',async({page})=>{const errors=collectErrors(page);await page.setViewportSize({width:390,height:844});await seedV2(page);await page.goto('/');await prepareInteractiveApp(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);expectClean(errors.pageErrors,errors.consoleErrors);});

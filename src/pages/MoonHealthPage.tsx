import { Navigate, useLocation, Link } from 'react-router-dom';
import { HealthPeriodPage } from '@/pages/HealthPeriodPage';
import { BodyWorkspace } from '@/components/health/BodyWorkspace';
import { HealthOverviewPanel } from '@/components/health/HealthOverviewPanel';
import '@/styles/moon-health.css';

const tabs = [{ path: '/health', label: '總覽' }, { path: '/health/body', label: '身體' }, { path: '/health/period', label: '週期' }]

export function MoonHealthPage() {
  const { pathname } = useLocation()
  if (pathname === '/health/cycle') return <Navigate to="/health/period" replace />
  if (pathname === '/health/body') return <section className="moon-health-page">
    <header className="moon-health-hero"><div><span>MOONHEALTH</span><h1>月潮健康</h1><p>身體紀錄安排在同一個清楚的資料邊界裡。</p></div></header>
    <nav className="moon-health-tabs" aria-label="月潮健康分類">{tabs.map(t => <Link key={t.path} className={pathname === t.path ? 'active' : ''} to={t.path}>{t.label}</Link>)}</nav>
    <BodyWorkspace />
  </section>
  if (pathname === '/health/period') return <section className="moon-health-page">
    <header className="moon-health-hero"><div><span>MOONHEALTH</span><h1>月潮健康</h1><p>週期與身體，留下同一個清楚的資料邊界。</p></div></header>
    <nav className="moon-health-tabs" aria-label="月潮健康分類">{tabs.map(t => <Link key={t.path} className={pathname === t.path ? 'active' : ''} to={t.path}>{t.label}</Link>)}</nav>
    <HealthPeriodPage />
  </section>
  return <section className="moon-health-page">
    <header className="moon-health-hero"><div><span>MOONHEALTH</span><h1>月潮健康</h1><p>週期與身體，留在同一個清楚的資料邊界裡。</p></div></header>
    <nav className="moon-health-tabs" aria-label="月潮健康分類">{tabs.map(t => <Link key={t.path} className={pathname === t.path ? 'active' : ''} to={t.path}>{t.label}</Link>)}</nav>
    <HealthOverviewPanel />
  </section>
}

import { version } from '../../package.json';
import type { StoredSession } from '../../shared/protocol';
import { Brand } from './Brand';
import { Icon } from './Icon';
interface Props {
  sessions: StoredSession[]; currentId: string; zh: boolean;
  activePanel: 'workspace' | 'settings' | 'help' | 'health' | 'interview';
  onSwitch: (id: string) => void; onNew: () => void;
  onWorkspace: () => void; onReferences: () => void;
  onInterview: () => void;
  onSettings: () => void; onHelp: () => void; onHealth: () => void;
}
export function WorkspaceSidebar(props: Props) {
  const { zh } = props;
  return <aside className="workspace-sidebar">
    <Brand />
    <span className="sidebar-caption">{zh ? '会话工作空间' : 'MEETING WORKSPACE'}</span>
    <nav className="sidebar-nav" aria-label={zh ? '主导航' : 'Navigation'}>
      <button className={props.activePanel === 'workspace' ? 'nav-item is-active' : 'nav-item'} onClick={props.onWorkspace} title={zh ? '工作台' : 'Workspace'}><Icon name="workspace"/><span>{zh ? '工作台' : 'Workspace'}</span></button>
      <button className="nav-item" onClick={props.onReferences} title={zh ? '本场资料' : 'Session documents'}><Icon name="book"/><span>{zh ? '本场资料' : 'Documents'}</span></button>
      <button className={`nav-item${props.activePanel === 'interview' ? ' is-active' : ''}`} onClick={props.onInterview} title={zh ? '模拟面试' : 'Mock interview'}><Icon name="spark"/><span>{zh ? '模拟面试' : 'Mock interview'}</span></button>
    </nav>
    <div className="sidebar-section-head"><span>{zh ? '我的会话' : 'SESSIONS'}</span><button className="icon-button" onClick={props.onNew} title={zh ? '新建会话' : 'New session'} aria-label={zh ? '新建会话' : 'New session'}><Icon name="plus" size={16}/></button></div>
    <div className="sidebar-sessions">
      {props.sessions.map(session => <button key={session.id} className={`sidebar-session${session.id === props.currentId ? ' is-current' : ''}`} onClick={() => props.onSwitch(session.id)} title={session.name} aria-current={session.id === props.currentId ? 'page' : undefined}><Icon name="message" size={16}/><span>{session.name}</span></button>)}
    </div>
    <div className="sidebar-bottom">
      <button className={`nav-item${props.activePanel === 'health' ? ' is-active' : ''}`} onClick={props.onHealth} title={zh ? '服务状态' : 'Service status'}><Icon name="pulse"/><span>{zh ? '服务状态' : 'Services'}</span></button>
      <button className={`nav-item${props.activePanel === 'help' ? ' is-active' : ''}`} onClick={props.onHelp} title={zh ? '使用指南' : 'Help'}><Icon name="help"/><span>{zh ? '使用指南' : 'Help'}</span></button>
      <button className={`nav-item${props.activePanel === 'settings' ? ' is-active' : ''}`} onClick={props.onSettings} title={zh ? '设置' : 'Settings'}><Icon name="settings"/><span>{zh ? '设置' : 'Settings'}</span></button>
      <div className="sidebar-version"><span className="brand-dot"/>OfferMe <span>{version}</span></div>
    </div>
  </aside>;
}

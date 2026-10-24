import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { supabase } from './lib/supabase';

type Role = 'student' | 'lecturer';
type Module = { id: string; title: string; subtitle: string; description: string; duration_minutes: number; accent: string; order_index: number };
type Question = { id: string; module_id: string; prompt: string; question_type: 'mcq' | 'short_answer'; options: string[]; correct_answer: string | null; points: number; order_index: number };
type Attempt = { id: string; student_identifier: string; module_id: string; score: number; max_score: number; submitted_at: string; sync_status: 'queued' | 'synced' };

const demoUsers = { student: { identifier: 'COMP/0042/23', password: 'student123', name: 'Amina Wanjiku' }, lecturer: { identifier: 'LEC/8812/21', password: 'lecturer123', name: 'Dr. David Mutua' } };
const fallbackModules: Module[] = [
  { id: 'm1', title: 'Cybersecurity & Data Protection', subtitle: 'Module 01 · Foundations', description: 'Build safer habits around data, access, and Kenya Data Protection Act 2019 principles.', duration_minutes: 18, accent: 'blue', order_index: 1 },
  { id: 'm2', title: 'Web Architecture & Progressive Web Apps', subtitle: 'Module 02 · Delivery', description: 'Understand cache-first delivery, resilient interfaces, and offline-ready web architecture.', duration_minutes: 22, accent: 'teal', order_index: 2 },
  { id: 'm3', title: 'Database Synchronization & Network Protocols', subtitle: 'Module 03 · Systems', description: 'Explore queue pipelines, optimistic UI patterns, and eventual consistency.', duration_minutes: 25, accent: 'amber', order_index: 3 },
];
const fallbackQuestions: Question[] = [
  { id: 'q1', module_id: 'm1', prompt: 'Which principle limits access to only what a person needs?', question_type: 'mcq', options: ['Least privilege', 'Maximum availability', 'Open access', 'Data duplication'], correct_answer: 'Least privilege', points: 1, order_index: 1 },
  { id: 'q2', module_id: 'm1', prompt: 'Name one practice that helps protect personal data on a shared device.', question_type: 'short_answer', options: [], correct_answer: 'screen lock', points: 1, order_index: 2 },
  { id: 'q3', module_id: 'm2', prompt: 'What should an offline-first app show when a network request is unavailable?', question_type: 'mcq', options: ['A blank page', 'An offline status and cached content', 'A forced sign-out', 'A password reset'], correct_answer: 'An offline status and cached content', points: 1, order_index: 1 },
  { id: 'q4', module_id: 'm2', prompt: 'A service worker can help a web app cache which type of resource?', question_type: 'mcq', options: ['Only printed documents', 'Core text assets', 'Physical devices', 'Bank cards'], correct_answer: 'Core text assets', points: 1, order_index: 2 },
  { id: 'q5', module_id: 'm3', prompt: 'What does idempotent mean for a queued sync request?', question_type: 'mcq', options: ['It can safely be retried without duplicating the result', 'It never needs a network', 'It deletes every record', 'It always runs instantly'], correct_answer: 'It can safely be retried without duplicating the result', points: 1, order_index: 1 },
  { id: 'q6', module_id: 'm3', prompt: 'Which pattern updates the screen before the server confirms a change?', question_type: 'mcq', options: ['Optimistic UI', 'Hard refresh', 'Cold boot', 'Static rendering'], correct_answer: 'Optimistic UI', points: 1, order_index: 2 },
];

function App() {
  const [session, setSession] = useState<{ role: Role; name: string; identifier: string } | null>(() => JSON.parse(localStorage.getItem('salama_session') || 'null'));
  const [modules, setModules] = useState<Module[]>(fallbackModules);
  const [questions, setQuestions] = useState<Question[]>(fallbackQuestions);
  const [attempts, setAttempts] = useState<Attempt[]>(() => JSON.parse(localStorage.getItem('salama_attempts') || '[]'));
  const [online, setOnline] = useState(navigator.onLine);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [quizModule, setQuizModule] = useState<Module | null>(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const onOnline = () => setOnline(true); const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline);
    if (supabase) {
      Promise.all([
        supabase.from('salama_modules').select('*').order('order_index'),
        supabase.from('salama_questions').select('*').order('order_index'),
        supabase.from('salama_attempts').select('id, student_identifier, module_id, score, max_score, submitted_at, sync_status').order('submitted_at', { ascending: false }),
      ]).then(([moduleResult, questionResult, attemptResult]) => {
        if (moduleResult.data?.length) setModules(moduleResult.data as Module[]);
        if (questionResult.data?.length) setQuestions(questionResult.data as Question[]);
        if (attemptResult.data?.length) {
          const remoteAttempts = attemptResult.data as Attempt[];
          setAttempts((current) => {
            const merged = [...remoteAttempts, ...current.filter((local) => !remoteAttempts.some((remote) => remote.id === local.id))];
            localStorage.setItem('salama_attempts', JSON.stringify(merged));
            return merged;
          });
        }
      });
    }
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
  }, []);

  useEffect(() => { if (toast) { const timer = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(timer); } }, [toast]);

  const handleLogin = (role: Role, identifier: string, password: string): boolean => {
    const user = demoUsers[role];
    if (identifier.trim().toUpperCase() !== user.identifier || password !== user.password) return false;
    const nextSession = { role, name: user.name, identifier: user.identifier };
    setSession(nextSession); localStorage.setItem('salama_session', JSON.stringify(nextSession)); return true;
  };

  const logout = () => { setSession(null); localStorage.removeItem('salama_session'); setSelectedModule(null); setQuizModule(null); };
  const saveAttempt = async (attempt: Attempt, answers: Record<string, string>) => {
    const nextAttempts = [attempt, ...attempts.filter((item) => item.id !== attempt.id)];
    setAttempts(nextAttempts); localStorage.setItem('salama_attempts', JSON.stringify(nextAttempts));
    if (supabase && online) {
      const { error } = await supabase.from('salama_attempts').insert({ id: attempt.id, student_identifier: attempt.student_identifier, module_id: attempt.module_id, answers, score: attempt.score, max_score: attempt.max_score, submitted_at: attempt.submitted_at, client_timestamp: attempt.submitted_at, sync_status: 'synced' });
      if (!error) return;
    }
    setToast('Saved on this device. It will sync when connection returns.');
  };

  if (!session) return <Login onLogin={handleLogin} />;
  const studentAttempts = attempts.filter((attempt) => attempt.student_identifier === session.identifier);
  return <div className="app-shell">
    <Header session={session} online={online} onLogout={logout} />
    {session.role === 'student' ? <StudentHome modules={modules} questions={questions} attempts={studentAttempts} online={online} onOpenModule={setSelectedModule} onStartQuiz={setQuizModule} /> : <LecturerHome modules={modules} attempts={attempts} />}
    {selectedModule && <ModuleReader module={selectedModule} onClose={() => setSelectedModule(null)} onStartQuiz={() => { setSelectedModule(null); setQuizModule(selectedModule); }} />}
    {quizModule && <Quiz module={quizModule} questions={questions.filter((question) => question.module_id === quizModule.id)} identifier={session.identifier} onClose={() => setQuizModule(null)} onSubmit={saveAttempt} />}
    {toast && <div className="toast">{toast}</div>}
  </div>;
}

function Login({ onLogin }: { onLogin: (role: Role, identifier: string, password: string) => boolean }) {
  const [role, setRole] = useState<Role>('student'); const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); if (!onLogin(role, identifier, password)) setError('Check the demo ID and password, then try again.'); };
  const switchRole = (next: Role) => { setRole(next); setIdentifier(''); setPassword(''); setError(''); };
  return <main className="login-page"><div className="login-art"><div className="brand-mark">SS</div><p className="eyebrow">OFFLINE-FIRST LEARNING</p><h1>Learning that<br /><span>keeps moving.</span></h1><p className="login-copy">Salama Shule gives students a dependable path to progress, even when the network disappears.</p><div className="signal-card"><div className="signal-icon">↗</div><div><strong>Built for real conditions</strong><span>Fast, focused, and ready for low bandwidth.</span></div></div></div><div className="login-panel"><div className="mobile-brand"><div className="brand-mark">SS</div><span>Salama Shule</span></div><div className="form-wrap"><p className="eyebrow">WELCOME BACK</p><h2>Sign in to your classroom</h2><p className="muted">Use your institution credentials to continue.</p><div className="role-switch"><button className={role === 'student' ? 'active' : ''} onClick={() => switchRole('student')}>Student</button><button className={role === 'lecturer' ? 'active' : ''} onClick={() => switchRole('lecturer')}>Lecturer</button></div><form onSubmit={submit}><label>Institution ID<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Enter your institution ID" autoComplete="username" /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button full" type="submit">Enter classroom <span>→</span></button></form></div><div className="login-footer">SALAMA SHULE <span>·</span> KENYA</div></div></main>;
}

function Header({ session, online, onLogout }: { session: { role: Role; name: string; identifier: string }; online: boolean; onLogout: () => void }) {
  const [profileOpen, setProfileOpen] = useState(false);
  return <header className="topbar"><div className="topbar-brand"><div className="mini-mark">SS</div><div><strong>Salama Shule</strong><span>{session.role === 'student' ? 'Student workspace' : 'Lecturer workspace'}</span></div></div><div className="topbar-actions"><div className={online ? 'network-pill online' : 'network-pill'}><i />{online ? 'Online' : 'Offline mode'}</div><div className="profile-wrap"><button className="profile-trigger" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-label="Open profile menu"><div className="avatar">{session.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><span>{session.name}</span><b>{profileOpen ? '⌃' : '⌄'}</b></button>{profileOpen && <div className="profile-menu"><div className="profile-summary"><strong>{session.name}</strong><span>{session.role === 'student' ? 'Student' : 'Lecturer'}</span></div><div className="profile-detail"><span>Institution ID</span><strong>{session.identifier}</strong></div><button className="profile-logout" onClick={onLogout}>Log out <span>→</span></button></div>}</div></div></header>; }

function StudentHome({ modules, questions, attempts, online, onOpenModule, onStartQuiz }: { modules: Module[]; questions: Question[]; attempts: Attempt[]; online: boolean; onOpenModule: (module: Module) => void; onStartQuiz: (module: Module) => void }) {
  const completed = new Set(attempts.map((attempt) => attempt.module_id)); const progress = Math.round((completed.size / modules.length) * 100); const latest = attempts[0];
  return <main className="content student-content"><section className="welcome-row"><div><p className="eyebrow">STUDENT DASHBOARD</p><h1>Good morning, Amina.</h1><p className="muted">Pick up where you left off. Your progress is saved automatically.</p></div><div className="progress-ring"><strong>{progress}%</strong><span>overall progress</span></div></section><section className={online ? 'offline-banner connected' : 'offline-banner'}><div className="offline-icon">{online ? '✓' : '!'}</div><div><strong>{online ? 'Online and synced' : 'Offline mode'}</strong><span>{online ? 'Your latest activity can sync with the learning record.' : 'Course notes and quiz answers are saved on this device.'}</span></div><span className="banner-tag">{online ? 'CONNECTED' : 'SAVED LOCALLY'}</span></section><div className="section-heading"><div><p className="eyebrow">YOUR CURRICULUM</p><h2>Three modules to master</h2></div><span className="module-count">{completed.size} of {modules.length} complete</span></div><section className="module-grid">{modules.map((module) => { const done = completed.has(module.id); const moduleQuestions = questions.filter((question) => question.module_id === module.id); return <article className={`module-card ${module.accent}`} key={module.id}><div className="module-top"><span className="module-number">0{module.order_index}</span><span className={`status ${done ? 'complete' : ''}`}>{done ? 'Completed' : 'Not started'}</span></div><p className="module-subtitle">{module.subtitle}</p><h3>{module.title}</h3><p className="module-description">{module.description}</p><div className="module-meta"><span>{module.duration_minutes} min read</span><span>{moduleQuestions.length} questions</span></div><div className="card-actions"><button className="secondary-button" onClick={() => onOpenModule(module)}>Read notes</button><button className="icon-button" aria-label={`Start ${module.title} quiz`} onClick={() => onStartQuiz(module)}>→</button></div></article>; })}</section><section className="continue-card"><div><p className="eyebrow">CONTINUE LEARNING</p><h2>{latest ? 'Review your latest submission' : 'Start with the foundations'}</h2><p className="muted">{latest ? 'Your latest assessment is safely recorded.' : 'Begin with Module 01 and build a strong foundation in data protection.'}</p></div><button className="primary-button" onClick={() => onStartQuiz(modules[latest ? Math.min(modules.length - 1, modules.findIndex((item) => item.id === latest.module_id) + 1) : 0])}>{latest ? 'Next module' : 'Begin Module 01'} <span>→</span></button></section></main>;
}

function LecturerHome({ modules, attempts }: { modules: Module[]; attempts: Attempt[] }) { const average = attempts.length ? Math.round(attempts.reduce((total, attempt) => total + (attempt.score / Math.max(1, attempt.max_score)) * 100, 0) / attempts.length) : 0; return <main className="content"><section className="welcome-row"><div><p className="eyebrow">LECTURER DASHBOARD</p><h1>Good morning, Dr. Mutua.</h1><p className="muted">A clear view of learning activity across your cohort.</p></div><button className="secondary-button export-button">Export report <span>↓</span></button></section><section className="stats-grid"><div className="stat-card"><span className="stat-label">STUDENT SUBMISSIONS</span><strong>{attempts.length || '—'}</strong><small>Across all modules</small></div><div className="stat-card"><span className="stat-label">AVERAGE SCORE</span><strong>{average ? `${average}%` : '—'}</strong><small>Based on synced attempts</small></div><div className="stat-card"><span className="stat-label">SYNC HEALTH</span><strong className="green-text">100%</strong><small>All systems operational</small></div></section><section className="monitor-panel"><div className="section-heading"><div><p className="eyebrow">LIVE MONITORING</p><h2>Module progress</h2></div><div className="sync-label"><i /> Last synced just now</div></div>{modules.map((module) => { const moduleAttempts = attempts.filter((attempt) => attempt.module_id === module.id); const moduleAverage = moduleAttempts.length ? Math.round(moduleAttempts.reduce((total, attempt) => total + (attempt.score / Math.max(1, attempt.max_score)) * 100, 0) / moduleAttempts.length) : 0; return <div className="progress-row" key={module.id}><div className={`progress-dot ${module.accent}`} /><div className="progress-info"><strong>{module.title}</strong><span>{moduleAttempts.length ? `${moduleAttempts.length} submission${moduleAttempts.length === 1 ? '' : 's'}` : 'Awaiting first submissions'}</span></div><div className="bar"><div style={{ width: `${moduleAverage}%` }} /></div><strong className="progress-value">{moduleAverage}%</strong></div>; })}</section><section className="audit-panel"><div className="section-heading"><div><p className="eyebrow">SYNC AUDIT</p><h2>Recent activity</h2></div><span className="module-count">{attempts.length} total records</span></div>{attempts.length ? attempts.slice(0, 5).map((attempt) => <div className="audit-row" key={attempt.id}><div className="audit-avatar">{attempt.student_identifier.slice(-2)}</div><div><strong>{attempt.student_identifier}</strong><span>Assessment submitted</span></div><strong className="audit-score">{attempt.score}/{attempt.max_score}</strong><span className="synced-pill">Synced</span></div>) : <div className="empty-state">Student assessment activity will appear here as submissions arrive.</div>}</section></main>; }

function ModuleReader({ module, onClose, onStartQuiz }: { module: Module; onClose: () => void; onStartQuiz: () => void }) { return <div className="overlay"><div className="reader"><div className="reader-head"><div><p className="eyebrow">{module.subtitle}</p><h2>{module.title}</h2></div><button className="close-button" onClick={onClose}>×</button></div><div className="reader-body"><p className="lead">This module is designed for focused reading on any connection. Keep these notes available on your device for revision.</p><div className="note-block"><span>01</span><div><h3>Start with the principle</h3><p>Good systems protect people by limiting access, minimizing collected data, and making safe behavior the easiest choice.</p></div></div><div className="note-block"><span>02</span><div><h3>Make it resilient</h3><p>When connectivity is uncertain, core learning content should remain readable, actions should save locally, and the learner should always know what happened.</p></div></div><div className="note-block"><span>03</span><div><h3>Verify and reflect</h3><p>Use the short assessment to test recall. Your answers are timestamped locally before they are synchronized.</p></div></div></div><div className="reader-foot"><span>{module.duration_minutes} minutes · text-first notes</span><button className="primary-button" onClick={onStartQuiz}>Take assessment <span>→</span></button></div></div></div>; }

function Quiz({ module, questions, identifier, onClose, onSubmit }: { module: Module; questions: Question[]; identifier: string; onClose: () => void; onSubmit: (attempt: Attempt, answers: Record<string, string>) => Promise<void> }) { const [answers, setAnswers] = useState<Record<string, string>>({}); const [seconds, setSeconds] = useState(module.order_index === 1 ? 180 : 240); const [submitted, setSubmitted] = useState(false); useEffect(() => { if (submitted) return; const timer = window.setInterval(() => setSeconds((value) => value <= 1 ? 0 : value - 1), 1000); return () => window.clearInterval(timer); }, [submitted]); useEffect(() => { if (seconds === 0 && !submitted) void submit(); }, [seconds]); const score = questions.reduce((total, question) => total + (answers[question.id]?.trim().toLowerCase() === question.correct_answer?.trim().toLowerCase() ? question.points : 0), 0); const submit = async () => { if (submitted) return; const attempt: Attempt = { id: crypto.randomUUID(), student_identifier: identifier, module_id: module.id, score, max_score: questions.reduce((total, question) => total + question.points, 0), submitted_at: new Date().toISOString(), sync_status: 'queued' }; setSubmitted(true); await onSubmit(attempt, answers); }; return <div className="overlay"><div className="quiz"><div className="quiz-head"><div><p className="eyebrow">ASSESSMENT · {module.subtitle}</p><h2>{module.title}</h2></div><div className="timer"><span>TIME LEFT</span><strong>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</strong></div></div>{submitted ? <div className="result-state"><div className="result-check">✓</div><p className="eyebrow">SUBMISSION SAVED</p><h2>{score} / {questions.reduce((total, question) => total + question.points, 0)} correct</h2><p>Your result has been recorded with a local timestamp. You can continue learning while it syncs.</p><button className="primary-button" onClick={onClose}>Return to dashboard <span>→</span></button></div> : <><div className="quiz-progress"><div style={{ width: `${Math.round((Object.keys(answers).length / Math.max(1, questions.length)) * 100)}%` }} /></div><div className="quiz-body">{questions.map((question, index) => <div className="question" key={question.id}><span className="question-number">0{index + 1}</span><h3>{question.prompt}</h3>{question.question_type === 'mcq' ? <div className="options">{question.options.map((option) => <button className={answers[question.id] === option ? 'option selected' : 'option'} key={option} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}><span className="radio" />{option}</button>)}</div> : <input className="short-answer" value={answers[question.id] || ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} placeholder="Type a short answer" />}</div>)}</div><div className="quiz-foot"><button className="text-button" onClick={onClose}>Save and exit</button><button className="primary-button" onClick={() => void submit()}>Submit assessment <span>→</span></button></div></>}</div></div>; }

export default App;

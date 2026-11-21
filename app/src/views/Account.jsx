import { useState } from 'react';
import { motion } from 'motion/react';
import { LogOut, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../wm/card';
import { Button } from '../wm/button';
import { Input } from '../wm/input';
import { ShimmerButton } from '../wm/shimmer-button';
import { ShimmerProgress } from '../wm/shimmer-progress';
import { ContinuousTabs } from '../wm/continuous-tabs';
import { cn } from '../wm/utils';
import { Eyebrow, Lead, Rise, Screen, SHARP } from '../ui';
import { queueWords } from '../lib/queues';
import { DEMO, useSession } from '../session';
import { SplitTitle } from '../fx/text';
import { shake } from '../fx/fx';
import { Logo } from '../App';
import { champOf, norm } from '../lib/legacy';
import { REGION_LIST, champsFor } from '../lib/champs';

/* Players set up ahead of time: typing the Riot ID fills in the rest. */
const PRESETS = { 'evlijah#3958': { region: 'na', role: 'support', mains: ['Rell'] }, 'the gonzoogler#weeee': { region: 'na', role: 'jungle', mains: ['Nunu & Willump', "Kha'Zix"] } };
const label = 'flex flex-col gap-1.5 text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase';

function Shell({ children }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[460px] flex-col justify-center gap-6 py-10" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
      <div className="flex flex-col gap-4">
        <motion.div initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 14 }} className="self-start"><Logo size={64} /></motion.div>
        <h1 className="font-display m-0 text-[44px] leading-[0.95] font-black tracking-tight uppercase">
          <SplitTitle text="Jungle" className="pb-[0.1em] text-foreground" delay={150} /><br />
          <SplitTitle text="Coach" className="text-neon pb-[0.1em]" delay={380} />
        </h1>
      </div>
      <motion.div initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, ...SHARP }} transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.5 }} className="flex flex-col gap-5">
        {children}
      </motion.div>
    </div>
  );
}

export function ConfigMissing() {
  return (
    <Shell>
      <Card><CardContent className="flex flex-col gap-2">
        <h2 className="m-0 text-lg font-bold tracking-tight">Almost there: the site isn't connected to Supabase yet</h2>
        <Lead className="text-sm">Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in the Vercel project's environment variables, then redeploy. The README lists every setting.</Lead>
      </CardContent></Card>
    </Shell>
  );
}

export function SignIn() {
  const { signIn } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg('');
    const { error } = await signIn(username.trim().toLowerCase(), password);
    setBusy(false);
    if (error) { setMsg(error.message); shake(document.getElementById('signin-card')); }
  }
  return (
    <Shell>
      <Lead>Your own stats, a live game tracker and builds for jungle and support.</Lead>
      <Card glow id="signin-card">
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-3.5">
            <label className={label}>Username<Input id="auth-username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your username" /></label>
            <label className={label}>Password<Input id="auth-password" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" /></label>
            {msg && <p className="m-0 text-sm text-bad" role="alert">{msg}</p>}
            <ShimmerButton type="submit" disabled={busy}>{busy ? 'One moment…' : 'Sign in'}</ShimmerButton>
          </form>
        </CardContent>
      </Card>
    </Shell>
  );
}

/* Riot ID, region, role and favourite champions. Used for first-time setup and on the Me tab. */
export function ProfileForm({ first, onSaved }) {
  const { profile, saveProfile } = useSession();
  const [riot, setRiot] = useState(profile && profile.riot_name ? `${profile.riot_name}#${profile.riot_tag}` : '');
  const [name, setName] = useState((profile && profile.display_name) || '');
  const [region, setRegion] = useState((profile && profile.region) || 'na');
  const [role, setRole] = useState((profile && profile.role) || 'jungle');
  const [mains, setMains] = useState((profile && profile.mains) || []);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pool = champsFor(role);
  function addMain(text) {
    const c = champOf(text);
    if (c && !mains.includes(c) && mains.length < 5) { setMains([...mains, c]); setPick(''); } else setPick(text);
  }
  async function submit(e) {
    e.preventDefault();
    const m = /^\s*(.+?)\s*#\s*([A-Za-z0-9]{2,5})\s*$/.exec(riot);
    if (!m) { setErr('Enter your Riot ID as name#tag, for example Hide on bush#KR1.'); return; }
    setBusy(true); setErr('');
    const error = await saveProfile({ display_name: name.trim() || m[1], riot_name: m[1], riot_tag: m[2], region, role, mains });
    setBusy(false);
    if (error) setErr(error); else if (onSaved) onSaved();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3.5">
      <label className={label}>Riot ID<Input id="pf-riot" required value={riot} onChange={(e) => { const v = e.target.value; setRiot(v); const p = PRESETS[v.trim().replace(/\s*#\s*/, '#').toLowerCase()]; if (p && first) { setRegion(p.region); setRole(p.role); setMains(p.mains); } }} placeholder="Name#TAG" autoCapitalize="off" autoCorrect="off" spellCheck={false} /></label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className={label}>Region
          <select id="pf-region" value={region} onChange={(e) => setRegion(e.target.value)} className="h-12 w-full min-w-0 rounded-2xl border border-white/12 bg-black/30 px-3 text-base font-normal tracking-normal text-foreground normal-case">
            {REGION_LIST.map(([id, text]) => <option key={id} value={id}>{text}</option>)}
          </select>
        </label>
        <label className={label}>Name to show<Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" /></label>
      </div>
      <div className={label}>Main role
        <ContinuousTabs tabs={[{ id: 'jungle', label: 'Jungle' }, { id: 'support', label: 'Support' }]} value={role} onChange={(r) => { setRole(r); setMains([]); }} label="Main role" />
      </div>
      <div className={label}>Champions you play most (up to 5)
        <datalist id="pf-champs">{pool.map((n) => <option key={n} value={n} />)}</datalist>
        <Input id="pf-main" list="pf-champs" value={pick} onChange={(e) => addMain(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMain(pick); } }} placeholder="Type a champion" aria-invalid={!!norm(pick) && !champOf(pick)} autoComplete="off" />
        {mains.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {mains.map((c) => (
              <motion.button layout type="button" key={c} whileTap={{ scale: 0.92 }} onClick={() => setMains(mains.filter((x) => x !== c))} aria-label={`Remove ${c}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-semibold tracking-normal text-secondary-foreground normal-case">{c}<span aria-hidden="true" className="text-muted-foreground">×</span></motion.button>
            ))}
          </div>
        )}
      </div>
      {err && <p className="m-0 text-sm text-bad" role="alert">{err}</p>}
      <ShimmerButton type="submit" disabled={busy}>{busy ? 'Saving…' : first ? 'Save and pull my games' : 'Save changes'}</ShimmerButton>
    </form>
  );
}

export function Setup() {
  const { signOut } = useSession();
  return (
    <Shell>
      <Lead>One-time setup. Your Riot ID lets the site pull your ranked and normal games and work out your stats.</Lead>
      <Card><CardContent><ProfileForm first /></CardContent></Card>
      {!DEMO && <Button variant="ghost" onClick={signOut} className="text-muted-foreground"><LogOut /> Sign out</Button>}
    </Shell>
  );
}

export function SyncBanner() {
  const { sync, stats, runSync } = useSession();
  if (sync.error) return (
    <div className="flex flex-col gap-2 rounded-2xl bg-bad-soft px-4 py-3 text-sm" role="alert">
      <span>{sync.error}</span>
      <Button variant="outline" size="sm" onClick={runSync} className="self-start"><RefreshCw /> Try again</Button>
    </div>
  );
  if (!sync.busy) return null;
  return (
    <motion.div layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10" role="status">
      <div className="flex items-center justify-between text-sm font-semibold"><span>{stats ? 'Checking for new games…' : 'Pulling your games from Riot…'}</span><span className="tnum text-muted-foreground">{sync.total ? `${sync.done}/${sync.total}` : ''}</span></div>
      <ShimmerProgress value={sync.total ? (sync.done / sync.total) * 100 : 5} label="Sync progress" />
    </motion.div>
  );
}

export default function Me() {
  const { username, profile, statsAt, sync, runSync, signOut, stats, role } = useSession();
  const [saved, setSaved] = useState(false);
  let when = 'never';
  try { if (statsAt) when = new Date(statsAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); } catch (e) {}
  return (
    <Screen>
      <Rise className="flex flex-col gap-1.5">
        <Eyebrow>Your account</Eyebrow>
        <Lead>{username ? `Signed in as ${username} · ` : ''}{profile.riot_name}#{profile.riot_tag}</Lead>
      </Rise>
      <Rise>
        <Card><CardContent className="flex flex-col gap-3">
          <h3 className="m-0 text-lg font-bold tracking-tight">Your stats</h3>
          <Lead className="text-sm">Last updated {when}. {stats ? `${stats.games} ${queueWords(stats).adj}${role} games on record.` : 'No games pulled yet.'} New games are picked up when you open the site; you can also pull them now.</Lead>
          <Button variant="outline" size="lg" onClick={runSync} disabled={sync.busy || DEMO}><RefreshCw className={sync.busy ? 'animate-spin' : ''} /> {sync.busy ? 'Updating…' : 'Update my stats now'}</Button>
        </CardContent></Card>
      </Rise>
      <Rise>
        <Card><CardContent className="flex flex-col gap-3">
          <h3 className="m-0 text-lg font-bold tracking-tight">Profile</h3>
          <ProfileForm onSaved={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }} />
          {saved && <p className="m-0 text-sm text-good" role="status">Saved.</p>}
        </CardContent></Card>
      </Rise>
      {!DEMO && <Rise><Password /></Rise>}
      {!DEMO && <Rise><Button variant="ghost" size="lg" onClick={signOut} className="w-full text-muted-foreground"><LogOut /> Sign out</Button></Rise>}
    </Screen>
  );
}

function Password() {
  const { changePassword } = useSession();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = await changePassword(pw);
    setBusy(false);
    if (error) setMsg({ bad: true, text: error.message }); else { setMsg({ text: 'Password changed.' }); setPw(''); }
  }
  return (
    <Card><CardContent>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <h3 className="m-0 text-lg font-bold tracking-tight">Change password</h3>
        <label className={label}>New password<Input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 8 characters" /></label>
        {msg && <p className={cn('m-0 text-sm', msg.bad ? 'text-bad' : 'text-good')} role="status">{msg.text}</p>}
        <Button type="submit" variant="outline" size="lg" disabled={busy || pw.length < 8}>{busy ? 'Saving…' : 'Change password'}</Button>
      </form>
    </CardContent></Card>
  );
}

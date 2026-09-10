import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileCheck2,
  Globe2,
  History,
  Info,
  Menu,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  UserPlus,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from './api';

const features = [
  ['Signal, not noise', 'A careful AI read of language, sourcing, and claims to surface what deserves a second look.', ShieldCheck],
  ['Built for the web', 'Paste a headline, article, or URL and get a clear, human-readable credibility briefing.', Globe2],
  ['Your trail, retained', 'Keep every check in one private timeline so you can revisit decisions and spot patterns.', History]
];

const questions = [
  ['Is factX a fact checker?', 'factX is an AI-powered screening tool that checks claims against reliable sources, official statements, and factual evidence.'],
  ['What can I submit?', 'You can enter a headline, a complete news article, or a direct news webpage URL. Multi-language submissions are supported.'],
  ['How does the confidence score work?', 'It reflects the strength, corroboration, and consistency of textual signals and reliable sources retrieved.']
];

const languageOptions = [
  ['auto', 'Auto Detect'],
  ['en', 'English'],
  ['te', 'Telugu (తెలుగు)'],
  ['hi', 'Hindi (हिन्दी)'],
  ['ur', 'Urdu (اردو)'],
  ['ta', 'Tamil (தமிழ்)'],
  ['kn', 'Kannada (ಕನ್ನಡ)'],
  ['ml', 'Malayalam (മലയാളം)'],
  ['mr', 'Marathi (मराठी)'],
  ['bn', 'Bengali (বাংলা)'],
  ['gu', 'Gujarati (ગુજરાતી)'],
  ['pa', 'Punjabi (ਪੰਜਾਬੀ)']
];

let resultAudioContext;
let resultSoundCache = {};

function playResultSound(verdictType) {
  if (localStorage.getItem('factx_sound') === 'off') return;

  const successAudio = '/dragon-studio-correct-472358.mp3';
  const errorAudio = '/freesound_community-buzzer2-6109.mp3';
  const filePath = verdictType === 'verified' ? successAudio : errorAudio;

  if (!resultSoundCache[filePath]) {
    resultSoundCache[filePath] = new Audio(filePath);
  }

  const audio = resultSoundCache[filePath];
  audio.currentTime = 0;
  audio.play().catch(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    resultAudioContext ||= new AudioContextClass();
    const context = resultAudioContext;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();

    if (verdictType === 'verified') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(160, now + 0.08);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    }

    osc.connect(gain).connect(context.destination);
    osc.start(now);
    osc.stop(now + 0.30);

    if (context.state === 'suspended') {
      context.resume().catch(() => {});
    }
  });
}

function SoundToggle() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('factx_sound') !== 'off');
  return (
    <button
      className="icon-btn sound-toggle"
      aria-label={enabled ? 'Turn sounds off' : 'Turn sounds on'}
      title={enabled ? 'Sound is on (Click to mute)' : 'Sound is off (Click to enable)'}
      onClick={() => {
        const next = !enabled;
        setEnabled(next);
        localStorage.setItem('factx_sound', next ? 'on' : 'off');
      }}
    >
      {enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
    </button>
  );
}

function Header({ user, theme, setTheme }) {
  const [menu, setMenu] = useState(false);
  return (
    <header className="nav">
      <Link className="brand" to="/">
        <span className="brand-mark"><Sparkles size={17} /></span>
        factX<span className="brand-dot">.</span>
      </Link>
      <nav className={menu ? 'nav-links mobile-open' : 'nav-links'}>
        <a href="/#features" onClick={() => setMenu(false)}>Why factX</a>
        <a href="/#how" onClick={() => setMenu(false)}>How it works</a>
        <a href="/#pricing" onClick={() => setMenu(false)}>Plans</a>
        <Link className="nav-cta" to="/dashboard">
          {user ? 'Open workspace' : 'Check a story'} <ArrowRight size={15} />
        </Link>
      </nav>
      <div className="nav-actions">
        {user && (
          <button
            className="icon-btn"
            aria-label="Refresh story page"
            title="Refresh story page"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={17} />
          </button>
        )}
        <button
          className="icon-btn"
          aria-label="Toggle theme"
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
        </button>
        <button className="menu-btn" aria-label="Menu" onClick={() => setMenu(!menu)}>
          {menu ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}

function Landing() {
  const navigate = useNavigate();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="pulse" /> AI-powered news credibility verification</span>
          <h1>Read between<br /><em>the headlines.</em></h1>
          <p>factX analyzes news headlines, complete articles, and URLs against reliable sources to separate real reporting from falsehoods.</p>
          <div className="hero-buttons">
            <button className="primary-btn" onClick={() => navigate('/dashboard')}>
              Verify a story <ArrowRight size={17} />
            </button>
            <a className="text-btn" href="#how">See how it works <span>↓</span></a>
          </div>
          <div className="hero-note">
            <div className="avatars"><span>AK</span><span>JM</span><span>RS</span></div>
            Trusted by 12,000+ curious readers
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-glow" />
          <div className="scan-card">
            <div className="scan-top">
              <span className="tiny-label"><span className="status-dot" /> LIVE VERIFICATION</span>
              <span>factX / 01</span>
            </div>
            <div className="scan-headline">Breaking: City council announces verified infrastructure revitalization roadmap</div>
            <div className="meter-label">
              <span>Credibility signal</span>
              <strong>92%</strong>
            </div>
            <div className="meter"><span style={{ width: '92%' }} /></div>
            <div className="scan-tags">
              <span><Check size={12} /> Primary municipal records</span>
              <span><Check size={12} /> Multiple independent wires</span>
            </div>
            <div className="scan-verdict">
              <div className="verdict-icon"><ShieldCheck size={19} /></div>
              <div>
                <small>VERDICT</small>
                <strong>VERIFIED / LIKELY TRUE</strong>
              </div>
              <ArrowRight size={17} />
            </div>
          </div>
          <div className="float-chip chip-one">
            <FileCheck2 size={15} />
            <span><b>3,420+</b><small>stories checked</small></span>
          </div>
          <div className="float-chip chip-two">
            <span><b>+24%</b><small>clarity this week</small></span>
          </div>
        </div>
      </section>

      <section className="trust-row">
        Designed for people who care about what they share
        <div><b>THE DAILY READ</b><b>open<span>mind</span></b><b>COMMONS</b><b>civic / lab</b></div>
      </section>

      <section className="section features" id="features">
        <div className="section-intro">
          <span className="eyebrow">A calmer internet starts here</span>
          <h2>Clarity is a <em>practice.</em></h2>
          <p>We turn a split-second impulse into a considered decision, backed by real sources and evidence.</p>
        </div>
        <div className="feature-grid">
          {features.map(([title, text, Icon], i) => (
            <motion.div
              className="feature"
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="feature-icon"><Icon size={21} /></div>
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="feature-number">0{i + 1}</span>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="section how" id="how">
        <div className="how-visual">
          <div className="orbit orbit-a" />
          <div className="orbit orbit-b" />
          <div className="how-center">
            <Sparkles size={30} />
            <span>Pause<br />with purpose.</span>
          </div>
        </div>
        <div className="how-copy">
          <span className="eyebrow">Three thoughtful steps</span>
          <h2>Less sharing.<br /><em>More knowing.</em></h2>
          {[
            ['Bring the story', 'Paste a headline, article text, or webpage URL in any supported language.'],
            ['Meet your signals', 'Our engine searches live news wires, official sources, and evaluates evidence.'],
            ['Understand the verdict', 'Read the credibility rating, supporting and contradicting evidence, and source citations.']
          ].map(([title, desc], i) => (
            <div className="step" key={title}>
              <span>0{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="quote-section">
        <Sparkles size={27} />
        <blockquote>“The most useful thing AI can do for news is not tell us what to think. It can help us verify what is true.”</blockquote>
        <span>— factX principle, 2026</span>
      </section>

      <section className="section pricing" id="pricing">
        <div className="section-intro">
          <span className="eyebrow">Simple by design</span>
          <h2>Make room for <em>better questions.</em></h2>
        </div>
        <div className="price-grid">
          <Price name="Curious" price="Free" detail="For everyday news readers." />
          <Price featured name="Informed" price="$8" detail="For researchers & journalists." />
        </div>
      </section>

      <section className="section faq">
        <div className="section-intro">
          <span className="eyebrow">Questions, answered</span>
          <h2>Good skepticism<br /><em>welcomes questions.</em></h2>
        </div>
        <div>
          {questions.map(([q, a]) => (
            <Faq key={q} q={q} a={a} />
          ))}
        </div>
      </section>

      <footer className="footer">
        <Link className="brand" to="/">
          <span className="brand-mark"><Sparkles size={17} /></span>
          factX<span className="brand-dot">.</span>
        </Link>
        <span>© 2026 factX. Built for better questions and verified information.</span>
        <div>
          <a href="#features">About</a>
          <a href="#pricing">Plans</a>
          <a href="mailto:hello@factx.ai">Contact</a>
        </div>
      </footer>
    </>
  );
}

function Price({ name, price, detail, featured }) {
  return (
    <div className={`price-card${featured ? ' featured' : ''}`}>
      {featured && <div className="popular">Most intentional</div>}
      <span>{name}</span>
      <strong>{price}{price !== 'Free' && <small> / month</small>}</strong>
      <p>{detail}</p>
      <ul>
        <li><Check size={15} /> {featured ? 'Unlimited checks' : 'Free unlimited checks'}</li>
        <li><Check size={15} /> Multi-language verification</li>
        <li><Check size={15} /> Primary source cross-referencing</li>
      </ul>
      <Link to="/dashboard" className={featured ? 'light-btn' : 'outline-btn'}>
        {featured ? 'Start analyzing' : 'Start for free'} <ArrowRight size={15} />
      </Link>
    </div>
  );
}

function Faq({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="faq-item">
      <button onClick={() => setOpen(!open)}>
        <span>{q}</span>
        {open ? <X size={17} /> : <ChevronDown size={17} />}
      </button>
      {open && <p>{a}</p>}
    </div>
  );
}

function Auth({ register, onAuth }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/auth/${register ? 'register' : 'login'}`, form);
      localStorage.setItem('veritas_token', data.token);
      onAuth(data.user);
      navigate('/dashboard');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not connect to factX server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-aside">
        <Link className="brand" to="/">
          <span className="brand-mark"><Sparkles size={17} /></span>
          factX<span className="brand-dot">.</span>
        </Link>
        <div>
          <span className="eyebrow">A better relationship with information</span>
          <h1>Stay curious.<br /><em>Stay grounded.</em></h1>
          <p>Make your next share a verified one.</p>
        </div>
      </div>
      <div className="auth-form-wrap">
        <div className="auth-form">
          <span className="eyebrow">{register ? 'Create your account' : 'Welcome back'}</span>
          <h2>{register ? 'Begin with a question.' : 'Continue your practice.'}</h2>
          <p className="muted">{register ? 'Your private workspace for making sense of the web.' : 'Your saved factX checks are waiting.'}</p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Name
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
              </label>
            )}
            <label>
              Email
              <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
            </label>
            <label>
              Password
              <input type="password" minLength="8" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="8+ characters" />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="primary-btn full" disabled={loading}>
              {loading ? 'Working...' : register ? <><UserPlus size={17} /> Create workspace</> : 'Sign in'}
            </button>
          </form>
          <p className="switch">
            {register ? 'Already have an account?' : 'New to FactX?'}{' '}
            <Link to={register ? '/login' : '/register'}>{register ? 'Sign in' : 'Create one'}</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function getVerdictDetails(scan) {
  const raw = String(scan.displayVerdict || scan.verdict || scan.classification || '').toUpperCase();
  if (raw.includes('VERIFIED') || raw.includes('GENUINE') || (raw.includes('TRUE') && !raw.includes('PARTIALLY'))) {
    return {
      type: 'verified',
      label: 'VERIFIED / LIKELY TRUE',
      toneClass: 'state-verified',
      icon: '🟢',
      accentColor: '#16a34a'
    };
  }
  if (raw.includes('FALSE') || raw.includes('FAKE')) {
    return {
      type: 'false',
      label: 'FALSE / LIKELY FAKE',
      toneClass: 'state-false',
      icon: '🔴',
      accentColor: '#dc2626'
    };
  }
  if (raw.includes('MISLEADING') || raw.includes('PARTIALLY')) {
    return {
      type: 'misleading',
      label: 'MISLEADING / PARTIALLY TRUE',
      toneClass: 'state-misleading',
      icon: '🟠',
      accentColor: '#ea580c'
    };
  }
  return {
    type: 'insufficient',
    label: 'INSUFFICIENT EVIDENCE',
    toneClass: 'state-insufficient',
    icon: '⚪',
    accentColor: '#64748b'
  };
}

function Dashboard({ user, onLogout }) {
  const [input, setInput] = useState('');
  const [type, setType] = useState('headline');
  const [language, setLanguage] = useState('auto');
  const [scan, setScan] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('Analyzing claim...');
  const [error, setError] = useState('');
  const [emptyAttempt, setEmptyAttempt] = useState(false);
  const inputRef = useRef(null);

  // Load history from API or localStorage
  useEffect(() => {
    api.get('/chat/history')
      .then(({ data }) => {
        if (data.scans && data.scans.length) {
          setHistory(data.scans);
        } else {
          const local = JSON.parse(localStorage.getItem('factx_history') || '[]');
          setHistory(local);
        }
      })
      .catch(() => {
        const local = JSON.parse(localStorage.getItem('factx_history') || '[]');
        setHistory(local);
      });
  }, [user]);

  // Loading animation stages
  useEffect(() => {
    if (!loading) return undefined;
    const stages = ['Analyzing claim...', 'Checking reliable sources...', 'Comparing evidence...'];
    let index = 0;
    setLoadingStage(stages[index]);
    const timer = window.setInterval(() => {
      index = Math.min(index + 1, stages.length - 1);
      setLoadingStage(stages[index]);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [loading]);

  async function check(e) {
    e.preventDefault();
    const trimmedInput = input.trim();

    if (!trimmedInput) {
      setEmptyAttempt(true);
      setError('Please enter a headline, article, or URL to verify.');
      inputRef.current?.focus();
      return;
    }

    if (type === 'url') {
      try {
        const parsed = new URL(trimmedInput);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return setError('Please enter a valid news article URL.');
        }
      } catch {
        return setError('Please enter a valid news article URL.');
      }
    } else if (type === 'headline' && trimmedInput.length < 3) {
      return setError('Please enter at least 3 characters for a headline.');
    } else if (type === 'article' && trimmedInput.length < 20) {
      return setError('Please provide a longer article or headline with enough information to verify.');
    }

    setLoading(true);
    setEmptyAttempt(false);
    setError('');

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      resultAudioContext ||= new AudioContextClass();
      resultAudioContext.resume().catch(() => {});
    }

    try {
      const { data } = await api.post('/verify', {
        content: trimmedInput,
        type,
        language
      });

      const verdictType = getVerdictDetails(data.scan).type;
      playResultSound(verdictType);
      setScan(data.scan);
      setHistory((prev) => {
        const updated = [
          data.scan,
          ...prev.filter(item => (item._id ? item._id !== data.scan._id : item.input !== data.scan.input))
        ];
        localStorage.setItem('factx_history', JSON.stringify(updated.slice(0, 25)));
        return updated;
      });
    } catch (e) {
      const serverMsg = e.response?.data?.message;
      if (serverMsg) {
        setError(serverMsg);
      } else if (e.code === 'ERR_NETWORK' || !e.response) {
        setError('Cannot connect to the verification server. Please ensure the backend server is running on port 5000.');
      } else {
        setError('Insufficient reliable evidence. FactX cannot confidently determine the claim.');
      }
    } finally {
      setLoading(false);
    }
  }

  const currentDetails = scan ? getVerdictDetails(scan) : null;
  const checkerState = emptyAttempt
    ? 'state-empty'
    : currentDetails
    ? currentDetails.toneClass
    : 'state-default';

  return (
    <main className="dashboard">
      <div className="dash-head">
        <div>
          <span className="eyebrow">AI-Powered Fact-Checking Workspace</span>
          <h1>Good morning, {user?.name?.split(' ')[0] || 'reader'}.</h1>
          <p>Paste any news headline, complete article, or link to verify its credibility.</p>
        </div>
        {user ? (
          <button className="outline-btn" onClick={onLogout}>Sign out</button>
        ) : (
          <Link className="outline-btn" to="/login">Sign in to sync</Link>
        )}
      </div>

      <div className="dash-layout">
        <section className={`checker ${checkerState}`}>
          <div className="checker-head">
            <div>
              <span className="eyebrow">New Credibility Verification</span>
              <h2>Verify news claim.</h2>
            </div>
            <div className="checker-actions">
              <span className="secure"><ShieldCheck size={15} /> Private & secure analysis</span>
              {scan && <SoundToggle />}
            </div>
          </div>

          <div className="type-tabs">
            {[
              ['headline', 'Headline'],
              ['article', 'Article'],
              ['url', 'URL']
            ].map(([value, label]) => (
              <button
                type="button"
                className={type === value ? 'active' : ''}
                onClick={() => {
                  setType(value);
                  setError('');
                }}
                key={value}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={check}>
            <label className="language-picker">
              <span>Analysis language:</span>
              <select value={language} onChange={e => setLanguage(e.target.value)}>
                {languageOptions.map(([val, name]) => (
                  <option value={val} key={val}>{name}</option>
                ))}
              </select>
            </label>

            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                setEmptyAttempt(false);
                if (!e.target.value.trim()) setError('');
              }}
              placeholder={
                type === 'headline'
                  ? 'Enter or paste a news headline (e.g. "NASA discovers signs of water on Mars surface")...'
                  : type === 'article'
                  ? 'Paste the complete news article text here (English, Telugu, Hindi, Tamil, etc.)...'
                  : 'Paste a news webpage URL (e.g. https://www.bbc.com/news/...)'
              }
            />

            {emptyAttempt && (
              <div className="empty-message">
                <AlertTriangle size={16} /> Please enter a headline, article, or URL to verify.
              </div>
            )}

            {loading && (
              <div className="loading-box">
                <span className="loading-pulse" />
                <span>{loadingStage}</span>
              </div>
            )}

            <div className="form-bottom">
              <span>{input.length}/12,000</span>
              <button className="primary-btn" disabled={loading}>
                {loading ? 'Verifying...' : <><Sparkles size={16} /> Verify credibility</>}
              </button>
            </div>
          </form>

          {error && !emptyAttempt && <div className="error">{error}</div>}

          {scan && !emptyAttempt && <Result scan={scan} />}
        </section>

        <aside className="history-panel">
          <div className="panel-head">
            <span><Clock3 size={16} /> Recent checks</span>
            <span className="badge-count">{history.length}</span>
          </div>

          {history.length ? (
            <div className="history-list">
              {history.slice(0, 10).map((item) => {
                const itemDetails = getVerdictDetails(item);
                const itemDate = item.verifiedAt || item.createdAt
                  ? new Date(item.verifiedAt || item.createdAt).toLocaleDateString()
                  : '';
                return (
                  <button
                    className="history-item-card"
                    key={item._id || item.input}
                    onClick={() => {
                      setScan(item);
                      setInput(item.input);
                      setType(item.sourceType || 'headline');
                    }}
                  >
                    <div className="history-item-top">
                      <span className={`mini-verdict-badge ${itemDetails.type}`}>
                        {itemDetails.icon} {item.displayVerdict?.split('/')[0]?.trim() || itemDetails.label.split('/')[0]?.trim()}
                      </span>
                      <span className="history-confidence">{item.confidence || 50}%</span>
                    </div>
                    <p className="history-headline">
                      {(item.claim || item.input).slice(0, 75)}
                      {(item.claim || item.input).length > 75 ? '...' : ''}
                    </p>
                    <small className="history-date">{itemDate}</small>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-history">
              <History size={26} />
              <p>Your checked stories will appear here.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function Result({ scan }) {
  const details = getVerdictDetails(scan);

  const verifiedDate = scan.verifiedAt
    ? new Date(scan.verifiedAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    : new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

  const sources = Array.isArray(scan.sources) ? scan.sources : [];
  const supporting = Array.isArray(scan.supportingEvidence) ? scan.supportingEvidence : [];
  const contradicting = Array.isArray(scan.contradictingEvidence) ? scan.contradictingEvidence : [];
  const keyClaims = Array.isArray(scan.keyClaims) ? scan.keyClaims : [];

  return (
    <motion.div
      className={`result-card-v2 ${details.toneClass}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-header-bar">
        <span className="card-badge">FACTX VERIFICATION</span>
        <span className="currentness-tag">
          {scan.currentness === 'Current' ? '✓ Current' : scan.currentness === 'Outdated' ? '⚠️ Outdated' : 'Status: ' + (scan.currentness || 'Unknown')}
        </span>
      </div>

      <div className="verdict-banner">
        <div className="verdict-left">
          <span className="verdict-emoji">{details.icon}</span>
          <div>
            <small className="verdict-prefix">VERDICT</small>
            <h3 className="verdict-title">{details.label}</h3>
          </div>
        </div>
        <div className="confidence-box">
          <strong>{scan.confidence || 50}%</strong>
          <small>Confidence</small>
        </div>
      </div>

      <div className="confidence-meter-track">
        <div
          className="confidence-meter-fill"
          style={{ width: `${scan.confidence || 50}%`, backgroundColor: details.accentColor }}
        />
      </div>

      {scan.dateWarning && (
        <div className="alert-banner warning-date">
          <AlertTriangle size={18} />
          <div>
            <strong>Date Warning:</strong> {scan.dateWarning}
          </div>
        </div>
      )}

      {scan.conflictingReports && (
        <div className="alert-banner warning-conflict">
          <AlertCircle size={18} />
          <div>
            <strong>Conflicting reports found:</strong>{' '}
            {scan.conflictingDetails || 'Reputable sources report conflicting accounts on this claim.'}
          </div>
        </div>
      )}

      <div className="result-block">
        <span className="section-label">Claim:</span>
        <p className="claim-quote">“{scan.claim || scan.input}”</p>
      </div>

      <div className="result-block">
        <span className="section-label">Why this result?:</span>
        <p className="explanation-text">{scan.reasoningSummary || scan.explanation}</p>
      </div>

      {scan.summary && (
        <div className="result-block summary-block">
          <span className="section-label">AI Reasoning Summary:</span>
          <p className="summary-text">{scan.summary}</p>
        </div>
      )}

      {keyClaims.length > 0 && (
        <div className="result-block">
          <span className="section-label">Key Claims Detected:</span>
          <ul className="key-claims-list">
            {keyClaims.map((kc, idx) => (
              <li key={idx}>• {kc}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="evidence-grid">
        <div className="evidence-col support-col">
          <span className="col-heading"><Check size={15} /> Supporting evidence</span>
          {supporting.length > 0 ? (
            <ul>
              {supporting.map((item, idx) => (
                <li key={idx}><span className="check-mark">✓</span> {item}</li>
              ))}
            </ul>
          ) : (
            <p className="muted-italic">No direct supporting evidence was retrieved.</p>
          )}
        </div>

        <div className="evidence-col against-col">
          <span className="col-heading"><X size={15} /> Contradicting evidence</span>
          {contradicting.length > 0 ? (
            <ul>
              {contradicting.map((item, idx) => (
                <li key={idx}><span className="cross-mark">✕</span> {item}</li>
              ))}
            </ul>
          ) : (
            <p className="muted-italic">No contradicting evidence was retrieved.</p>
          )}
        </div>
      </div>

      <div className="result-block sources-block">
        <span className="section-label">Reliable Sources Checked:</span>
        {sources.length > 0 ? (
          <div className="sources-list-v2">
            {sources.map((source, index) => (
              <div className="source-row" key={`${source.url}-${index}`}>
                <div className="source-num">{index + 1}.</div>
                <div className="source-details">
                  <strong className="source-title">{source.name || source.domain || 'Source'}</strong>
                  {source.title && source.title !== source.name && (
                    <span className="source-headline">{source.title}</span>
                  )}
                  <div className="source-meta-row">
                    {source.published && <small className="source-date">Published: {source.published}</small>}
                    {source.url && (
                      <a href={source.url} target="_blank" rel="noopener noreferrer" className="source-link">
                        Link: {source.domain || 'View source'} <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="insufficient-sources-box">
            <Info size={16} />
            <span>Insufficient reliable evidence. FactX cannot confidently determine the claim from recent live sources.</span>
          </div>
        )}
      </div>

      {scan.signals && scan.signals.length > 0 && (
        <div className="signals-tag-row">
          {scan.signals.map((sig, i) => (
            <span className="signal-pill" key={i}>
              <Check size={12} /> {sig}
            </span>
          ))}
        </div>
      )}

      <div className="card-footer-meta">
        <span>Verified on: <strong>{verifiedDate}</strong></span>
        {scan.language && <span className="lang-tag">Language: {scan.language.toUpperCase()}</span>}
      </div>
    </motion.div>
  );
}

function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('veritas_user') || 'null'));
  const [theme, setTheme] = useState(localStorage.getItem('veritas_theme') || 'light');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('veritas_theme', theme);
  }, [theme]);

  function auth(u) {
    localStorage.setItem('veritas_user', JSON.stringify(u));
    setUser(u);
  }

  function logout() {
    localStorage.removeItem('veritas_user');
    localStorage.removeItem('veritas_token');
    setUser(null);
  }

  return (
    <>
      <Header user={user} theme={theme} setTheme={setTheme} />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Auth onAuth={auth} />} />
        <Route path="/register" element={<Auth register onAuth={auth} />} />
        <Route path="/dashboard" element={<Dashboard user={user} onLogout={logout} />} />
      </Routes>
    </>
  );
}

export default App;

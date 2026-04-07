import { useEffect, useState, useRef } from 'react';
import { useAccounts } from '../contexts/AccountContext';
import { api } from '../lib/api';
import { Mic, Sparkles, Trash2, ChevronDown, ChevronUp, Copy, Check, Wifi, WifiOff } from 'lucide-react';

const WHISPER_URL = 'http://localhost:5001';

export default function Scripts() {
  const { activeAccount } = useAccounts();
  const [tab, setTab] = useState('mine'); // 'mine' | 'competitors' | 'generate'
  const [myPosts, setMyPosts] = useState([]);
  const [competitors, setCompetitors] = useState([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState(null);
  const [competitorPosts, setCompetitorPosts] = useState([]);
  const [generatedScripts, setGeneratedScripts] = useState([]);
  const [whisperOnline, setWhisperOnline] = useState(false);
  const [transcribing, setTranscribing] = useState({}); // { [postId]: true }
  const [expanded, setExpanded] = useState(null);
  const [topic, setTopic] = useState('');
  const [generating, setGenerating] = useState(false);
  const [latestScript, setLatestScript] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkWhisper();
    const interval = setInterval(checkWhisper, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeAccount) return;
    fetchMyPosts();
    fetchCompetitors();
    fetchGeneratedScripts();
  }, [activeAccount?.id]);

  useEffect(() => {
    if (selectedCompetitor) fetchCompetitorPosts(selectedCompetitor);
  }, [selectedCompetitor]);

  async function checkWhisper() {
    try {
      const res = await fetch(`${WHISPER_URL}/health`, { signal: AbortSignal.timeout(2000) });
      setWhisperOnline(res.ok);
    } catch {
      setWhisperOnline(false);
    }
  }

  async function fetchMyPosts() {
    setLoading(true);
    try {
      const data = await api.getScriptPosts(activeAccount.id);
      setMyPosts(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function fetchCompetitors() {
    try {
      const data = await api.getScriptCompetitors(activeAccount.id);
      setCompetitors(data);
      if (data.length && !selectedCompetitor) setSelectedCompetitor(data[0].id);
    } catch (e) { console.error(e); }
  }

  async function fetchCompetitorPosts(competitorId) {
    try {
      const data = await api.getCompetitorScriptPosts(competitorId);
      setCompetitorPosts(data);
    } catch (e) { console.error(e); }
  }

  async function fetchGeneratedScripts() {
    try {
      const data = await api.getGeneratedScripts(activeAccount.id);
      setGeneratedScripts(data);
    } catch (e) { console.error(e); }
  }

  async function handleTranscribe(post) {
    if (!whisperOnline) {
      alert('Whisper server is offline. Run: cd whisper-server && python whisper_server.py');
      return;
    }
    if (!post.post_url) {
      alert('No video URL available for this post.');
      return;
    }

    setTranscribing(t => ({ ...t, [post.id]: true }));
    try {
      const res = await fetch(`${WHISPER_URL}/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: post.post_url,
          post_id: post.id,
          type: post.type,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Refresh the post list to show the new transcript
      if (tab === 'mine') await fetchMyPosts();
      else await fetchCompetitorPosts(selectedCompetitor);
      setExpanded(post.id);
    } catch (err) {
      alert(`Transcription failed: ${err.message}`);
    }
    setTranscribing(t => { const c = { ...t }; delete c[post.id]; return c; });
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!topic.trim()) return;
    setGenerating(true);
    try {
      const result = await api.generateScript(activeAccount.id, topic, selectedCompetitor);
      setLatestScript(result.script);
      setTab('generate');
      await fetchGeneratedScripts();
    } catch (err) {
      alert(err.message);
    }
    setGenerating(false);
  }

  async function handleDeleteScript(id) {
    await api.deleteGeneratedScript(id).catch(console.error);
    setGeneratedScripts(s => s.filter(x => x.id !== id));
  }

  function handleCopy(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const postsToShow = tab === 'mine' ? myPosts : competitorPosts;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Script Intelligence</h1>
          <p className="text-gray-500 text-sm mt-0.5">Transcribe videos, extract hooks, generate scripts in your voice</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium ${whisperOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {whisperOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          {whisperOnline ? 'Whisper Online' : 'Whisper Offline'}
        </div>
      </div>

      {!whisperOnline && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 text-yellow-300 text-sm">
          Whisper server is not running. To transcribe videos, open a terminal and run:
          <code className="block mt-2 bg-dark-900 rounded-lg px-3 py-2 text-yellow-200 font-mono text-xs">
            cd whisper-server && python whisper_server.py
          </code>
          You can still view existing transcripts and generate scripts without it.
        </div>
      )}

      {/* Quick Script Generator */}
      <div className="bg-dark-800 border border-dark-600 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-accent" />
          <h2 className="text-white font-semibold">Generate a Script</h2>
        </div>
        <form onSubmit={handleGenerate} className="flex gap-3">
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Topic or idea (e.g. 'live painting a portrait commission')"
            className="flex-1 bg-dark-700 border border-dark-500 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-accent"
          />
          {competitors.length > 0 && (
            <select
              value={selectedCompetitor || ''}
              onChange={e => setSelectedCompetitor(e.target.value || null)}
              className="bg-dark-700 border border-dark-500 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-accent"
            >
              <option value="">No competitor style</option>
              {competitors.map(c => (
                <option key={c.id} value={c.id}>Borrow @{c.handle}'s hooks</option>
              ))}
            </select>
          )}
          <button
            type="submit"
            disabled={generating || !topic.trim()}
            className="bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-xl text-sm disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {generating ? 'Writing...' : 'Generate'}
          </button>
        </form>
      </div>

      {/* Latest generated script */}
      {latestScript && (
        <div className="bg-dark-800 border border-accent/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-accent text-sm font-semibold">Generated Script</span>
            <button
              onClick={() => handleCopy(latestScript)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">{latestScript}</pre>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-dark-800 border border-dark-600 rounded-2xl p-1 w-fit">
        {[
          { id: 'mine', label: 'My Posts' },
          { id: 'competitors', label: 'Competitor Posts' },
          { id: 'generate', label: 'Saved Scripts' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm transition-colors ${
              tab === t.id ? 'bg-accent text-white font-medium' : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Competitor selector */}
      {tab === 'competitors' && competitors.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {competitors.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCompetitor(c.id)}
              className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                selectedCompetitor === c.id
                  ? 'bg-accent text-white'
                  : 'bg-dark-700 text-gray-400 hover:text-white'
              }`}
            >
              @{c.handle}
            </button>
          ))}
        </div>
      )}

      {/* Posts list */}
      {(tab === 'mine' || tab === 'competitors') && (
        <div className="space-y-3">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="bg-dark-800 border border-dark-600 rounded-2xl h-20 animate-pulse" />
            ))
          ) : postsToShow.length === 0 ? (
            <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 text-center text-gray-500">
              {tab === 'mine' ? 'No posts found. Scrape your account first.' : 'No posts found. Scrape this competitor first.'}
            </div>
          ) : (
            postsToShow.map(post => (
              <div key={post.id} className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                  {post.thumbnail_url && (
                    <img
                      src={post.thumbnail_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 bg-dark-600"
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-300 text-sm line-clamp-1">{post.caption || '(no caption)'}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{parseFloat(post.engagement_rate || 0).toFixed(2)}% eng</span>
                      {post.script_id ? (
                        <span className="text-green-400 font-medium">✓ Transcribed — {post.hook_type}</span>
                      ) : (
                        <span className="text-gray-600">Not transcribed</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleTranscribe(post)}
                      disabled={!!transcribing[post.id] || !whisperOnline}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-colors disabled:opacity-40 ${
                        post.script_id
                          ? 'bg-dark-700 text-gray-400 hover:text-white'
                          : 'bg-accent/20 text-accent hover:bg-accent/30'
                      }`}
                    >
                      <Mic size={12} className={transcribing[post.id] ? 'animate-pulse' : ''} />
                      {transcribing[post.id] ? 'Transcribing...' : post.script_id ? 'Re-transcribe' : 'Transcribe'}
                    </button>
                    {post.script_id && (
                      <button
                        onClick={() => setExpanded(expanded === post.id ? null : post.id)}
                        className="p-1.5 text-gray-500 hover:text-white hover:bg-dark-600 rounded-xl transition-colors"
                      >
                        {expanded === post.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded transcript / analysis */}
                {expanded === post.id && post.script_id && (
                  <div className="border-t border-dark-600 p-4 space-y-4">
                    {/* Duration badge */}
                    {post.duration_seconds > 0 && (
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-lg font-medium ${post.content_format === 'long' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                          {post.content_format === 'long' ? 'Long-form' : 'Short-form'} · {Math.floor(post.duration_seconds / 60)}:{String(post.duration_seconds % 60).padStart(2, '0')}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Hook Type', value: post.hook_type },
                        { label: 'Tone', value: post.tone },
                        { label: 'CTA', value: post.cta },
                        { label: 'Body', value: post.body_structure },
                      ].map(({ label, value }) => value && (
                        <div key={label} className="bg-dark-700 rounded-xl p-3">
                          <p className="text-gray-500 text-xs mb-1">{label}</p>
                          <p className="text-gray-300 text-xs">{value}</p>
                        </div>
                      ))}
                    </div>

                    {post.hook && (
                      <div className="bg-dark-700 rounded-xl p-3">
                        <p className="text-gray-500 text-xs mb-1">Hook</p>
                        <p className="text-white text-sm font-medium">"{post.hook}"</p>
                      </div>
                    )}

                    {/* Long-form sections breakdown */}
                    {post.content_format === 'long' && post.sections && (() => {
                      const sections = Array.isArray(post.sections) ? post.sections : JSON.parse(post.sections || '[]');
                      return sections.length > 0 ? (
                        <div>
                          <p className="text-gray-500 text-xs mb-2">Section Breakdown</p>
                          <div className="space-y-2">
                            {sections.map((s, i) => (
                              <div key={i} className="flex gap-3 bg-dark-700 rounded-xl p-3">
                                <span className="text-accent text-xs font-mono flex-shrink-0 mt-0.5">{s.timestamp}</span>
                                <div>
                                  <p className="text-white text-xs font-medium">{s.title}</p>
                                  <p className="text-gray-400 text-xs mt-0.5">{s.summary}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {post.key_phrases && (
                      <div className="flex flex-wrap gap-2">
                        {(Array.isArray(post.key_phrases) ? post.key_phrases : JSON.parse(post.key_phrases || '[]')).map((phrase, i) => (
                          <span key={i} className="bg-dark-700 text-gray-300 text-xs px-3 py-1 rounded-lg">{phrase}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Saved generated scripts */}
      {tab === 'generate' && (
        <div className="space-y-3">
          {generatedScripts.length === 0 ? (
            <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8 text-center text-gray-500">
              No saved scripts yet. Use the generator above.
            </div>
          ) : (
            generatedScripts.map(s => (
              <div key={s.id} className="bg-dark-800 border border-dark-600 rounded-2xl overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">{s.topic}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {new Date(s.created_at).toLocaleDateString()}
                      {s.competitor_handle && ` · Inspired by @${s.competitor_handle}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(s.full_script)}
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-dark-600 rounded-xl transition-colors"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-dark-600 rounded-xl transition-colors"
                    >
                      {expanded === s.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                      onClick={() => handleDeleteScript(s.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-dark-600 rounded-xl transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {expanded === s.id && (
                  <div className="border-t border-dark-600 p-4">
                    <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans leading-relaxed">{s.full_script}</pre>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Reads the champions off a picture of champion select, the loading screen or the scoreboard, using Claude.
// The call goes through Vercel AI Gateway (so the site needs no Anthropic key of its own) with the official Anthropic SDK.
import Anthropic from '@anthropic-ai/sdk';

// Claude models as Vercel AI Gateway names them, best first. The gateway only serves some models to a team that has not
// bought credit, so a model it will not serve (403) is skipped; the one that answered is remembered while the function is warm.
export const MODELS = ['anthropic/claude-opus-5.5', 'anthropic/claude-sonnet-5.5', 'anthropic/claude-haiku-5.5'];
let first = 0;
export const LANES = ['top', 'jungle', 'mid', 'bot', 'support'];
const MEDIA = ['image/jpeg', 'image/png', 'image/webp'];

const lane = { type: 'string', enum: [...LANES, 'unknown'] };
export const SCHEMA = {
  type: 'object',
  properties: {
    screen: { type: 'string', enum: ['champion_select', 'loading_screen', 'scoreboard', 'other'] },
    allies: { type: 'array', items: { type: 'object', properties: { champion: { type: 'string' }, lane, is_player: { type: 'boolean' } }, required: ['champion', 'lane', 'is_player'], additionalProperties: false } },
    enemies: { type: 'array', items: { type: 'object', properties: { champion: { type: 'string' }, lane }, required: ['champion', 'lane'], additionalProperties: false } },
    note: { type: 'string' },
  },
  required: ['screen', 'allies', 'enemies', 'note'],
  additionalProperties: false,
};

const instructions = (riotName, role) => `You read League of Legends pictures for a coaching tool: a screenshot, or a phone photo of a monitor, showing champion select, the loading screen or the in-game scoreboard. List the champions on each team so the tool can fill in its team sheet.

The person using the tool plays as "${riotName}" and is usually the ${role}. Their team is "allies"; the other team is "enemies".
- Champion select: the player's team is the column on the left, the enemy team is on the right.
- Loading screen and scoreboard: find the team that has the player's name. If you cannot read the names, treat the first team shown (top or left) as allies and say so in note.

For each champion give:
- champion: the official English name, for example "Nunu & Willump", "Kha'Zix", "Wukong", "Dr. Mundo", "Miss Fortune".
- lane: top, jungle, mid, bot (the ADC) or support. On the loading screen and scoreboard each team is listed in that order, so use the order when all five are there, and check it against who has Smite. In champion select the player's team shows its assigned positions when the queue has them; the enemy column is in pick order, not lane order, so place enemies by what each champion normally plays. Use "unknown" only when you cannot make a sensible call.
- is_player (allies only): true for the one champion that is the player's own pick, when you can tell from the highlighted slot or the name. Otherwise false for all of them.

Only list champions that are actually shown. Leave out empty slots, bans, and slots that are still picking. Never fill in a champion you cannot see. A team can have fewer than five.

note: one short plain sentence for the player if something was unreadable or guessed. Otherwise an empty string.
If the picture is not one of these screens, answer with screen "other" and empty lists.`;

/** A client for Vercel AI Gateway. `token` is the deployment's OIDC token or an AI Gateway key. */
export const gateway = (token) => new Anthropic({ apiKey: token, baseURL: 'https://ai-gateway.vercel.sh', timeout: 25_000, maxRetries: 1 });

const fail = (status, message) => Object.assign(new Error(message), { status });

/** The picture-reading models the gateway will serve to this team right now, from its own catalogue: [{ id, tags }]. */
export async function servable(token) {
  const res = await fetch('https://ai-gateway.vercel.sh/v1/models?include_availability', { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw fail(502, 'The model list could not be read (' + res.status + ').');
  const { data = [] } = await res.json();
  const sees = (m) => (m.tags || []).includes('vision') || ((m.modalities || {}).input || []).includes('image');
  return data.filter((m) => m.type === 'language' && m.model_eligibility && m.model_eligibility.status === 'eligible' && sees(m)).map((m) => ({ id: m.id, tags: m.tags || [] }));
}

/** image: base64 without the data: prefix. Returns { screen, allies: [{ champion, lane, is_player }], enemies: [{ champion, lane }], note }. */
export async function readTeams(client, { image, mediaType = 'image/jpeg', riotName = 'the player', role = 'jungle' }) {
  if (typeof image !== 'string' || image.length < 200) throw fail(400, 'No picture was sent.');
  if (image.length > 4_200_000) throw fail(413, 'That picture is too large. Try a smaller one.');
  if (!MEDIA.includes(mediaType)) throw fail(400, 'That kind of picture is not supported. Use a JPEG or PNG.');
  const params = {
    max_tokens: 4000,
    system: instructions(String(riotName).slice(0, 40), role === 'support' ? 'support' : 'jungler'),
    // low effort: this is reading names off a picture, and champion select does not wait
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
      { type: 'text', text: 'List the champions in this picture.' },
    ] }],
  };
  // The same request three ways, fullest first; a 400 means the gateway or the model does not take that form.
  const forms = [
    // if the model declines, let the API hand the request to another Claude model instead of stopping
    (p) => client.beta.messages.create({ ...p, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' }),
    (p) => client.messages.create(p),
    (p) => client.messages.create({ ...p, output_config: { format: p.output_config.format } }),
  ];
  let res, last;
  for (let m = first; m < MODELS.length && !res; m++) {
    for (const form of forms) {
      try { res = await form({ ...params, model: MODELS[m] }); first = m; break; } catch (e) {
        last = e;
        if (e instanceof Anthropic.PermissionDeniedError) { console.warn('teams:', MODELS[m], 'is not served to this team:', String(e.message || '').slice(0, 1500)); break; }   // try the next model
        if (!(e instanceof Anthropic.BadRequestError)) throw e;
      }
    }
    if (!res && !(last instanceof Anthropic.PermissionDeniedError)) break;
  }
  if (!res) throw last;
  if (res.stop_reason === 'refusal') throw fail(422, 'Claude would not read that picture. Try another one.');
  const text = (res.content.find((b) => b.type === 'text') || {}).text;
  let out;
  try { out = JSON.parse(text); } catch (e) { throw fail(502, 'The picture could not be read. Try again.'); }
  const tidy = (list, withPlayer) => (Array.isArray(list) ? list : []).slice(0, 5)
    .map((p) => ({ champion: String(p.champion || '').trim().slice(0, 40), lane: LANES.includes(p.lane) ? p.lane : 'unknown', ...(withPlayer ? { is_player: !!p.is_player } : {}) }))
    .filter((p) => p.champion);
  return { screen: out.screen || 'other', allies: tidy(out.allies, true), enemies: tidy(out.enemies, false), note: String(out.note || '').slice(0, 240), model: String(res.model || '').replace(/^anthropic\//, ''), fallback: !!(res.usage && (res.usage.iterations || []).some((i) => i.type === 'fallback_message')) };
}

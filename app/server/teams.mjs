// Reads the champions off a picture of champion select, the loading screen or the scoreboard.
// The call goes through Vercel AI Gateway (so the site needs no model key of its own) with the official Anthropic SDK.
import Anthropic from '@anthropic-ai/sdk';

// Models as Vercel AI Gateway names them, in the order they are tried. Claude reads the picture when the gateway will
// serve it, which needs bought AI Gateway credit: a team on the gateway's free tier is refused every Claude model (403).
// The models after it are ones the free tier does serve (scripts/check-teams.mjs prints which one answered).
export const CLAUDE = 'anthropic/claude-opus-5.5';
export const FREE = ['openai/gpt-5.2', 'google/gemini-2.5-flash'];
export const MODELS = [CLAUDE, ...FREE];
export const MODEL_NAME = { [CLAUDE]: 'Claude Opus 5.5', 'openai/gpt-5.2': 'GPT-5.2', 'google/gemini-2.5-flash': 'Gemini 2.5 Flash' };

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
If the picture is not one of these screens, answer with screen "other" and empty lists.

Answer with one JSON object and nothing else, in this shape:
{"screen": "champion_select" | "loading_screen" | "scoreboard" | "other", "allies": [{"champion": "...", "lane": "top" | "jungle" | "mid" | "bot" | "support" | "unknown", "is_player": true | false}], "enemies": [{"champion": "...", "lane": "..."}], "note": "..."}`;

/** A client for Vercel AI Gateway. `token` is the deployment's OIDC token or an AI Gateway key.
    One try per call and a short limit: the function behind it has 30 seconds in all. */
export const gateway = (token) => new Anthropic({ apiKey: token, baseURL: 'https://ai-gateway.vercel.sh', timeout: 20_000, maxRetries: 0 });

const fail = (status, message) => Object.assign(new Error(message), { status });

/* The same request in several forms, fullest first. A 400 means the gateway or the model does not take that form. */
const forms = (client, model) => [
  // Claude only: if the model declines, let the API hand the request to another Claude model instead of stopping
  ...(model === CLAUDE ? [(p) => client.beta.messages.create({ ...p, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })] : []),
  (p) => client.messages.create(p),
  (p) => client.messages.create({ ...p, output_config: { format: p.output_config.format } }),
  (p) => { const { output_config, ...rest } = p; return client.messages.create(rest); },   // the instructions alone ask for JSON
];

/* The JSON object in a reply, with or without a code fence or a sentence around it. */
function parse(text) {
  const s = String(text || ''), a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; }
}

/** image: base64 without the data: prefix. `log` is told about each model or form that was passed over.
    Returns { screen, allies: [{ champion, lane, is_player }], enemies: [{ champion, lane }], note, model, reader }. */
export async function readTeams(client, { image, mediaType = 'image/jpeg', riotName = 'the player', role = 'jungle', log = () => {} }) {
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
  let res, out, last, asked;
  for (const model of MODELS) {
    const list = forms(client, model);
    for (let f = 0; f < list.length && !out; f++) {
      try { res = await list[f]({ ...params, model }); } catch (e) {
        last = e;
        log(`${model} form ${f + 1}: ${e.status || ''} ${String(e.message || '').slice(0, 220)}`);
        // 403: not served to this team. 404: the gateway no longer has that model. Either way, the next model.
        if (e instanceof Anthropic.PermissionDeniedError || e instanceof Anthropic.NotFoundError) break;
        if (e instanceof Anthropic.BadRequestError) continue;
        throw e;
      }
      if (res.stop_reason === 'refusal') throw fail(422, 'That picture could not be read. Try another one.');
      out = parse((res.content.find((b) => b.type === 'text') || {}).text);
      if (!out) { last = fail(502, 'The picture could not be read. Try again.'); log(`${model} form ${f + 1}: the answer was not JSON (${res.stop_reason})`); break; }   // asking the same model again will not help
    }
    if (out) { asked = model; break; }
  }
  if (!out) throw last;
  const tidy = (list, withPlayer) => (Array.isArray(list) ? list : []).slice(0, 5)
    .map((p) => ({ champion: String((p && p.champion) || '').trim().slice(0, 40), lane: LANES.includes(p && p.lane) ? p.lane : 'unknown', ...(withPlayer ? { is_player: !!(p && p.is_player) } : {}) }))
    .filter((p) => p.champion);
  return {
    screen: ['champion_select', 'loading_screen', 'scoreboard'].includes(out.screen) ? out.screen : 'other',
    allies: tidy(out.allies, true), enemies: tidy(out.enemies, false), note: String(out.note || '').slice(0, 240),
    model: asked, reader: MODEL_NAME[asked] || asked,
    fallback: !!(res.usage && (res.usage.iterations || []).some((i) => i.type === 'fallback_message')),
  };
}

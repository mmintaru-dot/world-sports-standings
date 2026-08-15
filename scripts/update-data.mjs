import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = path.join(root, 'data');
const footballKey = process.env.FOOTBALL_API_KEY;
const debug = process.env.DEBUG === 'true';
const footballLeagues = { j1:98, 'premier-league':39, laliga:140, seriea:135, bundesliga:78, ligue1:61, mls:253 };

function log(details) { if (debug) console.log(`[standings] ${JSON.stringify(details)}`); }
function fileFor(id) { return path.join(dataDir, `${id}.json`); }
function readExisting(id) { try { return JSON.parse(fs.readFileSync(fileFor(id), 'utf8')); } catch { return null; } }
function write(id, value) { fs.writeFileSync(fileFor(id), `${JSON.stringify(value, null, 2)}\n`); }
function isValidFootball(payload) { return Array.isArray(payload.teams) && payload.teams.length > 0 && payload.teams.every(t => Number.isInteger(t.rank) && t.rank > 0 && typeof t.name === 'string' && t.name.trim() && Number.isFinite(t.played) && Number.isFinite(t.points)); }
function isValidBaseball(payload) { return Array.isArray(payload.teams) && payload.teams.length > 0 && payload.teams.every(t => Number.isInteger(t.rank) && t.rank > 0 && typeof t.name === 'string' && t.name.trim() && Number.isFinite(t.played) && Number.isFinite(t.won) && Number.isFinite(t.lost)); }

function recordFailure(id, source, error) {
  const previous = readExisting(id);
  const message = error.code === 'MISSING_KEY' ? 'APIキーが設定されていません。GitHub SecretsにFOOTBALL_API_KEYを登録してください。' : '最新順位を取得できませんでした';
  if (previous?.status === 'ok' && previous?.source === source && previous.teams?.length) {
    write(id, { ...previous, stale:true, lastAttemptAt:new Date().toISOString(), error:message });
  } else {
    write(id, { status:'error', source, updatedAt:null, lastAttemptAt:new Date().toISOString(), error:message, teams:[] });
  }
  log({ api:source, success:false, league:id, error:error.message });
}

async function apiFootball(endpoint) {
  if (!footballKey) { const error = new Error('FOOTBALL_API_KEY is not set'); error.code = 'MISSING_KEY'; throw error; }
  const response = await fetch(`https://v3.football.api-sports.io${endpoint}`, { headers:{'x-apisports-key':footballKey} });
  const json = await response.json();
  if (!response.ok || json.errors && Object.keys(json.errors).length) throw new Error(`API-FOOTBALL request failed (${response.status}): ${JSON.stringify(json.errors)}`);
  return json;
}

async function updateFootball(id, leagueId) {
  const leagueJson = await apiFootball(`/leagues?id=${leagueId}&current=true`);
  const leagueInfo = leagueJson.response?.[0];
  const currentSeason = leagueInfo?.seasons?.find(s => s.current);
  if (!leagueInfo || !currentSeason || !Number.isInteger(currentSeason.year)) throw new Error('API did not return a current season');
  const standingsJson = await apiFootball(`/standings?league=${leagueId}&season=${currentSeason.year}`);
  const apiLeague = standingsJson.response?.[0]?.league;
  const rows = apiLeague?.standings?.flat() || [];
  const previous = readExisting(id);
  const oldRanks = new Map((previous?.status === 'ok' ? previous.teams : []).map(t => [t.apiTeamId, t.rank]));
  const payload = {
    status:'ok', source:'API-FOOTBALL', apiLeagueId:leagueId,
    leagueName:apiLeague?.name || leagueInfo.league.name, country:apiLeague?.country || leagueInfo.country.name,
    season:apiLeague?.season ?? currentSeason.year, seasonStart:currentSeason.start, seasonEnd:currentSeason.end,
    updatedAt:new Date().toISOString(), stale:false,
    teams:rows.map(row => ({ rank:row.rank, apiTeamId:row.team.id, name:row.team.name, logo:row.team.logo, played:row.all.played, won:row.all.win, draw:row.all.draw, lost:row.all.lose, gf:row.all.goals.for, ga:row.all.goals.against, gd:row.goalsDiff, points:row.points, movement:oldRanks.has(row.team.id) ? oldRanks.get(row.team.id)-row.rank : 0, description:row.description || null, group:row.group || null }))
  };
  if (!isValidFootball(payload)) throw new Error('API returned invalid standings data');
  write(id, payload);
  log({ api:payload.source, success:true, leagueId, season:payload.season, teams:payload.teams.length });
}

async function updateMlb() {
  const seasonResponse = await fetch('https://statsapi.mlb.com/api/v1/seasons?sportId=1');
  if (!seasonResponse.ok) throw new Error(`MLB seasons request failed (${seasonResponse.status})`);
  const seasonJson = await seasonResponse.json();
  const currentSeason = seasonJson.seasons?.[0]?.seasonId;
  if (!currentSeason) throw new Error('MLB API did not return a current season');
  const response = await fetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${encodeURIComponent(currentSeason)}&standingsTypes=regularSeason&hydrate=team`);
  if (!response.ok) throw new Error(`MLB Stats API request failed (${response.status})`);
  const json = await response.json();
  const records = json.records || [], teams=[];
  for (const record of records) record.teamRecords.forEach((team,index) => teams.push({ rank:Number(team.divisionRank)||index+1, apiTeamId:team.team.id, name:team.team.name, logo:`https://www.mlbstatic.com/team-logos/${team.team.id}.svg`, played:Number(team.gamesPlayed), won:Number(team.wins), lost:Number(team.losses), pct:team.winningPercentage, gb:team.gamesBack==='-'?'—':team.gamesBack, league:record.league?.name||'', division:record.division?.name||'' }));
  const payload = { status:'ok', source:'MLB Stats API', season:currentSeason, updatedAt:new Date().toISOString(), stale:false, teams };
  if (!payload.season || !isValidBaseball(payload)) throw new Error('MLB API returned invalid standings data');
  write('mlb', payload);
  log({ api:payload.source, success:true, season:payload.season, teams:payload.teams.length });
}

fs.mkdirSync(dataDir,{recursive:true});
for (const [id,leagueId] of Object.entries(footballLeagues)) { try { await updateFootball(id,leagueId); } catch(error) { recordFailure(id,'API-FOOTBALL',error); } }
try { await updateMlb(); } catch(error) { recordFailure('mlb','MLB Stats API',error); }

/**
 * In-memory room server for one room, speaking the Bruno Game v2 room-socket contract.
 *
 * It keeps an authoritative `Room` and a hidden board, answers the client's commands with
 * the same acks, errors and events the Gateway sends, and exposes methods that make other
 * (simulated) players act. Every outbound frame is typed with the real contract types from
 * `@shared/types`; there is no second event model.
 *
 * Rules it applies are the contract's own: every join is a spectator, a playing role is
 * claimed together with its team, one Spymaster per team, readiness reset on team/role
 * change, the start predicate, host-only settings and kicks, host transfer by `joined_at`,
 * the staffing pause and room shutdown during a match, and the post-game decision window
 * with independent Back to Lobby.
 */

import { ROOM_CAPACITY, ROOM_LANGUAGES, TURN_TIMER_OPTIONS } from '@shared/types';
import type {
  AckMessage,
  Card,
  CardColor,
  CountdownCancelReason,
  CurrentTurn,
  Game,
  GameTurnChangeReason,
  LastGame,
  MemberLeftReason,
  PlayingRole,
  RevealedCard,
  Room,
  RoomCommand,
  RoomMember,
  RoomServerEvent,
  Staffing,
  StaffingDeparture,
  Team,
  WsErrorCode,
  WsErrorMessage,
} from '@shared/types';

import type { MockEndpoint, MockServerBinding } from './mockTransport';
import { mockDirectory, mockRoomLifecycle } from './registry';

const WORDS = [
  'OCEAN',
  'ROBOT',
  'PIANO',
  'CASTLE',
  'EAGLE',
  'LASER',
  'MOON',
  'BRIDGE',
  'SHARK',
  'GLOVE',
  'TOWER',
  'COMET',
  'FOREST',
  'ENGINE',
  'CROWN',
  'MAPLE',
  'SPIDER',
  'VIOLIN',
  'DESERT',
  'ANCHOR',
  'PIRATE',
  'CANDLE',
  'GHOST',
  'NEEDLE',
  'WHALE',
];

export interface MockPlayer {
  user_id: number;
  username: string;
  avatar_url?: string;
}

/** Simulated players, using the same ids and names as the Bruno examples. */
export const MOCK_BOTS = {
  redAgent: { user_id: 43, username: 'red_agent' },
  blueMaster: { user_id: 44, username: 'blue_master' },
  blueAgent: { user_id: 45, username: 'blue_agent' },
  extraRed: { user_id: 46, username: 'extra_red' },
  lateJoiner: { user_id: 47, username: 'night_owl' },
} as const satisfies Record<string, MockPlayer>;

type MockErrorCode = WsErrorCode | 'ROOM_FULL' | 'ROOM_NOT_JOINABLE';

/** A rejected mock action, mirroring the WebSocket error envelope's `code`/`message`. */
export class MockActionError extends Error {
  readonly code: MockErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: MockErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'MockActionError';
    this.code = code;
    this.details = details;
  }
}

const TEAMS: Team[] = ['RED', 'BLUE'];
const other = (team: Team): Team => (team === 'RED' ? 'BLUE' : 'RED');
const key = (team: Team): 'red' | 'blue' => (team === 'RED' ? 'red' : 'blue');

/** Small seeded PRNG (mulberry32) so a room's board and starting team are reproducible. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
const now = (): string => new Date().toISOString();
const isoIn = (ms: number): string => new Date(Date.now() + ms).toISOString();

export class MockRoomServer implements MockServerBinding {
  readonly roomId: number;
  readonly roomCode: string;
  /** The member whose browser the mock socket stands in for. */
  readonly self: MockPlayer;

  private room: Room;
  /** The current or last game, kept for the members still on its result. */
  private game: Game | null = null;
  private lastGame: LastGame | null = null;
  /** True colors of every card, never sent to an Operative for unrevealed cards. */
  private hiddenColors: CardColor[] = [];
  /** The phase the game resumes once both teams are staffed again. */
  private pausedPhase: CurrentTurn['phase'] | null = null;
  private eventSeq = 0;
  private readonly endpoints = new Set<MockEndpoint>();
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  /** Running while `self` is away after a drop; ends in a removal. */
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private postGameTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly staffingTimers = new Map<Team, ReturnType<typeof setTimeout>>();
  /** Ends the active turn at its `deadline_at`; `null` with no turn limit. */
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  /** Turn time left when a pause stopped the clock, restored on resume. */
  private turnRemainingMs: number | null = null;
  /**
   * The contract's default timings. Lower them from the console to reach the end of a
   * grace period, a result's decision window or a staffing deadline sooner.
   */
  graceMs = { room: 30_000, game: 60_000 };
  postGameMs = 60_000;
  staffingMs = 120_000;
  private readonly random: () => number;

  /**
   * `initialMembers` seeds a room that other players already occupy (the first one is
   * host) and leaves `self` outside it until `playerJoin(self)`. Omitted, `self` creates
   * the room and hosts it.
   */
  constructor(
    roomId: number,
    self: MockPlayer,
    maxPlayers: number = ROOM_CAPACITY.default,
    initialMembers: MockPlayer[] = [self],
    roomCode = `R${String(roomId).padStart(5, '0').slice(-5)}`,
  ) {
    this.roomId = roomId;
    this.roomCode = roomCode;
    this.self = self;
    this.random = seededRandom(roomId);
    const createdAt = now();
    const host = initialMembers[0] ?? self;
    this.room = {
      room_id: roomId,
      room_code: roomCode,
      status: 'WAITING',
      host_user_id: host.user_id,
      player_count: initialMembers.length,
      max_players: maxPlayers,
      turn_timer_seconds: null,
      language: 'en',
      startable: false,
      players: initialMembers.map((p) => this.newMember(p, p.user_id === host.user_id, createdAt)),
      game: null,
      created_at: createdAt,
    };
  }

  /* ------------------------------ transport side ---------------------------- */

  onOpen(endpoint: MockEndpoint): void {
    this.endpoints.add(endpoint);
    this.stopGraceTimer();
    // The Gateway sends the recipient's snapshot on every (re)connect.
    endpoint.deliver(this.envelope('room.state', { room: this.projectRoom() }));
  }

  /**
   * A drop never changes membership at once: once `self`'s last socket is gone the seat is
   * held for the grace period, then the member is removed, as the Gateway does. A result's
   * decision window runs on regardless, so a drop there starts no grace period.
   */
  onClose(endpoint: MockEndpoint, dropped: boolean): void {
    this.endpoints.delete(endpoint);
    const me = this.find(this.self.user_id);
    if (!dropped || this.endpoints.size > 0 || !me) return;
    if (me.state === 'POST_GAME' || this.room.status === 'CLOSED') return;
    this.stopGraceTimer();
    const graceMs = this.room.status === 'IN_GAME' ? this.graceMs.game : this.graceMs.room;
    this.graceTimer = setTimeout(() => {
      this.graceTimer = null;
      if (this.endpoints.size === 0 && this.find(this.self.user_id)) {
        this.playerLeave(this.self.user_id, 'DISCONNECTED');
      }
    }, graceMs);
  }

  /** The handshake is refused once `self` no longer belongs to the room. */
  accepts(): boolean {
    return this.room.status !== 'CLOSED' && this.find(this.self.user_id) !== undefined;
  }

  onCommand(endpoint: MockEndpoint, raw: unknown): void {
    const command = raw as RoomCommand;
    try {
      const ackPayload = this.applyCommand(command);
      const ack: AckMessage = {
        type: 'ack',
        request_id: command.request_id,
        ok: true,
        payload: ackPayload,
      };
      endpoint.deliver(ack);
      this.flush();
    } catch (error) {
      this.pending = [];
      if (!(error instanceof MockActionError) || error.code === 'ROOM_FULL') throw error;
      const message: WsErrorMessage = {
        type: 'error',
        request_id: command.request_id,
        error: { code: error.code as WsErrorCode, message: error.message, details: error.details },
      };
      endpoint.deliver(message);
    }
  }

  /* ------------------------------ inspection -------------------------------- */

  /** Full authoritative room, including hidden card colors. For debugging only. */
  state(): Room {
    return structuredClone({
      ...this.room,
      game: this.game && { ...this.game, board: this.fullBoard() },
    });
  }

  /** Recipient-specific snapshot as `self` receives it — what REST `Get room snapshot` returns. */
  snapshot(): Room {
    return this.projectRoom();
  }

  hasMember(userId: number): boolean {
    return this.find(userId) !== undefined;
  }

  /** Whether a new member could join now, as REST `Join room` checks it. */
  joinable(): boolean {
    const { status } = this.room;
    const open = status === 'WAITING' || status === 'COUNTDOWN' || status === 'IN_GAME';
    return open && !this.room.players.some((p) => p.state === 'POST_GAME');
  }

  /* ---------------------------- other players act --------------------------- */

  /** A REST join: always a spectator, in a waiting room or a running match. */
  playerJoin(player: MockPlayer): Room {
    if (!this.joinable()) {
      throw new MockActionError(
        'ROOM_NOT_JOINABLE',
        `Room ${this.roomId} is not joinable while status is ${this.room.status}.`,
        { room_id: this.roomId, status: this.room.status },
      );
    }
    if (this.room.player_count >= this.room.max_players) {
      throw new MockActionError(
        'ROOM_FULL',
        `Room ${this.roomId} is full (${this.room.player_count} of ${this.room.max_players} players).`,
        {
          room_id: this.roomId,
          player_count: this.room.player_count,
          max_players: this.room.max_players,
        },
      );
    }
    if (this.find(player.user_id))
      throw new MockActionError('INVALID_PAYLOAD', `User ${player.user_id} is already a member.`);
    const state = this.room.status === 'IN_GAME' ? 'IN_GAME' : 'IN_LOBBY';
    const member = this.newMember(player, this.room.host_user_id === null, now(), state);
    if (this.room.host_user_id === null) this.room.host_user_id = member.user_id;
    this.room.players.push(member);
    this.recount();
    this.queue('room.player.joined', this.membershipPayload(member));
    this.queueState();
    this.flush();
    return this.state();
  }

  /**
   * A member leaves: an explicit Exit, a logout, an expired grace period or a deleted
   * account. During a match a participant's departure rechecks both teams' staffing.
   */
  playerLeave(userId: number, reason: MemberLeftReason = 'EXITED'): Room {
    this.removeMember(userId, reason);
    this.flush();
    return this.state();
  }

  selectTeam(userId: number, team: Team): Room {
    this.doSelectTeam(userId, team);
    this.flush();
    return this.state();
  }

  /** Claim `role` on `team`, or go back to spectating with `'SPECTATOR'`. */
  selectRole(userId: number, role: PlayingRole | 'SPECTATOR', team?: Team): Room {
    this.doSelectRole(userId, role, team);
    this.flush();
    return this.state();
  }

  setReady(userId: number, ready: boolean): Room {
    this.doSetReady(userId, ready);
    this.flush();
    return this.state();
  }

  updateSettings(maxPlayers: number, byUserId: number | null = this.room.host_user_id): Room {
    this.doUpdateSettings(byUserId ?? -1, { max_players: maxPlayers });
    this.flush();
    return this.state();
  }

  /** The host sets the turn timer: `null`, `60`, `90` or `120` seconds. */
  setTurnTimer(seconds: number | null, byUserId: number | null = this.room.host_user_id): Room {
    this.doUpdateSettings(byUserId ?? -1, { turn_timer_seconds: seconds });
    this.flush();
    return this.state();
  }

  /** End the active turn now, as its timer running out would. */
  expireTurn(): Room {
    const game = this.requireGame();
    this.requireUnpaused(game);
    this.stopTurnClock();
    this.changeTurn('TURN_TIMER_EXPIRED');
    this.flush();
    return this.state();
  }

  /** The host (or `byUserId`) removes `userId`. Kick `self` to see being removed. */
  kick(userId: number, byUserId: number | null = this.room.host_user_id): Room {
    this.doKick(byUserId ?? -1, userId);
    this.flush();
    return this.state();
  }

  returnToLobby(userId: number): Room {
    this.doReturn(userId);
    this.flush();
    return this.state();
  }

  /**
   * Fill both teams with a valid start configuration and mark everyone ready, which
   * starts the countdown exactly as the server does. `selfRole` picks the local player's
   * seat on RED.
   */
  configureStartable(selfRole: PlayingRole = 'OPERATIVE'): Room {
    const bots: MockPlayer[] = [MOCK_BOTS.redAgent, MOCK_BOTS.blueMaster, MOCK_BOTS.blueAgent];
    for (const bot of bots) if (!this.find(bot.user_id)) this.playerJoin(bot);
    const seats: [number, Team, PlayingRole][] = [
      [this.self.user_id, 'RED', selfRole],
      [MOCK_BOTS.redAgent.user_id, 'RED', selfRole === 'SPYMASTER' ? 'OPERATIVE' : 'SPYMASTER'],
      [MOCK_BOTS.blueMaster.user_id, 'BLUE', 'SPYMASTER'],
      [MOCK_BOTS.blueAgent.user_id, 'BLUE', 'OPERATIVE'],
    ];
    const seated = new Set(seats.map(([id]) => id));
    // Seats first come free: anyone else holding a Spymaster seat steps down to Operative.
    for (const p of this.room.players) {
      if (!seated.has(p.user_id) && p.role === 'SPYMASTER' && p.team) {
        this.doSelectRole(p.user_id, 'OPERATIVE', p.team);
      }
    }
    for (const [id, team] of seats) {
      const member = this.require(id);
      if (member.role === 'SPYMASTER' && member.team !== team) this.doSelectRole(id, 'SPECTATOR');
    }
    for (const [id, team, role] of seats) this.doSelectRole(id, role, team);
    for (const p of this.room.players) if (p.role !== 'SPECTATOR') this.doSetReady(p.user_id, true);
    this.flush();
    return this.state();
  }

  /** Skip the countdown and start immediately. */
  startGame(startingTeam: Team = 'RED'): Room {
    this.stopCountdownTimer();
    this.beginGame(startingTeam);
    this.flush();
    return this.state();
  }

  submitClue(word: string, number: number, byUserId?: number): Room {
    this.doSubmitClue(byUserId ?? this.spymasterOf(this.activeTeam()), word, number);
    this.flush();
    return this.state();
  }

  guessCard(cardId: number, byUserId?: number): Room {
    this.doGuess(byUserId ?? this.operativeOf(this.activeTeam()), cardId);
    this.flush();
    return this.state();
  }

  passTurn(byUserId?: number): Room {
    this.doPass(byUserId ?? this.operativeOf(this.activeTeam()));
    this.flush();
    return this.state();
  }

  /** End the match now with `winner`, as if the next unrevealed card had decided it. */
  endGame(
    winner: Team,
    reason: 'ALL_TEAM_CARDS_REVEALED' | 'ASSASSIN_REVEALED' = 'ALL_TEAM_CARDS_REVEALED',
  ): Room {
    const game = this.requireGame();
    const card = game.board.find((c) => !c.revealed);
    if (!card) throw new Error('Mock sockets: no unrevealed card is left.');
    const color = this.hiddenColors[card.card_id - 1] as CardColor;
    card.revealed = true;
    card.color = color;
    this.finish(winner, reason, { card_id: card.card_id, word: card.word, revealed: true, color });
    this.flush();
    return this.state();
  }

  /** Drop every socket for this room; the client reconnects and receives a fresh snapshot. */
  dropConnection(reconnectAfterMs?: number): void {
    [...this.endpoints].forEach((endpoint) => endpoint.simulateDrop(reconnectAfterMs));
  }

  /** Send the current snapshot to every socket, as the server does after recovery. */
  resync(): void {
    this.queueState();
    this.flush();
  }

  /* ------------------------------ command handling -------------------------- */

  private applyCommand(command: RoomCommand): Record<string, unknown> {
    const id = this.self.user_id;
    if (!this.find(id))
      throw new MockActionError(
        'NOT_ROOM_MEMBER',
        `User ${id} is not a member of room ${this.roomId}.`,
        { room_id: this.roomId, user_id: id },
      );
    switch (command.type) {
      case 'room.settings.update':
        this.doUpdateSettings(id, command.payload);
        return {
          max_players: this.room.max_players,
          turn_timer_seconds: this.room.turn_timer_seconds,
          language: this.room.language,
          room_status: this.room.status,
        };
      case 'room.member.kick':
        this.doKick(id, command.payload.user_id);
        return { kicked_user_id: command.payload.user_id, room_status: this.room.status };
      case 'room.team.select': {
        const m = this.doSelectTeam(id, command.payload.team);
        return {
          user_id: id,
          team: m.team,
          role: m.role,
          ready: m.ready,
          room_status: this.room.status,
        };
      }
      case 'room.role.select': {
        const { payload } = command;
        const m = this.doSelectRole(id, payload.role, 'team' in payload ? payload.team : undefined);
        return {
          user_id: id,
          team: m.team,
          role: m.role,
          ready: m.ready,
          room_status: this.room.status,
        };
      }
      case 'room.ready.set': {
        const m = this.doSetReady(id, command.payload.ready);
        return {
          user_id: id,
          ready: m.ready,
          room_status: this.room.status,
          startable: this.room.startable,
        };
      }
      case 'room.lobby.return': {
        const previous = this.game?.game_id;
        this.doReturn(id);
        return {
          room_id: this.roomId,
          previous_game_id: previous,
          room_status: this.room.status,
          member_state: 'IN_LOBBY',
        };
      }
      case 'game.clue.submit':
        this.doSubmitClue(id, command.payload.word, command.payload.number);
        return {
          game_id: this.requireGame().game_id,
          current_turn: this.requireGame().current_turn,
        };
      case 'game.card.guess': {
        this.doGuess(id, command.payload.card_id);
        // The game may have just ended, so read it directly rather than through `requireGame`.
        const game = this.game!;
        const card = game.board.find((c) => c.card_id === command.payload.card_id)!;
        return {
          game_id: game.game_id,
          card: { ...card },
          guessing_team: this.find(id)?.team,
          score: { ...game.score },
          current_turn: { ...game.current_turn },
          winner: game.winner,
          end_reason: game.end_reason,
        };
      }
      case 'game.turn.pass':
        this.doPass(id);
        return {
          game_id: this.requireGame().game_id,
          current_turn: this.requireGame().current_turn,
        };
      default:
        throw new MockActionError('INVALID_EVENT', 'Message type is not supported.');
    }
  }

  private doUpdateSettings(
    byUserId: number,
    settings: { max_players?: number; turn_timer_seconds?: number | null; language?: string },
  ): void {
    const host = this.require(byUserId);
    if (byUserId !== this.room.host_user_id) {
      throw new MockActionError('NOT_HOST', 'Only the host can change room settings.', {
        host_user_id: this.room.host_user_id,
      });
    }
    if (this.room.status !== 'WAITING' || host.state !== 'IN_LOBBY') this.invalidState();
    const { max_players: maxPlayers } = settings;
    if (
      maxPlayers === undefined &&
      !('turn_timer_seconds' in settings) &&
      !('language' in settings)
    ) {
      throw new MockActionError('INVALID_PAYLOAD', 'payload must change at least one setting.', {
        field: 'payload',
      });
    }
    const timer = settings.turn_timer_seconds;
    if (
      'turn_timer_seconds' in settings &&
      !(TURN_TIMER_OPTIONS as readonly unknown[]).includes(timer)
    ) {
      throw new MockActionError(
        'INVALID_PAYLOAD',
        `payload.turn_timer_seconds must be one of ${TURN_TIMER_OPTIONS.join(', ')}.`,
        { field: 'payload.turn_timer_seconds', allowed: [...TURN_TIMER_OPTIONS] },
      );
    }
    const { language } = settings;
    if (language !== undefined && !(ROOM_LANGUAGES as readonly string[]).includes(language)) {
      throw new MockActionError(
        'INVALID_PAYLOAD',
        `payload.language must be one of ${ROOM_LANGUAGES.join(', ')}.`,
        { field: 'payload.language', allowed: [...ROOM_LANGUAGES] },
      );
    }
    const min = Math.max(ROOM_CAPACITY.min, this.room.player_count);
    if (
      maxPlayers !== undefined &&
      (!Number.isInteger(maxPlayers) || maxPlayers < min || maxPlayers > ROOM_CAPACITY.max)
    ) {
      throw new MockActionError(
        'INVALID_PAYLOAD',
        `payload.max_players must be an integer from ${min} through ${ROOM_CAPACITY.max}.`,
        { field: 'payload.max_players', min, max: ROOM_CAPACITY.max },
      );
    }
    if (maxPlayers !== undefined) this.room.max_players = maxPlayers;
    if (timer !== undefined) this.room.turn_timer_seconds = timer;
    if (language !== undefined) this.room.language = language;
    this.queue('room.settings.updated', {
      max_players: this.room.max_players,
      turn_timer_seconds: this.room.turn_timer_seconds,
      language: this.room.language,
      player_count: this.room.player_count,
      changed_by_user_id: byUserId,
    });
    this.queueState();
  }

  private doKick(byUserId: number, targetId: number): void {
    this.require(byUserId);
    if (byUserId !== this.room.host_user_id) {
      throw new MockActionError('NOT_HOST', 'Only the host can remove members.', {
        host_user_id: this.room.host_user_id,
      });
    }
    if (targetId === byUserId) {
      throw new MockActionError('CANNOT_KICK_SELF', 'Use Exit to leave the room yourself.', {
        user_id: targetId,
      });
    }
    if (!this.find(targetId)) {
      throw new MockActionError(
        'TARGET_NOT_ROOM_MEMBER',
        `User ${targetId} is not a member of room ${this.roomId}.`,
        { user_id: targetId },
      );
    }
    if (this.room.status === 'CLOSED') this.invalidState();
    this.removeMember(targetId, 'KICKED_BY_HOST', byUserId);
  }

  private doSelectTeam(userId: number, team: Team): RoomMember {
    const member = this.require(userId);
    this.requireLobby();
    if (member.role === 'SPECTATOR') {
      throw new MockActionError('ROLE_REQUIRED', 'Claim a team and a role together first.', {
        user_id: userId,
      });
    }
    if (member.team === team) return member;
    if (member.role === 'SPYMASTER') this.requireSpymasterSeat(team, userId);
    member.team = team;
    return this.memberChanged(member, ['team'], 'TEAM_CHANGED');
  }

  private doSelectRole(userId: number, role: PlayingRole | 'SPECTATOR', team?: Team): RoomMember {
    const member = this.require(userId);
    const inGame = this.room.status === 'IN_GAME';
    if (inGame) {
      // Mid-match, only a spectator may claim a seat, and only a playing one.
      if (member.role !== 'SPECTATOR' || role === 'SPECTATOR') {
        throw new MockActionError(
          'INVALID_ROOM_STATE',
          'Roles cannot change while room status is IN_GAME.',
          { status: this.room.status },
        );
      }
    } else {
      this.requireLobby();
    }

    if (role === 'SPECTATOR') {
      member.role = 'SPECTATOR';
      member.team = null;
      return this.memberChanged(member, ['role', 'team'], 'ROLE_CHANGED');
    }
    const target = team ?? member.team;
    if (!target) {
      throw new MockActionError('TEAM_REQUIRED', 'Select a team before selecting a role.', {
        user_id: userId,
      });
    }
    if (role === 'SPYMASTER') this.requireSpymasterSeat(target, userId);
    const fields: ('team' | 'role')[] = member.team === target ? ['role'] : ['role', 'team'];
    member.team = target;
    member.role = role;
    if (inGame) {
      this.queue('room.player.updated', {
        player: { ...member },
        changed_fields: fields,
        room_status: this.room.status,
        startable: false,
      });
      this.recheckStaffing(null);
      this.queueState();
      return member;
    }
    return this.memberChanged(member, fields, 'ROLE_CHANGED');
  }

  private doSetReady(userId: number, ready: boolean): RoomMember {
    const member = this.require(userId);
    this.requireLobby();
    if (ready && this.room.status === 'COUNTDOWN') this.invalidState();
    if (ready && !member.team)
      throw new MockActionError('TEAM_REQUIRED', 'Select a team before becoming ready.', {
        user_id: userId,
      });
    if (ready && member.role === 'SPECTATOR')
      throw new MockActionError('ROLE_REQUIRED', 'Select a role before becoming ready.', {
        user_id: userId,
      });
    if (ready && this.room.players.some((p) => p.state === 'POST_GAME'))
      throw new MockActionError(
        'POST_GAME_PENDING',
        'Players are still on the last result; readiness opens when they return.',
        { pending_user_ids: this.pendingIds() },
      );
    member.ready = ready;
    const cancelling = this.room.status === 'COUNTDOWN' && !ready;
    this.queue('room.player.updated', {
      player: { ...member },
      changed_fields: ['ready'],
      room_status: cancelling ? 'WAITING' : this.room.status,
      startable: this.computeStartable(),
    });
    if (cancelling) this.cancelCountdown('PLAYER_UNREADY', userId);
    this.recheckStart(userId);
    this.queueState();
    return member;
  }

  private memberChanged(
    member: RoomMember,
    fields: ('team' | 'role')[],
    reason: 'TEAM_CHANGED' | 'ROLE_CHANGED',
  ): RoomMember {
    const readyChanged = member.ready;
    member.ready = false;
    const changed = readyChanged ? [...fields, 'ready' as const] : fields;
    this.queue('room.player.updated', {
      player: { ...member },
      changed_fields: changed,
      room_status: this.room.status,
      startable: this.computeStartable(),
    });
    if (this.room.status === 'COUNTDOWN') this.cancelCountdown(reason, member.user_id);
    this.recheckStart(member.user_id);
    this.queueState();
    return member;
  }

  private doReturn(userId: number): void {
    const member = this.require(userId);
    if (member.state !== 'POST_GAME') this.invalidState();
    member.state = 'IN_LOBBY';
    member.ready = false;
    // The first return reopens the room's lobby; it never falls back to POST_GAME.
    this.room.status = 'WAITING';
    this.queue('room.player.returned_to_lobby', {
      user_id: userId,
      previous_game_id: this.game?.game_id ?? 0,
      room_status: this.room.status,
      member_state: 'IN_LOBBY',
    });
    this.completePostGameIfDone();
    this.queueState();
  }

  /* -------------------------------- membership ------------------------------ */

  private removeMember(userId: number, reason: MemberLeftReason, kickedBy?: number): void {
    const member = this.require(userId);
    const wasPlaying =
      this.room.status === 'IN_GAME' && member.role !== 'SPECTATOR' && member.team !== null;
    if (this.room.status === 'COUNTDOWN' && member.role !== 'SPECTATOR') {
      this.cancelCountdown(reason === 'KICKED_BY_HOST' ? 'PLAYER_KICKED' : 'PLAYER_LEFT', userId);
    }
    this.room.players = this.room.players.filter((p) => p.user_id !== userId);
    this.recount();
    if (this.room.host_user_id === userId) {
      const order = [...this.room.players].sort((a, b) => a.joined_at.localeCompare(b.joined_at));
      const next = order.find((p) => p.state === 'IN_LOBBY') ?? order[0];
      this.room.host_user_id = next ? next.user_id : null;
      this.room.players.forEach((p) => (p.is_host = p.user_id === next?.user_id));
    }
    if (this.room.players.length === 0) this.closeEmpty();
    this.queue('room.player.left', {
      ...this.membershipPayload(member),
      reason,
      ...(kickedBy === undefined ? {} : { kicked_by_user_id: kickedBy }),
    });
    if (
      userId === this.self.user_id &&
      (reason === 'KICKED_BY_HOST' || reason === 'POST_GAME_TIMEOUT')
    ) {
      this.flush();
      [...this.endpoints].forEach((endpoint) => endpoint.simulateClose('NOT_ROOM_MEMBER'));
    }
    if (wasPlaying && member.team && member.role !== 'SPECTATOR') {
      this.recheckStaffing({
        user_id: member.user_id,
        username: member.username,
        team: member.team,
        role: member.role,
        reason: reason as StaffingDeparture['reason'],
      });
    }
    this.completePostGameIfDone();
    this.recheckStart(userId);
    this.queueState();
  }

  /** The mock closes an empty room at once rather than holding it for 300 seconds. */
  private closeEmpty(): void {
    this.room.status = 'CLOSED';
    this.stopCountdownTimer();
    this.stopPostGameTimer();
    this.stopStaffingTimers();
  }

  /* --------------------------------- countdown ------------------------------ */

  private recheckStart(changedBy: number): void {
    const startable = this.computeStartable();
    this.room.startable = startable;
    if (this.room.status === 'WAITING' && startable) {
      this.room.status = 'COUNTDOWN';
      this.room.countdown = { seconds_remaining: 3 };
      this.queue('room.countdown.started', { seconds_remaining: 3 });
      this.startCountdownTimer();
    } else if (this.room.status === 'COUNTDOWN' && !startable) {
      this.cancelCountdown('PLAYER_UNREADY', changedBy);
    }
  }

  private cancelCountdown(reason: CountdownCancelReason, by: number): void {
    if (this.room.status !== 'COUNTDOWN') return;
    this.stopCountdownTimer();
    this.room.status = 'WAITING';
    delete this.room.countdown;
    this.queue('room.countdown.cancelled', { reason, changed_by_user_id: by });
  }

  private startCountdownTimer(): void {
    this.stopCountdownTimer();
    this.countdownTimer = setInterval(() => {
      const left = (this.room.countdown?.seconds_remaining ?? 1) - 1;
      if (left > 0) {
        this.room.countdown = { seconds_remaining: left };
        this.queue('room.countdown.tick', { seconds_remaining: left });
      } else {
        this.stopCountdownTimer();
        this.queue('room.countdown.tick', { seconds_remaining: 0 });
        this.beginGame(this.random() < 0.5 ? 'RED' : 'BLUE');
      }
      this.flush();
    }, 1_000);
  }

  private stopCountdownTimer(): void {
    if (this.countdownTimer !== null) clearInterval(this.countdownTimer);
    this.countdownTimer = null;
  }

  /* ----------------------------------- game --------------------------------- */

  private beginGame(startingTeam: Team): void {
    const colors: CardColor[] = [
      ...Array<CardColor>(9).fill(startingTeam),
      ...Array<CardColor>(8).fill(other(startingTeam)),
      ...Array<CardColor>(7).fill('NEUTRAL'),
      'ASSASSIN',
    ];
    for (let i = colors.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.random() * (i + 1));
      [colors[i], colors[j]] = [colors[j] as CardColor, colors[i] as CardColor];
    }
    this.hiddenColors = colors;
    this.room.status = 'IN_GAME';
    this.room.startable = false;
    delete this.room.countdown;
    delete this.room.post_game;
    this.room.players.forEach((p) => (p.state = 'IN_GAME'));
    this.pausedPhase = null;
    this.game = {
      game_id: this.roomId * 10 + (this.game ? (this.game.game_id % 10) + 1 : 1),
      status: 'IN_PROGRESS',
      starting_team: startingTeam,
      current_turn: {
        team: startingTeam,
        phase: 'WAITING_FOR_CLUE',
        clue: null,
        guesses_remaining: null,
        deadline_at: null,
      },
      score: { red: 0, blue: 0 },
      board: WORDS.map((word, i) => ({ card_id: i + 1, word, revealed: false, color: null })),
      winner: null,
      end_reason: null,
      started_at: now(),
      finished_at: null,
    };
    this.startTurnClock();
    this.queue('game.started', { room: this.projectRoom() });
  }

  private doSubmitClue(userId: number, word: string, number: number): void {
    const game = this.requireGame();
    const member = this.require(userId);
    this.requireUnpaused(game);
    if (member.role === 'SPECTATOR' || member.role === 'OPERATIVE')
      throw new MockActionError(
        'ROLE_FORBIDDEN',
        'Only the active-team Spymaster may submit a clue.',
        { required_role: 'SPYMASTER' },
      );
    if (game.current_turn.team !== member.team)
      throw new MockActionError(
        'NOT_YOUR_TURN',
        `${member.team} cannot give a clue while ${game.current_turn.team} is the active team.`,
        { active_team: game.current_turn.team },
      );
    if (game.current_turn.phase !== 'WAITING_FOR_CLUE') this.invalidState();
    const clue = word.trim().toLowerCase();
    if (!/^\S{1,30}$/u.test(clue))
      throw new MockActionError(
        'INVALID_CLUE',
        'payload.word must contain exactly one non-whitespace word.',
        { field: 'payload.word' },
      );
    if (!Number.isInteger(number) || number < 1 || number > 9)
      throw new MockActionError(
        'INVALID_CLUE_NUMBER',
        'payload.number must be an integer from 1 through 9.',
        { field: 'payload.number', min: 1, max: 9 },
      );
    game.current_turn = {
      team: game.current_turn.team,
      phase: 'GUESSING',
      clue: { word: clue, number },
      guesses_remaining: number + 1,
      deadline_at: game.current_turn.deadline_at,
    };
    this.queue('game.clue.submitted', {
      game_id: game.game_id,
      submitted_by_user_id: userId,
      team: game.current_turn.team,
      clue: { word: clue, number },
      guesses_remaining: number + 1,
      current_turn: { ...game.current_turn },
    });
  }

  private doGuess(userId: number, cardId: number): void {
    const game = this.requireGame();
    const member = this.require(userId);
    this.requireGuesser(member);
    const card = game.board.find((c) => c.card_id === cardId);
    if (!card)
      throw new MockActionError(
        'INVALID_CARD',
        `Card ${cardId} does not exist in game ${game.game_id}.`,
        { card_id: cardId, game_id: game.game_id },
      );
    if (card.revealed)
      throw new MockActionError(
        'CARD_ALREADY_REVEALED',
        `Card ${cardId} has already been revealed.`,
        { card_id: cardId },
      );

    const color = this.hiddenColors[cardId - 1] as CardColor;
    const team = game.current_turn.team;
    card.revealed = true;
    card.color = color;
    if (color === 'RED') game.score.red += 1;
    if (color === 'BLUE') game.score.blue += 1;
    game.current_turn.guesses_remaining = (game.current_turn.guesses_remaining ?? 1) - 1;

    const redTotal = this.hiddenColors.filter((c) => c === 'RED').length;
    const blueTotal = this.hiddenColors.filter((c) => c === 'BLUE').length;
    let winner: Team | null = null;
    let reason: 'ALL_TEAM_CARDS_REVEALED' | 'ASSASSIN_REVEALED' | null = null;
    if (color === 'ASSASSIN') [winner, reason] = [other(team), 'ASSASSIN_REVEALED'];
    else if (game.score.red === redTotal) [winner, reason] = ['RED', 'ALL_TEAM_CARDS_REVEALED'];
    else if (game.score.blue === blueTotal) [winner, reason] = ['BLUE', 'ALL_TEAM_CARDS_REVEALED'];

    const revealed: RevealedCard = { card_id: cardId, word: card.word, revealed: true, color };
    this.queue('game.card.revealed', {
      game_id: game.game_id,
      card: revealed,
      guessed_by_user_id: userId,
      guessing_team: team,
      score: { ...game.score },
      current_turn: { ...game.current_turn },
      winner,
      end_reason: reason,
    });
    if (color === 'RED' || color === 'BLUE')
      this.queue('game.score.updated', {
        game_id: game.game_id,
        score: { ...game.score },
        changed_color: color,
      });

    if (winner && reason) {
      this.finish(winner, reason, revealed);
      return;
    }
    if (color === 'NEUTRAL') this.changeTurn('NEUTRAL_CARD_REVEALED');
    else if (color !== team) this.changeTurn('OPPONENT_CARD_REVEALED');
    else if (game.current_turn.guesses_remaining === 0) this.changeTurn('GUESSES_EXHAUSTED');
  }

  private doPass(userId: number): void {
    this.requireGuesser(this.require(userId));
    this.changeTurn('PASSED');
  }

  private changeTurn(reason: GameTurnChangeReason): void {
    const game = this.requireGame();
    const previous = game.current_turn.team;
    game.current_turn = {
      team: other(previous),
      phase: 'WAITING_FOR_CLUE',
      clue: null,
      guesses_remaining: null,
      deadline_at: null,
    };
    this.startTurnClock();
    this.queue('game.turn.changed', {
      game_id: game.game_id,
      previous_team: previous,
      reason,
      current_turn: { ...game.current_turn },
      score: { ...game.score },
    });
  }

  /**
   * A competitive result: the room and every member enter `POST_GAME` with one shared
   * decision deadline, after which undecided members are removed.
   */
  private finish(
    winner: Team,
    reason: 'ALL_TEAM_CARDS_REVEALED' | 'ASSASSIN_REVEALED',
    revealed: RevealedCard,
  ): void {
    const game = this.requireGame();
    const finishedAt = now();
    const deadline = isoIn(this.postGameMs);
    this.stopStaffingTimers();
    game.status = 'GAME_FINISHED';
    game.winner = winner;
    game.end_reason = reason;
    game.finished_at = finishedAt;
    this.stopTurnClock();
    game.current_turn = { ...game.current_turn, phase: 'GAME_OVER', deadline_at: null };
    delete game.staffing;
    this.room.status = 'POST_GAME';
    this.room.players.forEach((p) => {
      p.state = 'POST_GAME';
      p.ready = false;
    });
    this.room.post_game = { deadline_at: deadline, pending_user_ids: this.pendingIds() };
    this.lastGame = {
      game_id: game.game_id,
      status: 'GAME_FINISHED',
      winner,
      loser: other(winner),
      end_reason: reason,
      score: { ...game.score },
      finished_at: finishedAt,
    };
    this.queue('game.ended', {
      game_id: game.game_id,
      winner,
      loser: other(winner),
      end_reason: reason,
      revealed_card: revealed,
      score: { ...game.score },
      room_status: 'POST_GAME',
      game_status: 'GAME_FINISHED',
      phase: 'GAME_OVER',
      post_game_deadline_at: deadline,
      finished_at: finishedAt,
    });
    this.queue('room.post_game.started', {
      game_id: game.game_id,
      deadline_at: deadline,
      pending_user_ids: this.pendingIds(),
    });
    this.queueState();
    this.stopPostGameTimer();
    this.postGameTimer = setTimeout(() => this.expirePostGame(), this.postGameMs);
  }

  private expirePostGame(): void {
    this.postGameTimer = null;
    for (const p of this.room.players.filter((m) => m.state === 'POST_GAME')) {
      this.removeMember(p.user_id, 'POST_GAME_TIMEOUT');
    }
    this.flush();
  }

  /** Once nobody is left on the result, the room's lobby is open to everything again. */
  private completePostGameIfDone(): void {
    if (!this.room.post_game) return;
    const pending = this.pendingIds();
    if (pending.length > 0) {
      this.room.post_game = { ...this.room.post_game, pending_user_ids: pending };
      return;
    }
    delete this.room.post_game;
    this.stopPostGameTimer();
    if (this.room.status === 'POST_GAME') {
      this.room.status = this.room.players.length ? 'WAITING' : 'CLOSED';
    }
    this.queue('room.post_game.completed', {
      room_status: this.room.status,
      remaining_member_ids: this.room.players.map((p) => p.user_id),
    });
  }

  /* --------------------------------- staffing ------------------------------- */

  private missingRoles(team: Team): PlayingRole[] {
    const members = this.room.players.filter((p) => p.team === team);
    const missing: PlayingRole[] = [];
    if (!members.some((p) => p.role === 'SPYMASTER')) missing.push('SPYMASTER');
    if (!members.some((p) => p.role === 'OPERATIVE')) missing.push('OPERATIVE');
    return missing;
  }

  /**
   * After a departure or a claim during a match: a team short of its Spymaster or of every
   * Operative gets its own shutdown deadline and the game pauses; a team that is whole
   * again loses its deadline, and play resumes once both are.
   */
  private recheckStaffing(departure: StaffingDeparture | null): void {
    const game = this.game;
    if (!game || game.status !== 'IN_PROGRESS' || this.room.status !== 'IN_GAME') return;
    const previous = game.staffing;
    const staffing: Staffing = {
      red: { missing_roles: [], deadline_at: null },
      blue: { missing_roles: [], deadline_at: null },
    };
    const restored: Team[] = [];
    let newlyShort = false;
    for (const team of TEAMS) {
      const missing = this.missingRoles(team);
      const before = previous?.[key(team)];
      if (missing.length) {
        const deadline = before?.deadline_at ?? isoIn(this.staffingMs);
        if (!before?.deadline_at) {
          newlyShort = true;
          this.staffingTimers.set(
            team,
            setTimeout(() => this.expireStaffing(team), Date.parse(deadline) - Date.now()),
          );
        }
        staffing[key(team)] = { missing_roles: missing, deadline_at: deadline };
      } else if (before?.deadline_at) {
        restored.push(team);
        clearTimeout(this.staffingTimers.get(team));
        this.staffingTimers.delete(team);
      }
    }
    const short = TEAMS.some((team) => staffing[key(team)].missing_roles.length);

    if (short) {
      if (game.current_turn.phase !== 'PAUSED_FOR_PLAYERS') {
        this.pausedPhase = game.current_turn.phase;
        const deadline = game.current_turn.deadline_at;
        this.turnRemainingMs = deadline === null ? null : Date.parse(deadline) - Date.now();
        this.stopTurnClock();
        game.current_turn = {
          ...game.current_turn,
          phase: 'PAUSED_FOR_PLAYERS',
          deadline_at: null,
        };
      }
      game.staffing = staffing;
      if (newlyShort && departure) {
        this.queue('game.staffing.required', {
          game_id: game.game_id,
          phase: 'PAUSED_FOR_PLAYERS',
          staffing,
          departure,
        });
      }
      return;
    }
    if (previous) {
      delete game.staffing;
      game.current_turn = { ...game.current_turn, phase: this.pausedPhase ?? 'WAITING_FOR_CLUE' };
      this.pausedPhase = null;
      // The turn resumes with the time it had left when the pause stopped its clock.
      this.startTurnClock(this.turnRemainingMs);
      this.turnRemainingMs = null;
      this.queue('game.staffing.restored', {
        game_id: game.game_id,
        restored_teams: restored,
        current_turn: { ...game.current_turn },
      });
    }
  }

  /** A deadline passed with the team still short: the match is cancelled and the room shut. */
  private expireStaffing(team: Team): void {
    this.staffingTimers.delete(team);
    const game = this.game;
    if (!game || game.status !== 'IN_PROGRESS') return;
    const finishedAt = now();
    this.stopStaffingTimers();
    game.status = 'GAME_CANCELLED';
    game.end_reason = 'INSUFFICIENT_PLAYERS';
    game.finished_at = finishedAt;
    this.stopTurnClock();
    game.current_turn = { ...game.current_turn, phase: 'GAME_OVER', deadline_at: null };
    this.room.status = 'CLOSED';
    this.queue('game.cancelled', {
      game_id: game.game_id,
      winner: null,
      loser: null,
      end_reason: 'INSUFFICIENT_PLAYERS',
      deficient_team: team,
      revealed_card: null,
      score: { ...game.score },
      room_status: 'CLOSED',
      game_status: 'GAME_CANCELLED',
      phase: 'GAME_OVER',
      finished_at: finishedAt,
    });
    this.queue('room.closed', {
      reason: 'INSUFFICIENT_PLAYERS',
      game_id: game.game_id,
      deficient_team: team,
      closed_at: finishedAt,
    });
    this.flush();
    this.room.players = [];
    this.recount();
    [...this.endpoints].forEach((endpoint) => endpoint.simulateClose('ROOM_NOT_FOUND'));
    mockRoomLifecycle.changed();
  }

  /**
   * Start the active turn's clock for `ms` (default: the room's full turn limit) and set
   * `deadline_at`. With no turn limit the deadline stays `null`.
   */
  private startTurnClock(ms?: number | null): void {
    const game = this.requireGame();
    this.stopTurnClock();
    const limit = this.room.turn_timer_seconds;
    const duration = ms ?? (limit === null ? null : limit * 1_000);
    if (limit === null || duration === null) {
      game.current_turn.deadline_at = null;
      return;
    }
    game.current_turn.deadline_at = isoIn(Math.max(0, duration));
    this.turnTimer = setTimeout(
      () => {
        this.turnTimer = null;
        const current = this.game;
        if (
          current?.status !== 'IN_PROGRESS' ||
          current.current_turn.phase === 'PAUSED_FOR_PLAYERS'
        )
          return;
        this.changeTurn('TURN_TIMER_EXPIRED');
        this.flush();
      },
      Math.max(0, duration),
    );
  }

  private stopTurnClock(): void {
    if (this.turnTimer !== null) clearTimeout(this.turnTimer);
    this.turnTimer = null;
  }

  private stopStaffingTimers(): void {
    this.staffingTimers.forEach((timer) => clearTimeout(timer));
    this.staffingTimers.clear();
  }

  private stopPostGameTimer(): void {
    if (this.postGameTimer !== null) clearTimeout(this.postGameTimer);
    this.postGameTimer = null;
  }

  private stopGraceTimer(): void {
    if (this.graceTimer !== null) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }

  /* --------------------------------- helpers -------------------------------- */

  private pending: { type: RoomServerEvent['type']; payload: unknown }[] = [];

  private queue<T extends RoomServerEvent>(type: T['type'], payload: T['payload']): void {
    this.pending.push({ type, payload });
  }

  private queueState(): void {
    this.pending.push({ type: 'room.state', payload: null });
  }

  /** Emit queued events in order; snapshots are projected at emission time. */
  private flush(): void {
    const batch = this.pending;
    this.pending = [];
    for (const item of batch) {
      const payload =
        item.type === 'room.state' || item.type === 'game.started'
          ? { room: this.projectRoom() }
          : item.payload;
      // A removed member's sockets get nothing after their own removal.
      if (item.type === 'room.state' && !this.find(this.self.user_id)) continue;
      const event = this.envelope(item.type, payload);
      this.endpoints.forEach((endpoint) => endpoint.deliver(event));
    }
    if (batch.length > 0) mockRoomLifecycle.changed();
  }

  private envelope(type: string, payload: unknown): RoomServerEvent {
    this.eventSeq += 1;
    return {
      type,
      event_id: `evt_${String(this.eventSeq).padStart(8, '0')}`,
      room_id: this.roomId,
      sent_at: now(),
      payload,
    } as RoomServerEvent;
  }

  /**
   * Recipient-specific projection for `self`. In the room's lobby there is no board, only
   * the last result's summary; on a match or its result the board is projected for the
   * seat: a Spymaster sees every color, anyone else only revealed ones.
   */
  private projectRoom(): Room {
    const room = structuredClone(this.room);
    const me = this.find(this.self.user_id);
    if (!me || me.state === 'IN_LOBBY' || !this.game) {
      room.game = null;
      if (this.lastGame && me?.state === 'IN_LOBBY') room.last_game = { ...this.lastGame };
      return room;
    }
    const game = structuredClone(this.game);
    const spymaster = me.role === 'SPYMASTER';
    game.board = game.board.map((card, i) => ({
      ...card,
      color: card.revealed || spymaster ? (this.hiddenColors[i] as CardColor) : null,
    }));
    room.game = game;
    return room;
  }

  private fullBoard(): Card[] {
    return (this.game?.board ?? []).map((card, i) => ({
      ...card,
      color: this.hiddenColors[i] as CardColor,
    }));
  }

  private computeStartable(): boolean {
    const players = this.room.players;
    if (players.some((m) => m.state === 'POST_GAME')) return false;
    const participants = players.filter((m) => m.role !== 'SPECTATOR');
    if (participants.length < ROOM_CAPACITY.min) return false;
    if (participants.some((m) => !m.team || !m.ready || m.state !== 'IN_LOBBY')) return false;
    return TEAMS.every(
      (team) =>
        participants.filter((m) => m.team === team && m.role === 'SPYMASTER').length === 1 &&
        participants.some((m) => m.team === team && m.role === 'OPERATIVE'),
    );
  }

  private membershipPayload(member: RoomMember) {
    return {
      player: { ...member },
      host_user_id: this.room.host_user_id,
      player_count: this.room.player_count,
      room_status: this.room.status,
    };
  }

  private newMember(
    player: MockPlayer,
    isHost: boolean,
    joinedAt: string,
    state: RoomMember['state'] = 'IN_LOBBY',
  ): RoomMember {
    return {
      user_id: player.user_id,
      username: player.username,
      avatar_url: player.avatar_url ?? mockDirectory.user(player.user_id)?.avatar_url ?? '',
      team: null,
      role: 'SPECTATOR',
      ready: false,
      state,
      is_host: isHost,
      joined_at: joinedAt,
    };
  }

  private pendingIds(): number[] {
    return this.room.players.filter((p) => p.state === 'POST_GAME').map((p) => p.user_id);
  }

  private recount(): void {
    this.room.player_count = this.room.players.length;
  }

  private find(userId: number): RoomMember | undefined {
    return this.room.players.find((p) => p.user_id === userId);
  }

  private require(userId: number): RoomMember {
    const member = this.find(userId);
    if (!member)
      throw new MockActionError(
        'NOT_ROOM_MEMBER',
        `User ${userId} is not a member of room ${this.roomId}.`,
        { room_id: this.roomId, user_id: userId },
      );
    return member;
  }

  private requireSpymasterSeat(team: Team, userId: number): void {
    const holder = this.room.players.find(
      (p) => p.team === team && p.role === 'SPYMASTER' && p.user_id !== userId,
    );
    if (holder) {
      throw new MockActionError('ROLE_CONFLICT', `${team} already has a Spymaster.`, {
        team,
        occupied_by_user_id: holder.user_id,
      });
    }
  }

  private requireLobby(): void {
    if (this.room.status !== 'WAITING' && this.room.status !== 'COUNTDOWN') this.invalidState();
  }

  private requireGame(): Game {
    const game = this.game;
    if (!game || this.room.status !== 'IN_GAME') {
      if (game && game.status !== 'IN_PROGRESS') {
        throw new MockActionError(
          'GAME_ALREADY_FINISHED',
          `Game ${game.game_id} has already finished.`,
          { game_id: game.game_id, winner: game.winner },
        );
      }
      this.invalidState();
    }
    return game;
  }

  /** Clue, guess and pass are refused while the game waits for players. */
  private requireUnpaused(game: Game): void {
    if (game.current_turn.phase === 'PAUSED_FOR_PLAYERS') this.invalidState();
  }

  private requireGuesser(member: RoomMember): void {
    const game = this.requireGame();
    this.requireUnpaused(game);
    if (member.role !== 'OPERATIVE')
      throw new MockActionError(
        'ROLE_FORBIDDEN',
        'Only an active-team Operative may guess a card.',
        { required_role: 'OPERATIVE' },
      );
    if (game.current_turn.team !== member.team)
      throw new MockActionError(
        'NOT_YOUR_TURN',
        `${member.team} cannot guess while ${game.current_turn.team} is the active team.`,
        { active_team: game.current_turn.team },
      );
    if (game.current_turn.phase !== 'GUESSING') this.invalidState();
  }

  private activeTeam(): Team {
    return this.requireGame().current_turn.team;
  }

  private spymasterOf(team: Team): number {
    const id = this.room.players.find((p) => p.team === team && p.role === 'SPYMASTER')?.user_id;
    if (id === undefined) throw new MockActionError('ROLE_FORBIDDEN', `${team} has no Spymaster.`);
    return id;
  }

  private operativeOf(team: Team): number {
    const id = this.room.players.find((p) => p.team === team && p.role === 'OPERATIVE')?.user_id;
    if (id === undefined) throw new MockActionError('ROLE_FORBIDDEN', `${team} has no Operative.`);
    return id;
  }

  private invalidState(): never {
    throw new MockActionError(
      'INVALID_ROOM_STATE',
      `This action is not allowed while room status is ${this.room.status}.`,
      { status: this.room.status },
    );
  }
}

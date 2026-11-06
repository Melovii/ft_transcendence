package postgres

import (
	"context"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"game-session/game"
	"game-session/room"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type roleList []game.Role

func (l roleList) literal() string {
	parts := make([]string, len(l))
	for i, r := range l {
		parts[i] = string(r)
	}
	return "{" + strings.Join(parts, ",") + "}"
}

func (roleList) GormDataType() string { return "text[]" }

func (l roleList) Value() (driver.Value, error) { return l.literal(), nil }

func (l roleList) GormValue(_ context.Context, _ *gorm.DB) clause.Expr {
	return clause.Expr{SQL: "?::text[]", Vars: []any{l.literal()}}
}

func (l *roleList) Scan(src any) error {
	var text string
	switch v := src.(type) {
	case nil:
		*l = roleList{}
		return nil
	case string:
		text = v
	case []byte:
		text = string(v)
	default:
		return fmt.Errorf("roleList: unsupported type %T", src)
	}
	*l = roleList{}
	text = strings.Trim(text, "{}")
	if text == "" {
		return nil
	}
	for _, part := range strings.Split(text, ",") {
		*l = append(*l, game.Role(strings.Trim(part, `"`)))
	}
	return nil
}

type jsonb []byte

func (j jsonb) GormValue(_ context.Context, _ *gorm.DB) clause.Expr {
	return clause.Expr{SQL: "?::jsonb", Vars: []any{string(j)}}
}

func (j *jsonb) Scan(src any) error {
	switch v := src.(type) {
	case nil:
		*j = nil
	case string:
		*j = jsonb(v)
	case []byte:
		*j = append(jsonb{}, v...)
	default:
		return fmt.Errorf("jsonb: unsupported type %T", src)
	}
	return nil
}

var _ driver.Valuer = jsonb(nil)

func (j jsonb) Value() (driver.Value, error) { return string(j), nil }

type gameRow struct {
	GameID                 int64 `gorm:"primaryKey"`
	RoomID                 int64
	StartingTeam           game.Team
	Phase                  game.Phase
	CurrentTeam            game.Team
	ClueWord               *string
	ClueNumber             *int
	GuessesRemaining       *int
	TurnDeadlineAt         *time.Time
	TurnTimerSeconds       *int
	PhaseBeforePause       *game.Phase
	RemainingOnPauseMs     *int64
	StaffingTimeoutSeconds int
	RedMissingRoles        roleList
	BlueMissingRoles       roleList
	RedStaffingDeadlineAt  *time.Time
	BlueStaffingDeadlineAt *time.Time
	Winner                 *game.Team
	EndReason              *game.EndReason
	StartedAt              time.Time
	FinishedAt             *time.Time
}

func (gameRow) TableName() string { return "games" }

var gameUpdateColumns = []string{
	"phase", "current_team", "clue_word", "clue_number", "guesses_remaining", "turn_deadline_at",
	"turn_timer_seconds", "phase_before_pause", "remaining_on_pause_ms",
	"red_missing_roles", "blue_missing_roles", "red_staffing_deadline_at", "blue_staffing_deadline_at",
	"winner", "end_reason", "finished_at",
}

type gameCardRow struct {
	GameID   int64 `gorm:"primaryKey"`
	CardID   int   `gorm:"primaryKey"`
	Word     string
	Color    game.CardColor
	Revealed bool
}

func (gameCardRow) TableName() string { return "game_cards" }

type gameHistoryRow struct {
	GameID       int64 `gorm:"primaryKey"`
	Seq          int   `gorm:"primaryKey"`
	Type         game.HistoryEntryType
	At           time.Time
	Team         *game.Team
	UserID       *int64
	Username     *string
	ClueWord     *string
	ClueNumber   *int
	CardID       *int
	Word         *string
	Color        *game.CardColor
	PreviousTeam *game.Team
	Reason       *string
}

func (gameHistoryRow) TableName() string { return "game_history" }

type gamePlayerRow struct {
	GameID int64 `gorm:"primaryKey"`
	UserID int64 `gorm:"primaryKey"`
	Team   game.Team
	Role   game.Role
}

func (gamePlayerRow) TableName() string { return "game_players" }

type outboxRow struct {
	EventID       string `gorm:"primaryKey;default:gen_random_uuid()"`
	RoomID        int64
	EventType     string
	OutboxContent jsonb
	CreatedAt     time.Time `gorm:"autoCreateTime"`
	PublishedAt   *time.Time
	RoomVersion   int64
}

func (outboxRow) TableName() string { return "outbox_events" }

func toGameRow(roomID int64, rec game.GameRecord) gameRow {
	row := gameRow{
		GameID:                 rec.GameID,
		RoomID:                 roomID,
		StartingTeam:           rec.StartingTeam,
		Phase:                  rec.CurrentTurn.Phase,
		CurrentTeam:            rec.CurrentTurn.Team,
		GuessesRemaining:       rec.CurrentTurn.GuessesRemaining,
		TurnDeadlineAt:         rec.CurrentTurn.DeadlineAt,
		TurnTimerSeconds:       rec.Timing.TurnTimerSeconds,
		PhaseBeforePause:       rec.Timing.PhaseBeforePause,
		RemainingOnPauseMs:     rec.Timing.RemainingOnPauseMs,
		StaffingTimeoutSeconds: rec.Staffing.StaffingTimeoutSeconds,
		RedMissingRoles:        roleList(rec.Staffing.Red.MissingRoles),
		BlueMissingRoles:       roleList(rec.Staffing.Blue.MissingRoles),
		RedStaffingDeadlineAt:  rec.Staffing.Red.DeadlineAt,
		BlueStaffingDeadlineAt: rec.Staffing.Blue.DeadlineAt,
		Winner:                 rec.Result.Winner,
		EndReason:              rec.Result.EndReason,
		StartedAt:              rec.StartedAt,
		FinishedAt:             rec.Result.FinishedAt,
	}
	if rec.CurrentTurn.Clue != nil {
		word, number := rec.CurrentTurn.Clue.Word, rec.CurrentTurn.Clue.Number
		row.ClueWord, row.ClueNumber = &word, &number
	}
	return row
}

func toCardRows(gameID int64, cards []game.CardRecord) []gameCardRow {
	rows := make([]gameCardRow, len(cards))
	for i, c := range cards {
		rows[i] = gameCardRow{GameID: gameID, CardID: c.CardID, Word: c.Word, Color: c.Color, Revealed: c.Revealed}
	}
	return rows
}

func toHistoryRows(gameID int64, history []game.HistoryEntry) []gameHistoryRow {
	rows := make([]gameHistoryRow, len(history))
	for i, h := range history {
		row := gameHistoryRow{
			GameID: gameID, Seq: h.Seq, Type: h.Type, At: h.At, Team: h.Team,
			UserID: h.UserID, Username: h.Username, CardID: h.CardID, Word: h.Word,
			Color: h.Color, PreviousTeam: h.PreviousTeam, Reason: h.Reason,
		}
		if h.Clue != nil {
			word, number := h.Clue.Word, h.Clue.Number
			row.ClueWord, row.ClueNumber = &word, &number
		}
		rows[i] = row
	}
	return rows
}

func fromGameRows(row gameRow, cards []gameCardRow, history []gameHistoryRow) game.GameRecord {
	rec := game.GameRecord{
		GameID:       row.GameID,
		StartingTeam: row.StartingTeam,
		CurrentTurn: game.CurrentTurn{
			Team:             row.CurrentTeam,
			Phase:            row.Phase,
			GuessesRemaining: row.GuessesRemaining,
			DeadlineAt:       row.TurnDeadlineAt,
		},
		Timing: game.TimingRecord{
			TurnTimerSeconds:   row.TurnTimerSeconds,
			PhaseBeforePause:   row.PhaseBeforePause,
			RemainingOnPauseMs: row.RemainingOnPauseMs,
		},
		Staffing: game.StaffingRecord{
			StaffingTimeoutSeconds: row.StaffingTimeoutSeconds,
			Red:                    game.TeamStaffing{MissingRoles: []game.Role(row.RedMissingRoles), DeadlineAt: row.RedStaffingDeadlineAt},
			Blue:                   game.TeamStaffing{MissingRoles: []game.Role(row.BlueMissingRoles), DeadlineAt: row.BlueStaffingDeadlineAt},
		},
		Result:    game.ResultRecord{Winner: row.Winner, EndReason: row.EndReason, FinishedAt: row.FinishedAt},
		StartedAt: row.StartedAt,
		Cards:     make([]game.CardRecord, len(cards)),
		History:   make([]game.HistoryEntry, len(history)),
	}
	if row.ClueWord != nil && row.ClueNumber != nil {
		rec.CurrentTurn.Clue = &game.Clue{Word: *row.ClueWord, Number: *row.ClueNumber}
	}
	for i, c := range cards {
		rec.Cards[i] = game.CardRecord{CardID: c.CardID, Word: c.Word, Color: c.Color, Revealed: c.Revealed}
	}
	for i, h := range history {
		entry := game.HistoryEntry{
			Seq: h.Seq, Type: h.Type, At: h.At, Team: h.Team, UserID: h.UserID, Username: h.Username,
			CardID: h.CardID, Word: h.Word, Color: h.Color, PreviousTeam: h.PreviousTeam, Reason: h.Reason,
		}
		if h.ClueWord != nil && h.ClueNumber != nil {
			entry.Clue = &game.Clue{Word: *h.ClueWord, Number: *h.ClueNumber}
		}
		rec.History[i] = entry
	}
	return rec
}

// SELECT * FROM games WHERE room_id = 1 ORDER BY game_id DESC LIMIT 1;
// SELECT * FROM game_cards WHERE game_id = 7 ORDER BY card_id;
// SELECT * FROM game_history WHERE game_id = 7 ORDER BY seq;
func (s *Store) LoadCurrentGame(roomID int64) (*game.Game, error) {
	var row gameRow
	err := s.db.Where("room_id = ?", roomID).Order("game_id DESC").First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	cards, history, err := s.gameDetails(row.GameID)
	if err != nil {
		return nil, err
	}
	return game.FromRecord(fromGameRows(row, cards, history))
}

func (s *Store) gameDetails(gameID int64) ([]gameCardRow, []gameHistoryRow, error) {
	var cards []gameCardRow
	if err := s.db.Where("game_id = ?", gameID).Order("card_id").Find(&cards).Error; err != nil {
		return nil, nil, err
	}
	var history []gameHistoryRow
	if err := s.db.Where("game_id = ?", gameID).Order("seq").Find(&history).Error; err != nil {
		return nil, nil, err
	}
	return cards, history, nil
}

// SELECT last_game_id FROM rooms WHERE room_id = 1;
// SELECT * FROM games WHERE game_id = 7;
// SELECT * FROM game_cards WHERE game_id = 7;
// SELECT * FROM game_players WHERE game_id = 7;
func (s *Store) LoadLastGameResult(roomID int64) (*room.LastGameView, error) {
	var lastGameID *int64
	if err := s.db.Table("rooms").Select("last_game_id").Where("room_id = ?", roomID).Scan(&lastGameID).Error; err != nil {
		return nil, err
	}
	if lastGameID == nil {
		return nil, nil
	}
	var row gameRow
	if err := s.db.First(&row, *lastGameID).Error; err != nil {
		return nil, notFound(err, room.ErrGameNotFound)
	}
	if row.Winner == nil || row.EndReason == nil || row.FinishedAt == nil {
		return nil, game.ErrInvalidGameState
	}
	var cards []gameCardRow
	if err := s.db.Where("game_id = ?", row.GameID).Find(&cards).Error; err != nil {
		return nil, err
	}
	var players []gamePlayerRow
	if err := s.db.Where("game_id = ?", row.GameID).Order("user_id").Find(&players).Error; err != nil {
		return nil, err
	}

	score := game.Score{}
	for _, c := range cards {
		if !c.Revealed {
			continue
		}
		switch c.Color {
		case game.CardColorRed:
			score.Red++
		case game.CardColorBlue:
			score.Blue++
		}
	}
	loser := game.TeamRed
	if *row.Winner == game.TeamRed {
		loser = game.TeamBlue
	}
	view := &room.LastGameView{
		GameID:     row.GameID,
		Status:     game.GameStatusFinished,
		Winner:     *row.Winner,
		Loser:      loser,
		EndReason:  *row.EndReason,
		Score:      score,
		FinishedAt: *row.FinishedAt,
		RoomID:     roomID,
		StartedAt:  row.StartedAt,
		Players:    make([]room.FinalizedPlayer, len(players)),
	}
	for i, p := range players {
		view.Players[i] = room.FinalizedPlayer{UserID: p.UserID, Team: p.Team, Role: p.Role}
	}
	return view, nil
}

// SELECT nextval(pg_get_serial_sequence('games', 'game_id'));
func (s *Store) NextGameID() (int64, error) {
	var id int64
	err := s.db.Raw("SELECT nextval(pg_get_serial_sequence('games', 'game_id'))").Scan(&id).Error
	return id, err
}

// INSERT INTO games (game_id, room_id, starting_team, phase, current_team, staffing_timeout_seconds, started_at) VALUES (7, 1, 'RED', 'WAITING_FOR_CLUE', 'RED', 120, now());
// INSERT INTO game_cards (game_id, card_id, word, color) VALUES (7, 1, 'AFRICA', 'RED'), (7, 2, 'AGENT', 'BLUE');
// INSERT INTO game_history (game_id, seq, type, at) VALUES (7, 1, 'GAME_STARTED', now());
func insertGame(tx *gorm.DB, roomID int64, g *game.Game) error {
	rec := g.ToRecord()
	row := toGameRow(roomID, rec)
	if err := tx.Create(&row).Error; err != nil {
		return err
	}
	if err := tx.CreateInBatches(toCardRows(rec.GameID, rec.Cards), 25).Error; err != nil {
		return err
	}
	return insertHistory(tx, rec)
}

// INSERT INTO game_history (game_id, seq, type, at, team, user_id, clue_word, clue_number) VALUES (7, 2, 'CLUE_GIVEN', now(), 'RED', 42, 'hint', 2) ON CONFLICT (game_id, seq) DO NOTHING;
func insertHistory(tx *gorm.DB, rec game.GameRecord) error {
	rows := toHistoryRows(rec.GameID, rec.History)
	if len(rows) == 0 {
		return nil
	}
	return tx.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(rows, 50).Error
}

// UPDATE games SET phase = 'GUESSING', current_team = 'RED', clue_word = 'hint', clue_number = 2, guesses_remaining = 3, turn_deadline_at = now() + interval '60 seconds' WHERE game_id = 7;
// UPDATE game_cards SET revealed = true WHERE game_id = 7 AND card_id IN (3, 11);
// INSERT INTO game_history (game_id, seq, type, at, team, card_id, word, color) VALUES (7, 3, 'CARD_REVEALED', now(), 'RED', 3, 'AFRICA', 'RED') ON CONFLICT (game_id, seq) DO NOTHING;
func updateGame(tx *gorm.DB, g *game.Game) error {
	rec := g.ToRecord()
	row := toGameRow(0, rec)
	if err := tx.Model(&gameRow{GameID: rec.GameID}).Select(gameUpdateColumns).Updates(&row).Error; err != nil {
		return err
	}
	revealed := make([]int, 0, len(rec.Cards))
	for _, c := range rec.Cards {
		if c.Revealed {
			revealed = append(revealed, c.CardID)
		}
	}
	if len(revealed) > 0 {
		if err := tx.Model(&gameCardRow{}).Where("game_id = ? AND card_id IN ?", rec.GameID, revealed).Update("revealed", true).Error; err != nil {
			return err
		}
	}
	return insertHistory(tx, rec)
}

// UPDATE room_members SET state = 'IN_GAME', ready = true WHERE user_id = 42;
func saveMembers(tx *gorm.DB, members []room.RoomMember) error {
	for i := range members {
		if err := tx.Save(&members[i]).Error; err != nil {
			return err
		}
	}
	return nil
}

type finalizedPlayerEvent struct {
	UserID int64     `json:"user_id"`
	Team   game.Team `json:"team"`
	Role   game.Role `json:"role"`
}

type matchFinalizedEvent struct {
	GameID     int64                  `json:"game_id"`
	RoomID     int64                  `json:"room_id"`
	Winner     game.Team              `json:"winner"`
	Loser      game.Team              `json:"loser"`
	EndReason  game.EndReason         `json:"end_reason"`
	Score      game.Score             `json:"score"`
	StartedAt  time.Time              `json:"started_at"`
	FinishedAt time.Time              `json:"finished_at"`
	Players    []finalizedPlayerEvent `json:"players"`
}

func toMatchFinalizedEvent(lastGame *room.LastGameView) matchFinalizedEvent {
	event := matchFinalizedEvent{
		GameID:     lastGame.GameID,
		RoomID:     lastGame.RoomID,
		Winner:     lastGame.Winner,
		Loser:      lastGame.Loser,
		EndReason:  lastGame.EndReason,
		Score:      lastGame.Score,
		StartedAt:  lastGame.StartedAt,
		FinishedAt: lastGame.FinishedAt,
		Players:    make([]finalizedPlayerEvent, len(lastGame.Players)),
	}
	for i, p := range lastGame.Players {
		event.Players[i] = finalizedPlayerEvent{UserID: p.UserID, Team: p.Team, Role: p.Role}
	}
	return event
}

// INSERT INTO outbox_events (room_id, event_type, outbox_content, room_version) VALUES (1, 'match.finalized', '{"game_id": 7, "winner": "RED"}', 12);
func insertOutbox(tx *gorm.DB, r *room.Room, eventType string, payload any) error {
	content, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	row := outboxRow{RoomID: r.RoomID, EventType: eventType, OutboxContent: jsonb(content), RoomVersion: int64(r.RoomVersion)}
	return tx.Omit("event_id", "created_at").Create(&row).Error
}

// UPDATE games SET phase = 'GUESSING', current_team = 'RED', clue_word = 'hint', clue_number = 2 WHERE game_id = 7;
func (s *Store) SaveGame(g *game.Game) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		return updateGame(tx, g)
	})
}

// UPDATE rooms SET status = 'IN_GAME', countdown_ends_at = NULL WHERE room_id = 1;
// UPDATE room_members SET state = 'IN_GAME', ready = true WHERE user_id = 42;
// INSERT INTO games (game_id, room_id, starting_team, phase, current_team, staffing_timeout_seconds, started_at) VALUES (7, 1, 'RED', 'WAITING_FOR_CLUE', 'RED', 120, now());
// INSERT INTO game_cards (game_id, card_id, word, color) VALUES (7, 1, 'AFRICA', 'RED');
// INSERT INTO game_history (game_id, seq, type, at) VALUES (7, 1, 'GAME_STARTED', now());
func (s *Store) SaveGameStart(r *room.Room, members []room.RoomMember, g *game.Game) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(r).Error; err != nil {
			return err
		}
		if err := saveMembers(tx, members); err != nil {
			return err
		}
		return insertGame(tx, r.RoomID, g)
	})
}

// UPDATE rooms SET status = 'POST_GAME', post_game_ends_at = now() + interval '60 seconds' WHERE room_id = 1;
// UPDATE room_members SET state = 'POST_GAME', ready = false WHERE user_id = 42;
// UPDATE games SET phase = 'GAME_OVER', winner = 'RED', end_reason = 'ALL_TEAM_CARDS_REVEALED', finished_at = now() WHERE game_id = 7;
// DELETE FROM room_members WHERE room_id = 1;
// UPDATE rooms SET last_game_id = 7 WHERE room_id = 1;
// INSERT INTO game_players (game_id, user_id, team, role) VALUES (7, 42, 'RED', 'SPYMASTER'), (7, 43, 'RED', 'OPERATIVE');
// INSERT INTO outbox_events (room_id, event_type, outbox_content, room_version) VALUES (1, 'match.finalized', '{"game_id": 7, "winner": "RED"}', 12);
func (s *Store) SaveGameEnd(r *room.Room, members []room.RoomMember, g *game.Game, lastGame *room.LastGameView) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(r).Error; err != nil {
			return err
		}
		if err := saveMembers(tx, members); err != nil {
			return err
		}
		if g != nil {
			if err := updateGame(tx, g); err != nil {
				return err
			}
		}
		if r.Status == room.StatusClosed {
			if err := tx.Where("room_id = ?", r.RoomID).Delete(&room.RoomMember{}).Error; err != nil {
				return err
			}
		}
		if lastGame == nil {
			if g == nil {
				return nil
			}
			return insertOutbox(tx, r, "game.cancelled", map[string]any{"room_id": r.RoomID, "game_id": g.GameID()})
		}
		if err := tx.Table("rooms").Where("room_id = ?", r.RoomID).Update("last_game_id", lastGame.GameID).Error; err != nil {
			return err
		}
		players := make([]gamePlayerRow, len(lastGame.Players))
		for i, p := range lastGame.Players {
			players[i] = gamePlayerRow{GameID: lastGame.GameID, UserID: p.UserID, Team: p.Team, Role: p.Role}
		}
		if len(players) > 0 {
			if err := tx.CreateInBatches(players, 20).Error; err != nil {
				return err
			}
		}
		return insertOutbox(tx, r, "match.finalized", toMatchFinalizedEvent(lastGame))
	})
}

// UPDATE rooms SET countdown_ends_at = NULL WHERE room_id = 1;
// UPDATE room_members SET team = 'RED', role = 'SPYMASTER', ready = false WHERE user_id = 43;
// UPDATE games SET phase = 'WAITING_FOR_CLUE', phase_before_pause = NULL, red_missing_roles = '{}' WHERE game_id = 7;
func (s *Store) SaveSeatInGame(r *room.Room, member room.RoomMember, g *game.Game) error {
	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(r).Error; err != nil {
			return err
		}
		if err := tx.Save(&member).Error; err != nil {
			return err
		}
		return updateGame(tx, g)
	})
	if isUniqueViolation(err, constraintOneSpymaster) {
		return room.ErrRoleConflict
	}
	return err
}

// UPDATE rooms SET host_user_id = 44, countdown_ends_at = NULL WHERE room_id = 1;
// DELETE FROM room_members WHERE room_id = 1 AND user_id = 43;
// UPDATE games SET phase = 'PAUSED_FOR_PLAYERS', phase_before_pause = 'GUESSING', red_missing_roles = '{SPYMASTER}' WHERE game_id = 7;
// INSERT INTO outbox_events (room_id, event_type, outbox_content, room_version) VALUES (1, 'player.penalized', '{"user_id": 43, "role": "SPYMASTER"}', 12);
func (s *Store) SaveLeave(r *room.Room, departedUserID int64, g *game.Game, penalty *room.Penalty) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(r).Error; err != nil {
			return err
		}
		if err := tx.Where("room_id = ? AND user_id = ?", r.RoomID, departedUserID).Delete(&room.RoomMember{}).Error; err != nil {
			return err
		}
		if g != nil {
			if err := updateGame(tx, g); err != nil {
				return err
			}
		}
		if penalty != nil {
			return insertOutbox(tx, r, "player.penalized", penalty)
		}
		return nil
	})
}

/**
 * Match history bindings — Bruno `rest-api/02 - Users & Profile/get-match-history.yml`.
 *
 * Wins, losses and level come from the profile payloads; this endpoint backs the match
 * list. There is no leaderboard endpoint in this contract.
 */

import { apiRequest } from '@shared/api';
import type { MatchHistoryQuery, MatchHistoryResponse } from '@shared/types';

export const getMatchHistory = (query: MatchHistoryQuery = {}): Promise<MatchHistoryResponse> =>
  apiRequest('/users/me/matches', { query });

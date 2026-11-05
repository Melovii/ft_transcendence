# ft_transcendence Bruno API contract

This repository is the development, Git-native API contract for the `ft_transcendence` Codenames-style game. Accounts are email + username + password. Open the repository root as a Bruno workspace.

## Collections

- `collections/v1/rest-api` / `collections/v1/websocket` — stable v1 contracts.
- `collections/v2/game-rest-api` / `collections/v2/game-websocket` — v2 room and game lifecycle.
- `collections/v2/chat-rest-api` / `collections/v2/chat-websocket` — durable Chat v2 channels and live gateway.
- `collections/internal/v1/service-rest-api` — private service-to-service operations, service credentials and profile provisioning; never browser-facing.
- `environments/local.yml` — safe localhost defaults and blank secret session values.
- `workspace.yml` — product rules, state machines, fixtures, privacy, and protocol boundaries.

Auth Service (`auth-service`) and User Service (`user-service`) are independently deployable services. Auth owns account identity, credentials, Google OAuth and sessions; User owns canonical usernames, profiles, avatars, social relationships, reports and current presence aggregation. They share an Auth-assigned `user_id` and coordinate profile provisioning and account deletion through internal REST and durable operations. See `workspace.yml`, Auth and User Service Boundary, for ownership, routing and private integration contracts.

Chat-service is Channel Service; Chat Gateway is a separate socket service. Chat Gateway validates sessions with Auth, and Channel Service obtains current friendship/block verdicts from User. PostgreSQL owns each service's domain state, request ledgers/inboxes, read positions, and transactional outboxes. Gateways keep live socket registries in memory, and User's internal REST queries supply current presence. Commands and committed events travel through RabbitMQ; User and Channel Service each publish their own outbox events.

API v1 room/game/chat behavior remains available; its session and own-profile responses only gain the additive `active_room_api_version` recovery field. Game v2 and Chat v2 are separate Bruno collections and use `gameApiVersion: v2` and `chatApiVersion: v2`; frontend code must not mix room protocol versions within one session.

Game v2 rooms default to a capacity of **20** (configurable from **4 to 20**) and the English word pack. Supported word-pack languages are **`en`**, **`tr`**, and **`fr`**; this room setting is separate from the application interface language.

On application bootstrap, `GET /api/v1/auth/session` returns both `active_room_id` and `active_room_api_version`; use them together to restore the matching REST/WebSocket pair after refresh or reconnect.

## Local use

1. Start the development API at `http://localhost:3000`.
2. Select the `local` environment.
3. Register through REST API v1; identity and refresh endpoints remain v1 for every collection.
4. For the stable flow, create or join through REST v1 and connect to `{{wsUrl}}/ws/{{apiVersion}}/rooms/{{roomId}}`.
5. For the new flow, create or join through Game REST v2, connect gameplay to `{{wsUrl}}/ws/{{gameApiVersion}}/rooms/{{roomId}}`, and connect chat to `{{chatWsUrl}}/ws/{{chatApiVersion}}/channels`.
6. Authentication is cookie-only: `ft_session` attaches automatically on same-origin upgrades from Bruno's cookie jar. Use message examples only when their documented preconditions hold.
7. For Chat v2 read receipts, send `chat.channel.read` only after displaying messages in an active visible conversation. Channel lists include `read_state` and `unread_count`; history includes `read_state` and `read_by`; `chat.channel.read.updated` synchronizes live clients. The read-command and read-event requests document monotonic updates, retries, and ROOM visibility boundaries.

The contract can lead implementation; a failing request can mean the backend has not yet implemented the specified behavior. Bruno authenticates through its cookie jar exactly like a browser — `ft_session`/`ft_refresh` are set automatically by Register/Login/Refresh, never held in a variable or committed.

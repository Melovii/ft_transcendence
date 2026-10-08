/** Route paths, single source for links and guards. Profile is a modal, not a route. */
export const ROUTES = {
  landing: '/',
  login: '/login',
  register: '/register',
  lobby: '/lobby',
  room: '/room/:roomId',
  privacy: '/privacy',
  terms: '/terms',
} as const;

export const roomPath = (roomId: number | string): string => `/room/${roomId}`;

import { onRequest } from 'firebase-functions/v2/https';
import { createHealthPayload } from './health.js';
import { HEALTH_OPTIONS } from './runtime.js';
export { ensureUserProfile } from './profile.js';
export { createTeam } from './teams.js';
export { updateMembership } from './members.js';
export { cancelInvite, consumeInvite, createInvite } from './invites.js';
export { changeLinkStatus, createLink, updateLinkDestination } from './links.js';
export { redirectLink } from './redirect.js';

export const health = onRequest(HEALTH_OPTIONS, (request, response) => {
  if (request.method !== 'GET') {
    response.set('Allow', 'GET').status(405).send('Method Not Allowed');
    return;
  }

  response.set('Cache-Control', 'no-store').status(200).json(createHealthPayload());
});

import { expect, test, type Page } from '@playwright/test';

test.setTimeout(90_000);

async function completeGooglePopup(
  popup: Page,
  email: string,
  displayName: string,
  normalizeMobileViewport: boolean,
) {
  await popup.bringToFront();
  if (normalizeMobileViewport) await popup.setViewportSize({ width: 600, height: 800 });
  const addAccount = popup.getByRole('button', { name: 'Add new account' });
  await addAccount.click();
  const emailInput = popup.locator('#email-input');
  if (!(await emailInput.isVisible())) {
    await popup.bringToFront();
    await addAccount.click({ force: true });
  }
  await expect(emailInput).toBeVisible();
  await emailInput.fill(email);
  await popup.locator('#display-name-input').fill(displayName);
  const popupClosed = popup.waitForEvent('close');
  await popup.getByRole('button', { name: 'Sign in with Google' }).click();
  await popupClosed;
}

test('entra com Google emulado, persiste perfil e encerra a sessão', async ({
  browser,
  page,
  request,
}, testInfo) => {
  const normalizeMobilePopup = testInfo.project.name === 'mobile-chromium';
  const [firestoreReset, authReset] = await Promise.all([
    request.delete(
      'http://127.0.0.1:8080/emulator/v1/projects/demo-shortener/databases/(default)/documents',
    ),
    request.delete('http://127.0.0.1:9099/emulator/v1/projects/demo-shortener/accounts'),
  ]);
  expect(firestoreReset.ok()).toBe(true);
  expect(authReset.ok()).toBe(true);
  await page.goto('/app?filtro=meus');

  await expect(page.getByRole('heading', { name: 'Acesso interno' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeHidden();

  const ownerPopupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Entrar com Google' }).focus();
  await page.keyboard.press('Enter');
  const ownerPopup = await ownerPopupPromise;
  await completeGooglePopup(ownerPopup, 'ana.e2e@example.test', 'Ana E2E', normalizeMobilePopup);

  await page.waitForURL(/\/app\?filtro=meus$/);
  await expect(
    page.getByRole('heading', { name: 'Crie seu primeiro espaço de trabalho' }),
  ).toBeVisible();
  await expect(page.getByText('ana.e2e@example.test')).toBeVisible();

  await page.getByRole('button', { name: 'Criar primeira equipe' }).click();
  await page.getByRole('textbox', { name: 'Nome da nova equipe' }).fill('Comunicação');
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/app\/equipes\/.+\/links$/);
  await expect(page.getByRole('heading', { name: 'Comunicação', exact: true })).toBeVisible();
  await expect(page.getByText('Administrador')).toBeVisible();

  await page.getByRole('button', { name: /Menu de /i }).click();
  await page.getByRole('menuitem', { name: 'Adicionar equipe' }).click();
  await page.getByRole('textbox', { name: 'Nome da nova equipe' }).fill('Eventos');
  await page.getByRole('button', { name: 'Criar equipe' }).click();
  await expect(page.getByRole('heading', { name: 'Eventos', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Equipe ativa' }).selectOption({ label: 'Comunicação' });
  await expect(page.getByRole('heading', { name: 'Comunicação', exact: true })).toBeVisible();

  const profilesResponse = await request.get(
    'http://127.0.0.1:8080/v1/projects/demo-shortener/databases/(default)/documents/users',
    { headers: { Authorization: 'Bearer owner' } },
  );
  expect(profilesResponse.ok()).toBe(true);
  const profiles = (await profilesResponse.json()) as {
    documents: Array<{
      name: string;
      fields: Record<string, { stringValue?: string }>;
    }>;
  };
  const profile = profiles.documents.find(
    (document) => document.fields['email']?.stringValue === 'ana.e2e@example.test',
  );
  expect(profile).toBeDefined();
  expect(Object.keys(profile?.fields ?? {}).sort()).toEqual([
    'createdAt',
    'displayName',
    'email',
    'uid',
    'updatedAt',
  ]);
  expect(profile?.name.endsWith(`/users/${profile.fields['uid']?.stringValue}`)).toBe(true);

  const uid = profile?.fields['uid']?.stringValue;
  if (uid === undefined) throw new Error('O perfil E2E não contém UID.');
  const teamsResponse = await request.get(
    'http://127.0.0.1:8080/v1/projects/demo-shortener/databases/(default)/documents/teams',
    { headers: { Authorization: 'Bearer owner' } },
  );
  expect(teamsResponse.ok()).toBe(true);
  const teams = (await teamsResponse.json()) as {
    documents: Array<{
      name: string;
      fields: Record<string, { stringValue?: string }>;
    }>;
  };
  expect(teams.documents).toHaveLength(2);
  expect(teams.documents.map((team) => team.fields['name']?.stringValue).sort()).toEqual([
    'Comunicação',
    'Eventos',
  ]);
  for (const team of teams.documents) {
    const teamId = team.name.split('/').at(-1);
    const memberResponse = await request.get(
      `http://127.0.0.1:8080/v1/projects/demo-shortener/databases/(default)/documents/teams/${teamId}/members/${uid}`,
      { headers: { Authorization: 'Bearer owner' } },
    );
    expect(memberResponse.ok()).toBe(true);
    const member = (await memberResponse.json()) as {
      fields: Record<string, { stringValue?: string }>;
    };
    expect(member.fields['uid']?.stringValue).toBe(uid);
    expect(member.fields['teamId']?.stringValue).toBe(teamId);
    expect(member.fields['role']?.stringValue).toBe('admin');
  }

  const communicationTeam = teams.documents.find(
    (team) => team.fields['name']?.stringValue === 'Comunicação',
  );
  const communicationTeamId = communicationTeam?.name.split('/').at(-1);
  if (communicationTeamId === undefined) throw new Error('A equipe Comunicação não foi criada.');

  await page.getByRole('link', { name: 'Convites' }).click();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString().slice(0, 16);
  await page.getByLabel('Validade do convite').fill(tomorrow);
  await page.getByRole('button', { name: 'Criar convite' }).click();
  const inviteLink = await page.getByLabel('Link do convite').inputValue();
  expect(inviteLink).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);
  const rawInviteToken = inviteLink.split('/').at(-1);

  const invitesResponse = await request.get(
    'http://127.0.0.1:8080/v1/projects/demo-shortener/databases/(default)/documents/inviteTokens',
    { headers: { Authorization: 'Bearer owner' } },
  );
  expect(invitesResponse.ok()).toBe(true);
  const persistedInvites = (await invitesResponse.json()) as {
    documents: Array<{ name: string; fields: Record<string, unknown> }>;
  };
  expect(persistedInvites.documents).toHaveLength(1);
  expect(Object.keys(persistedInvites.documents[0]?.fields ?? {}).sort()).toEqual([
    'canceledAt',
    'createdAt',
    'createdBy',
    'expiresAt',
    'role',
    'teamId',
  ]);
  expect(persistedInvites.documents[0]?.name).not.toContain(rawInviteToken);
  await page.getByRole('link', { name: 'Links', exact: true }).click();
  await page.getByRole('textbox', { name: 'Endereço curto' }).fill('comunicacao-oficial');
  await page
    .getByRole('textbox', { name: 'URL de destino' })
    .fill('https://example.com/comunicacao');
  await page.keyboard.press('Enter');
  const adminLinkRow = page.getByRole('row').filter({ hasText: '/comunicacao-oficial' });
  await expect(adminLinkRow).toBeVisible();
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await adminLinkRow.getByRole('button', { name: 'Copiar' }).click();
  await expect(page.getByText(/comunicacao-oficial copiado/)).toBeVisible();

  await adminLinkRow.getByRole('link', { name: 'Gerenciar' }).focus();
  await page.keyboard.press('Enter');
  const destinationField = page.getByRole('textbox', { name: 'URL de destino' });
  await destinationField.click();
  await destinationField.press('Control+A');
  await destinationField.pressSequentially('http://example.com/comunicacao-atualizada');
  await expect(destinationField).toHaveValue('http://example.com/comunicacao-atualizada');
  await page.getByRole('button', { name: 'Salvar destino' }).click();
  await expect(page.getByText('Destino atualizado.')).toBeVisible();
  await expect(page.getByText('Destino alterado')).toBeVisible();

  await page.getByRole('button', { name: 'Desativar' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').getByRole('button', { name: 'Desativar' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Desativado', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Arquivar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Arquivar' }).click();
  await expect(page.getByText('Arquivado', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Voltar aos links' }).click();
  await page.getByRole('combobox', { name: 'Filtrar por estado' }).selectOption('archived');
  const archivedLinkRow = page.getByRole('row').filter({ hasText: '/comunicacao-oficial' });
  await expect(archivedLinkRow).toBeVisible();
  await archivedLinkRow.getByRole('link', { name: 'Gerenciar' }).click();
  await page.getByRole('button', { name: 'Restaurar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restaurar' }).click();
  await expect(page.getByText('Ativo', { exact: true })).toBeVisible();
  await expect(page.getByText('Link restaurado')).toBeVisible();

  for (let click = 0; click < 3; click += 1) {
    const redirect = await request.get(
      'http://127.0.0.1:5001/demo-shortener/southamerica-east1/redirectLink/comunicacao-oficial',
      { maxRedirects: 0 },
    );
    expect(redirect.status()).toBe(302);
    expect(redirect.headers().location).toBe('http://example.com/comunicacao-atualizada');
  }
  await page.getByRole('link', { name: 'Voltar aos links' }).click();
  const clickedLinkRow = page.getByRole('row').filter({ hasText: '/comunicacao-oficial' });
  await clickedLinkRow.getByRole('link', { name: 'Gerenciar' }).click();
  await expect(page.getByText('3', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('nos últimos 30 dias UTC')).toBeVisible();
  const analyticsTable = page.getByRole('table', { name: /cliques diários em UTC/i });
  await expect(analyticsTable.getByRole('cell', { name: '3', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Voltar aos links' }).click();

  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  try {
    await memberPage.goto(inviteLink);
    const memberPopupPromise = memberPage.waitForEvent('popup');
    await memberPage.getByRole('button', { name: 'Entrar com Google' }).click();
    const memberPopup = await memberPopupPromise;
    await completeGooglePopup(
      memberPopup,
      'beto.e2e@example.test',
      'Beto E2E',
      normalizeMobilePopup,
    );
    await memberPage.waitForURL(/\/invite\/[A-Za-z0-9_-]{43}$/);
    await expect(memberPage.getByText('Convite aceito')).toBeVisible();

    const updatedProfilesResponse = await request.get(
      'http://127.0.0.1:8080/v1/projects/demo-shortener/databases/(default)/documents/users',
      { headers: { Authorization: 'Bearer owner' } },
    );
    const updatedProfiles = (await updatedProfilesResponse.json()) as {
      documents: Array<{
        fields: Record<string, { stringValue?: string }>;
      }>;
    };
    const memberProfile = updatedProfiles.documents.find(
      (document) => document.fields['email']?.stringValue === 'beto.e2e@example.test',
    );
    const memberUid = memberProfile?.fields['uid']?.stringValue;
    if (memberUid === undefined) throw new Error('O perfil do membro E2E não contém UID.');

    const membershipUrl =
      `http://127.0.0.1:8080/v1/projects/demo-shortener/databases/(default)/documents/` +
      `teams/${communicationTeamId}/members/${memberUid}`;
    await memberPage.getByRole('button', { name: 'Abrir equipe' }).click();
    await expect(
      memberPage.getByRole('heading', { name: 'Comunicação', exact: true }),
    ).toBeVisible();
    await expect(memberPage.getByText('/comunicacao-oficial')).toBeHidden();
    await memberPage.getByRole('textbox', { name: 'Endereço curto' }).fill('beto-eventos');
    await memberPage
      .getByRole('textbox', { name: 'URL de destino' })
      .fill('http://example.com/eventos');
    await memberPage.getByRole('button', { name: 'Criar link' }).click();
    await expect(memberPage.getByText('/beto-eventos')).toBeVisible();
    await memberPage.getByRole('link', { name: 'Membros' }).click();
    await expect(memberPage.getByText('ana.e2e@example.test')).toBeVisible();
    await expect(
      memberPage.getByRole('row').filter({ hasText: 'beto.e2e@example.test' }),
    ).toBeVisible();
    await expect(memberPage.getByRole('button', { name: 'Promover' })).toHaveCount(0);
    await expect(memberPage.getByRole('button', { name: 'Remover' })).toHaveCount(0);

    await expect(page.getByText('/comunicacao-oficial')).toBeVisible();
    await expect(page.getByText('/beto-eventos')).toBeVisible();
    await page.getByRole('link', { name: 'Membros' }).click();
    const memberRow = page.getByRole('row').filter({ hasText: 'beto.e2e@example.test' });
    await expect(memberRow).toBeVisible();
    await memberRow.getByRole('button', { name: 'Promover' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Promover' }).click();
    await expect(page.getByText('Membro promovido a administrador.')).toBeVisible();

    const memberOwnRow = memberPage.getByRole('row').filter({ hasText: 'beto.e2e@example.test' });
    await expect(memberOwnRow.getByRole('button', { name: 'Rebaixar' })).toBeVisible();

    await memberRow.getByRole('button', { name: 'Rebaixar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Rebaixar' }).click();
    await expect(page.getByText('Administrador alterado para membro.')).toBeVisible();
    await expect(memberPage.getByRole('button', { name: 'Promover' })).toHaveCount(0);

    await memberRow.getByRole('button', { name: 'Remover' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remover membro' }).click();
    await expect(page.getByText('Membro removido.')).toBeVisible();
    await expect(memberPage.getByText('Equipe não disponível')).toBeVisible();

    const removedMembership = await request.get(membershipUrl, {
      headers: { Authorization: 'Bearer owner' },
    });
    expect(removedMembership.status()).toBe(404);
  } finally {
    await memberContext.close();
  }

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Comunicação', exact: true })).toBeVisible();
  await expect(page.locator('header').getByText('ana.e2e@example.test')).toBeVisible();

  await page.goto('/app/equipes/equipe-alheia');
  await expect(page.getByText('Equipe não disponível')).toBeVisible();
  await expect(page.getByText('Comunicação')).toBeHidden();

  await page.getByRole('button', { name: /Menu de /i }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page.getByRole('heading', { name: 'Acesso interno' })).toBeVisible();
  await expect(page.getByText('ana.e2e@example.test')).toBeHidden();

  await page.goto('/rota-que-nao-existe');
  await expect(page.getByRole('heading', { name: 'Acesso interno' })).toBeVisible();
});

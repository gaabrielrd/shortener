import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, ErrorState, LoadingState, PageHeader } from '@vitru/styleguide';
import { ArrowRight, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import type { ConsumeInviteResult } from '../model/invite';
import { useInvites } from './invitesContext';
import { useTeams } from './teamsContext';
import styles from './InviteEntryPage.module.css';

export function InviteEntryPage() {
  const { token = '' } = useParams<{ token: string }>();
  const invites = useInvites();
  const teams = useTeams();
  const navigate = useNavigate();
  const consumed = useRef<string | null>(null);
  const [result, setResult] = useState<ConsumeInviteResult | null>(null);
  const consumeInvite = invites.consume;
  const retryTeams = teams.retry;

  useEffect(() => {
    if (consumed.current === token) return;
    consumed.current = token;
    void consumeInvite(token).then((next) => {
      setResult(next);
      if (next.ok) retryTeams();
    });
  }, [consumeInvite, retryTeams, token]);

  if (result === null) return <LoadingState label="Validando convite..." />;
  if (!result.ok) {
    return (
      <ErrorState
        title="Convite não disponível"
        description={result.failure.message}
        action={<Button onClick={() => void navigate('/app')}>Ir para minhas equipes</Button>}
      />
    );
  }

  return (
    <section className={styles.page}>
      <Card tone="raised">
        <div className={styles.content}>
          <Users className="icon" aria-hidden="true" />
          <PageHeader
            title="Convite aceito"
            description={`Você ${result.alreadyMember ? 'já participa' : 'entrou'} da equipe ${result.teamName} como membro.`}
          />
          <Alert variant="success" title="Acesso confirmado">
            O convite pode continuar sendo usado por outras pessoas até vencer ou ser cancelado.
          </Alert>
          <Button onClick={() => void navigate(`/app/equipes/${result.teamId}`)}>
            <ArrowRight className="icon icon-sm" aria-hidden="true" />
            Abrir equipe
          </Button>
        </div>
      </Card>
    </section>
  );
}

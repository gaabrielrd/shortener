import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Alert, Button, Dialog, Input } from '@vitru/styleguide';
import { Plus } from 'lucide-react';
import { validateTeamName, type TeamFailure } from '../model/team';
import { useTeams } from './teamsContext';
import styles from './CreateTeamDialog.module.css';

const FORM_ID = 'create-team-form';

export function CreateTeamDialog({
  open,
  onClose,
  onCreated,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (teamId: string) => void;
}) {
  const teams = useTeams();
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState('');
  const [failure, setFailure] = useState<TeamFailure | null>(null);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      formRef.current?.querySelector('input')?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  function closeDialog() {
    if (teams.isCreating) return;
    setName('');
    setFailure(null);
    onClose();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationFailure = validateTeamName(name);
    if (validationFailure !== null) {
      setFailure(validationFailure);
      return;
    }

    setFailure(null);
    const result = await teams.createTeam(name);
    if (!result.ok) {
      setFailure(result.failure);
      return;
    }

    setName('');
    onCreated(result.team.id);
  }

  return (
    <Dialog
      open={open}
      title="Criar nova equipe"
      onClose={closeDialog}
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={teams.isCreating}
            onClick={closeDialog}
          >
            Cancelar
          </Button>
          <Button type="submit" form={FORM_ID} disabled={teams.isCreating}>
            <Plus className="icon icon-sm" aria-hidden="true" />
            {teams.isCreating ? 'Criando equipe...' : 'Criar equipe'}
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        id={FORM_ID}
        className={styles.form}
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        <Input
          label="Nome da nova equipe"
          hint="Use um nome reconhecível para as pessoas que trabalham juntas."
          name="teamName"
          value={name}
          maxLength={80}
          autoComplete="organization"
          error={failure?.field === 'name' ? failure.message : undefined}
          onChange={(event) => {
            setName(event.target.value);
            if (failure !== null) setFailure(null);
          }}
        />
        {failure !== null && failure.field !== 'name' ? (
          <Alert variant="danger" title="Não foi possível criar a equipe">
            {failure.message}
          </Alert>
        ) : null}
      </form>
    </Dialog>
  );
}

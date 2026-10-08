import { useState } from 'react';

import {
  Alert,
  Avatar,
  Badge,
  Button,
  ButtonIcon,
  Card,
  ConfirmDialog,
  ErrorState,
  Input,
  LoadingDots,
  LoadingState,
  Skeleton,
  Textarea,
  Toast,
  WordCard,
} from '@shared/ui';

/**
 * Primitive gallery, for development builds only.
 *
 * Every component in `shared/ui` is rendered here in its main states, so a change to a
 * recipe can be checked in one place and at every width. Its sample copy is developer
 * fixture text, so the route is not registered in production builds.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2>{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export function UIElements() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(1);

  return (
    <div className="flex flex-col gap-6 py-4">
      <h1>UI primitives</h1>

      <Section title="Buttons — fill">
        <Button>Join room</Button>
        <Button variant="neutral">Stay</Button>
        <Button variant="muted">Pass</Button>
        <Button variant="secondary">Leave room</Button>
        <Button variant="success">Ready!</Button>
        <Button variant="danger">Delete room</Button>
        <Button variant="cta" size="xl">
          Start party!
        </Button>
      </Section>

      <Section title="Buttons — states and sizes">
        <Button size="sm">Small</Button>
        <Button size="md" icon="copy">
          Copy code
        </Button>
        <Button size="lg" trailingIcon="forward">
          Continue
        </Button>
        <Button loading>Joining</Button>
        <Button disabled>Disabled</Button>
        <Button block className="max-w-xs">
          Full width
        </Button>
      </Section>

      <Section title="Buttons — outline, text and icon">
        <Button theme="outline">Copy code</Button>
        <Button theme="outline" variant="neutral">
          Play again
        </Button>
        <Button theme="outline" variant="danger" icon="leave">
          Leave
        </Button>
        <Button theme="outline" variant="secondary" trailingIcon="logout">
          Leave room
        </Button>
        <Button
          variant="primary"
          sizeClassName="h-[53px] gap-[12px] rounded-[13px] px-5 text-[22px] leading-none font-bold"
        >
          Own geometry
        </Button>
        <Button theme="text">Show more players</Button>
        <ButtonIcon icon="send" aria-label="Send" />
        <ButtonIcon icon="close" variant="muted" aria-label="Close" size="lg" />
        <ButtonIcon icon="start" variant="neutral" aria-label="Play" />
        <ButtonIcon icon="settings" theme="outline" variant="primary" aria-label="Settings" />
      </Section>

      <Section title="Inputs">
        <div className="w-full max-w-sm">
          <Input label="Nickname" placeholder="Your nickname" leadingIcon="profile" />
        </div>
        <div className="w-full max-w-sm">
          <Input
            label="Email"
            status="error"
            message="Oops! Invalid email address."
            defaultValue="not-an-email"
          />
        </div>
        <div className="w-full max-w-sm">
          <Input
            label="Password"
            type="password"
            status="success"
            message="Strong password."
            trailingIcon="password"
          />
        </div>
        <div className="w-full max-w-sm">
          <Input label="Room code" size="lg" placeholder="ABC123" hint="Six characters." />
        </div>
        <div className="w-full max-w-sm">
          <Input label="Disabled" placeholder="Unavailable" disabled />
        </div>
        <div className="w-full max-w-sm">
          <Textarea label="Message" placeholder="Write a message…" />
        </div>
      </Section>

      <Section title="Identity">
        <Avatar name="Player" online />
        <Avatar name="Player" size="lg" ring="teamA" online={false} />
        <Avatar name="Player" size="xl" ring="teamB" online />
        <Badge variant="host">Host</Badge>
        <Badge variant="ready" icon="check" circleIcon>
          Ready
        </Badge>
        <Badge variant="role">Operative</Badge>
        <Badge variant="warning" size="sm">
          Reconnecting
        </Badge>
      </Section>

      <Section title="Surfaces">
        <Card className="w-full max-w-sm">Card content</Card>
        <Card tone="raised" interactive className="w-full max-w-sm">
          Interactive card
        </Card>
      </Section>

      <Section title="Board">
        <div className="grid w-full max-w-3xl grid-cols-5 gap-2">
          {['Apple', 'Ocean', 'Rocket', 'Night', 'Fire'].map((word, index) => (
            <WordCard
              key={word}
              word={word}
              selected={selected === index}
              onSelect={() => setSelected(index)}
            />
          ))}
          <WordCard word="Ocean" color="BLUE" revealed />
          <WordCard word="Fire" color="RED" revealed />
          <WordCard word="Chair" color="NEUTRAL" revealed />
          <WordCard word="Danger" color="ASSASSIN" revealed />
          <WordCard word="Locked" disabled />
        </div>
      </Section>

      <Section title="Feedback">
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Alert tone="success" title="Success">
            Room created! Invite your friends.
          </Alert>
          <Alert tone="error" title="Error">
            This room code does not exist.
          </Alert>
          <Alert tone="warning" title="Heads up">
            Leaving during a game forfeits it for your team.
          </Alert>
          <Alert tone="info" title="Starting">
            Game starting in 5 seconds.
          </Alert>
        </div>
        <Toast onDismiss={() => undefined} dismissLabel="Dismiss">
          Player joined!
        </Toast>
        <Toast tone="success" icon="check">
          Clue accepted
        </Toast>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Skeleton shape="block" />
          <Skeleton />
        </div>
        <LoadingDots size="sm" />
        <LoadingState label="Loading rooms…" />
        <ErrorState
          title="Could not load rooms"
          description="Check your connection and try again."
          onRetry={() => undefined}
          retryLabel="Try again"
        />
      </Section>

      <Section title="Dialogs">
        <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
          Open confirmation
        </Button>
      </Section>

      {confirmOpen && (
        <ConfirmDialog
          title="Leave Room?"
          body="You will leave this room and lose your seat."
          cancelLabel="Stay"
          confirmLabel="Leave Room"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}

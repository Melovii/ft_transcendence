import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@shared/constants';
import { LanguageSelector } from '@shared/i18n/LanguageSelector';
import { useOnReconnect } from '@shared/hooks';
import { useSessionStore } from '@shared/stores';
import type { OwnProfile } from '@shared/types';
import { Alert, AvatarImage, Button, Dialog, FieldMessage, Icon } from '@shared/ui';
import { cn } from '@shared/utils';

import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { useOwnProfile } from '../hooks/useOwnProfile';
import { setPlayerAvatar } from '../hooks/usePlayerAvatars';
import { useUsernameEdit } from '../hooks/useUsernameEdit';
import { AVATAR_RULES } from '../model/avatarCrop';
import { useOwnProfileStore } from '../store/ownProfileStore';
import { AvatarCropView, CROP_VIEWPORT } from './AvatarCropView';
import { AvatarPickView } from './AvatarPickView';
import * as styles from './SettingsModal.styles';

/** Log Out as the app layer runs it: it ends the session and clears every private state. */
export interface LogOutControl {
  status: 'IDLE' | 'PENDING' | 'FAILED';
  request: () => void;
}

/** Opens the Delete Account? confirmation, which the app layer runs. */
export interface DeleteAccountControl {
  request: () => void;
}

export interface SettingsModalProps {
  onClose: () => void;
  logOut: LogOutControl;
  deleteAccount: DeleteAccountControl;
  /** `false` while another dialog stands over Settings, such as the Log Out confirmation. */
  active?: boolean;
}

type View = 'SETTINGS' | 'CROP' | 'PICK';

/**
 * Settings, over the screen that opened it: Room Discovery, the Ready Room or the Game
 * Board, which stays mounted and live behind it. The app-level `ModalHost` renders it;
 * the profile menu opens it with `openSettingsModal()`.
 *
 * It edits what the account contract lets the user edit — the avatar, by upload or by a
 * ready-made pick, and the username — and each change is shown only once the server has
 * confirmed it, then everywhere at once through the shared stores. The language switch
 * changes this device's language at once. Crop Photo and Pick
 * Avatar take the place of the Settings card inside the same dialog, so the username draft
 * survives a trip to either. Log Out, Delete Account and the legal pages sit at the foot.
 */
export function SettingsModal({
  onClose,
  logOut,
  deleteAccount,
  active = true,
}: SettingsModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const avatarNoteId = useId();
  const usernameId = useId();
  const usernameNoteId = useId();
  const emailId = useId();
  const languageId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const uploadRef = useRef<HTMLButtonElement>(null);
  const pickRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const session = useSessionStore((state) => state.user);
  const { profile, refresh } = useOwnProfile();
  const [picking, setPicking] = useState(false);
  const [saved, setSaved] = useState(false);

  const userId = profile?.user_id ?? session?.user_id;
  const username = profile?.username ?? session?.username ?? '';
  const avatarUrl = profile?.avatar_url ?? '';

  // Settings shows what the server holds now, and again after a reconnect.
  useEffect(() => {
    refresh();
  }, [refresh]);
  useOnReconnect(refresh);

  const onAvatarSaved = useCallback(
    (url: string) => {
      useOwnProfileStore.getState().setAvatar(url);
      if (userId !== undefined) setPlayerAvatar(userId, url);
      setPicking(false);
      setSaved(true);
    },
    [userId],
  );

  const onProfileSaved = useCallback((next: OwnProfile) => {
    useOwnProfileStore.getState().apply(next);
    useSessionStore.getState().setUsername(next.username);
    setPlayerAvatar(next.user_id, next.avatar_url);
    setSaved(true);
  }, []);

  const upload = useAvatarUpload(CROP_VIEWPORT, onAvatarSaved);
  const edit = useUsernameEdit(username, onProfileSaved);

  const view: View = upload.status !== 'IDLE' ? 'CROP' : picking ? 'PICK' : 'SETTINGS';
  const busy = upload.status === 'UPLOADING' || edit.saving || logOut.status === 'PENDING';

  // A view swap replaces the focused control: the new view's heading takes focus, and
  // coming back to Settings returns it to the button that left.
  const previousView = useRef<View>(view);
  useEffect(() => {
    const from = previousView.current;
    previousView.current = view;
    if (from === view) return;
    if (view !== 'SETTINGS') titleRef.current?.focus();
    else (from === 'PICK' ? pickRef : uploadRef).current?.focus();
  }, [view]);

  const chooseFile = () => fileRef.current?.click();
  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so the same file can be chosen again after a cancel.
    event.target.value = '';
    if (!file) return;
    setSaved(false);
    void upload.pick(file);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    void edit.save();
  };

  // Close steps back from Crop Photo and Pick Avatar; it closes Settings from Settings.
  const close = () => {
    if (view === 'CROP') upload.cancel();
    else if (view === 'PICK') setPicking(false);
    else onClose();
  };

  // A file problem found before the cropper opens is shown under the avatar buttons.
  const avatarError = view === 'SETTINGS' ? upload.error : null;

  return (
    <Dialog
      labelledBy={titleId}
      closeLabel={t(`settings.close.${view}`)}
      onClose={close}
      closable={active && !busy}
      className={
        view === 'CROP' ? styles.cropCard : view === 'PICK' ? styles.pickCard : styles.settingsCard
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept={AVATAR_RULES.types.join(',')}
        onChange={onFile}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
      />

      {view === 'CROP' ? (
        <AvatarCropView
          upload={upload}
          titleId={titleId}
          titleRef={titleRef}
          onChooseAnother={chooseFile}
        />
      ) : view === 'PICK' ? (
        <AvatarPickView
          currentAvatarUrl={avatarUrl}
          titleId={titleId}
          titleRef={titleRef}
          onSaved={onAvatarSaved}
          onCancel={() => setPicking(false)}
        />
      ) : (
        <>
          <div className={styles.header}>
            <h2 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
              {t('settings.title')}
            </h2>
            <p className={styles.subtitle}>{t('settings.subtitle')}</p>
          </div>

          {saved && (
            <Alert tone="success" title={t('settings.saved.title')}>
              {t('settings.saved.body')}
            </Alert>
          )}

          <section aria-labelledby={`${titleId}-avatar`} className={styles.section}>
            <h3 id={`${titleId}-avatar`} className={styles.label}>
              {t('settings.avatar.label')}
            </h3>
            <div className={styles.avatarRow}>
              <span className={styles.currentAvatar}>
                <AvatarImage
                  src={avatarUrl}
                  alt={t('settings.avatar.current')}
                  className={styles.avatarImage}
                  placeholderClassName={styles.avatarPlaceholder}
                />
              </span>
              <div className={styles.avatarActions}>
                <div className={styles.avatarButtons}>
                  <Button
                    ref={uploadRef}
                    theme="outline"
                    sizeClassName={styles.outlineButton}
                    onClick={chooseFile}
                    aria-describedby={avatarNoteId}
                    className={styles.outlineButtonWidth}
                  >
                    {t('settings.avatar.upload')}
                  </Button>
                  <Button
                    ref={pickRef}
                    theme="outline"
                    sizeClassName={styles.outlineButton}
                    onClick={() => {
                      setSaved(false);
                      upload.cancel();
                      setPicking(true);
                    }}
                    className={styles.outlineButtonWidth}
                  >
                    {t('settings.avatar.pick')}
                  </Button>
                </div>
                {avatarError ? (
                  <FieldMessage id={avatarNoteId} status="error" className={styles.fieldError}>
                    {t(`settings.avatar.error.${avatarError}`)}
                  </FieldMessage>
                ) : (
                  <p id={avatarNoteId} className={styles.hint}>
                    {t('settings.avatar.hint')}
                  </p>
                )}
              </div>
            </div>
          </section>

          <form onSubmit={onSubmit} noValidate className={styles.section}>
            <label htmlFor={usernameId} className={styles.label}>
              {t('settings.username.label')}
            </label>
            <div className={styles.usernameForm}>
              <div className={styles.inputWrap}>
                <Icon name="profile" className={styles.inputIcon} />
                <input
                  id={usernameId}
                  type="text"
                  value={edit.value}
                  onChange={(event) => {
                    setSaved(false);
                    edit.change(event.target.value);
                  }}
                  readOnly={edit.saving}
                  autoComplete="username"
                  spellCheck={false}
                  maxLength={20}
                  aria-invalid={edit.error !== null || undefined}
                  aria-describedby={usernameNoteId}
                  className={cn(styles.input, styles.inputStatus[edit.error ? 'error' : 'default'])}
                />
              </div>
              <Button
                type="submit"
                sizeClassName={styles.saveButton}
                aria-disabled={!edit.changed || edit.saving}
                aria-busy={edit.saving}
                className="shrink-0"
              >
                {t(edit.saving ? 'settings.username.saving' : 'settings.username.save')}
              </Button>
            </div>
            {edit.error ? (
              <FieldMessage id={usernameNoteId} status="error" className={styles.fieldError}>
                {t(`settings.username.error.${edit.error}`)}
              </FieldMessage>
            ) : (
              <p id={usernameNoteId} className={styles.hint}>
                {t('settings.username.hint')}
              </p>
            )}
          </form>

          {profile && (
            <div className={styles.section}>
              <label htmlFor={emailId} className={styles.label}>
                {t('settings.email.label')}
              </label>
              <div className={styles.inputWrap}>
                <Icon name="email" className={styles.inputIcon} />
                <input
                  id={emailId}
                  type="email"
                  value={profile.email}
                  readOnly
                  aria-describedby={`${emailId}-hint`}
                  className={cn(styles.input, styles.inputReadOnly)}
                />
              </div>
              <p id={`${emailId}-hint`} className={styles.hint}>
                {t('settings.email.hint')}
              </p>
            </div>
          )}

          <section aria-labelledby={languageId} className={styles.section}>
            <h3 id={languageId} className={styles.label}>
              {t('settings.language.label')}
            </h3>
            <LanguageSelector labelledBy={languageId} className={styles.language} />
            <p className={styles.hint}>{t('settings.language.hint')}</p>
          </section>

          <span aria-hidden="true" className={styles.divider} />

          {/* The design system's Leave Room button, used for Log Out. */}
          <Button
            theme="outline"
            variant="secondary"
            sizeClassName={styles.logOut}
            block
            onClick={() => logOut.status !== 'PENDING' && logOut.request()}
            aria-disabled={logOut.status === 'PENDING' || undefined}
            aria-busy={logOut.status === 'PENDING'}
            className={styles.raisedSurface}
          >
            {t(logOut.status === 'PENDING' ? 'settings.logOut.pending' : 'settings.logOut.button')}
            <Icon name="logout" />
          </Button>
          {logOut.status === 'FAILED' && (
            <p role="alert" className={styles.logOutError}>
              {t('settings.logOut.failed')}
            </p>
          )}

          {/* A quiet destructive link under Log Out, so it is never pressed by habit. */}
          <Button
            theme="link"
            variant="secondary"
            icon="trash"
            sizeClassName={styles.deleteAccount}
            onClick={deleteAccount.request}
            disabled={busy}
            aria-haspopup="dialog"
            className="mx-auto"
          >
            {t('settings.deleteAccount.button')}
          </Button>

          {/* A new tab, so the room or match behind Settings keeps running. */}
          <nav aria-label={t('settings.legal.navigation')} className={styles.legal}>
            <a
              href={ROUTES.privacy}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.legalLink}
            >
              {t('settings.legal.privacy')}
              <span className="sr-only"> {t('settings.legal.newTab')}</span>
            </a>
            <span aria-hidden="true">•</span>
            <a
              href={ROUTES.terms}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.legalLink}
            >
              {t('settings.legal.terms')}
              <span className="sr-only"> {t('settings.legal.newTab')}</span>
            </a>
          </nav>
        </>
      )}
    </Dialog>
  );
}

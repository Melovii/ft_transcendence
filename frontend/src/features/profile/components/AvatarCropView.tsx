import { useRef } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, RefObject } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button, FieldMessage, Icon } from '@shared/ui';

import type { useAvatarUpload } from '../hooks/useAvatarUpload';
import { AVATAR_RULES, displayRect } from '../model/avatarCrop';
import * as styles from './SettingsModal.styles';

/** The crop viewport's size in CSS pixels, the same at every breakpoint. */
export const CROP_VIEWPORT = 256;

/** The round preview beside the hint, drawn from the same crop. */
const PREVIEW = 58;

/** Arrow keys move the photo by this much; with Shift, four times as far. */
const KEY_STEP = 8;

type AvatarUpload = ReturnType<typeof useAvatarUpload>;

/**
 * Crop Photo, inside the Settings dialog. The photo opens centred and filling the square;
 * dragging or the arrow keys move it, the slider zooms it from 1× to 3×, and it can never
 * be moved or zoomed out far enough to leave an empty edge. SAVE PHOTO uploads exactly
 * the square shown, and the round preview shows the avatar it makes.
 */
export function AvatarCropView({
  upload,
  titleId,
  titleRef,
  onChooseAnother,
}: {
  upload: AvatarUpload;
  titleId: string;
  titleRef: RefObject<HTMLHeadingElement | null>;
  onChooseAnother: () => void;
}) {
  const { t } = useTranslation();
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const { preview, status, error, pan, zoom, cancel, confirm } = upload;
  const uploading = status === 'UPLOADING';

  if (!preview) return null;

  const rect = displayRect(preview.image, CROP_VIEWPORT, preview.crop);
  const place = (ratio: number): CSSProperties => ({
    left: rect.x * ratio,
    top: rect.y * ratio,
    width: rect.width * ratio,
    height: rect.height * ratio,
  });
  const fill = `${((preview.crop.zoom - AVATAR_RULES.minZoom) / (AVATAR_RULES.maxZoom - AVATAR_RULES.minZoom)) * 100}%`;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (uploading) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const from = drag.current;
    if (!from || from.id !== event.pointerId) return;
    pan(event.clientX - from.x, event.clientY - from.y);
    drag.current = { ...from, x: event.clientX, y: event.clientY };
  };
  const endDrag = () => {
    drag.current = null;
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? KEY_STEP * 4 : KEY_STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move || uploading) return;
    event.preventDefault();
    pan(...move);
  };

  return (
    <>
      <div className={styles.header}>
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className={styles.title}>
          {t('settings.crop.title')}
        </h2>
        <p className={styles.subtitle}>{t('settings.crop.subtitle')}</p>
      </div>

      <div
        role="group"
        tabIndex={0}
        aria-label={t('settings.crop.position')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className={styles.cropViewport}
      >
        <img
          src={preview.src}
          alt=""
          draggable={false}
          style={place(1)}
          className={styles.cropImage}
        />
        <span aria-hidden="true" className={styles.cropGuide} />
      </div>

      <div className={styles.zoomRow}>
        <Icon name="zoomOut" className={styles.zoomIcon} />
        <input
          type="range"
          min={AVATAR_RULES.minZoom}
          max={AVATAR_RULES.maxZoom}
          step={0.01}
          value={preview.crop.zoom}
          onChange={(event) => zoom(Number(event.target.value))}
          disabled={uploading}
          aria-label={t('settings.crop.zoom')}
          aria-valuetext={`${preview.crop.zoom.toFixed(1)}×`}
          style={{ '--fill': fill } as CSSProperties}
          className={styles.zoomSlider}
        />
        <Icon name="zoomIn" className={styles.zoomIcon} />
      </div>

      <div className={styles.previewRow}>
        <span aria-hidden="true" className={styles.preview}>
          <img
            src={preview.src}
            alt=""
            style={place(PREVIEW / CROP_VIEWPORT)}
            className={styles.cropImage}
          />
        </span>
        <p className={styles.previewLabel}>{t('settings.crop.preview')}</p>
      </div>

      {error ? (
        <FieldMessage id={`${titleId}-error`} status="error" className={styles.fieldError}>
          {t(`settings.avatar.error.${error}`)}
        </FieldMessage>
      ) : (
        <p className={styles.cropHint}>
          <Trans
            i18nKey="settings.crop.hint"
            components={{
              choose: (
                <button
                  type="button"
                  onClick={onChooseAnother}
                  disabled={uploading}
                  className={styles.hintAction}
                />
              ),
            }}
          />
        </p>
      )}

      <div className={styles.actions}>
        <Button
          theme="outline"
          sizeClassName={styles.actionOutline}
          onClick={cancel}
          disabled={uploading}
          className="bg-surface"
        >
          {t('settings.crop.cancel')}
        </Button>
        <Button
          sizeClassName={styles.actionPrimary}
          onClick={() => void confirm()}
          disabled={uploading}
          aria-busy={uploading}
        >
          {t(uploading ? 'settings.crop.saving' : 'settings.crop.save')}
        </Button>
      </div>
    </>
  );
}
